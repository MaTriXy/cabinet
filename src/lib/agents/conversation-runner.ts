import path from "path";
import { randomUUID } from "crypto";
import type { JobConfig, JobRun, JobPostAction } from "@/types/jobs";
import type { ConversationMeta } from "@/types/conversations";
import { readPage } from "../storage/page-io";
import { DATA_DIR } from "../storage/path-utils";
import {
  defaultAdapterTypeForProvider,
  resolveExecutionProviderId,
} from "./adapters";
import { agentAdapterRegistry } from "./adapters/registry";
import type { AdapterExecutionContext } from "./adapters/types";
import {
  appendAgentTurn,
  appendConversationTranscript,
  appendUserTurn,
  createConversation,
  extractAgentTurnContent,
  finalizeConversation,
  readConversationMeta,
  readConversationTurns,
  readSession,
  updateAgentTurn,
  writeSession,
} from "./conversation-store";
import { createDaemonSession, getDaemonSessionOutput } from "./daemon-client";
import { readLibraryPersona } from "./library-manager";
import { readPersona, type AgentPersona } from "./persona-manager";
import { getDefaultProviderId } from "./provider-runtime";
import { looksLikeAwaitingInput } from "./task-heuristics";

export interface ConversationCompletion {
  meta: ConversationMeta;
  output: string;
  status: "completed" | "failed";
}

interface StartConversationInput {
  agentSlug: string;
  title: string;
  trigger: ConversationMeta["trigger"];
  prompt: string;
  providerId?: string;
  adapterType?: string;
  adapterConfig?: Record<string, unknown>;
  mentionedPaths?: string[];
  jobId?: string;
  jobName?: string;
  scheduledAt?: string;
  cabinetPath?: string;
  cwd?: string;
  timeoutSeconds?: number;
  onComplete?: (completion: ConversationCompletion) => Promise<void> | void;
}

function buildCabinetEpilogueInstructions(): string {
  return [
    "At the end of your response, include a ```cabinet block with these fields:",
    "SUMMARY: one short summary line",
    "CONTEXT: optional lightweight memory/context summary",
    "ARTIFACT: relative/path/to/file for every KB file you created or updated",
  ].join("\n");
}

function buildKnowledgeBaseScopeInstructions(
  baseCwd: string,
  cabinetPath?: string
): string[] {
  if (cabinetPath) {
    return [
      `Work only inside the cabinet-scoped knowledge base rooted at /data/${cabinetPath}.`,
      `For local filesystem work, treat ${baseCwd} as the root for this run.`,
      "Do not create or modify files in sibling cabinets or the global /data root unless the user explicitly asks.",
    ];
  }

  return [
    "Work in the Cabinet knowledge base rooted at /data.",
    `For local filesystem work, treat ${baseCwd} as the root for this run.`,
  ];
}

function buildDiagramOutputInstructions(): string[] {
  return [
    "If you create Mermaid diagrams, make sure the source is renderable.",
    "Prefer Mermaid edge labels like `A -->|label| B` or `A -.->|label| B` instead of mixed forms such as `A -- \"label\" --> B`.",
  ];
}

function buildAgentContextHeader(persona: AgentPersona | null, agentSlug: string): string {
  if (!persona) {
    return [
      "You are Cabinet's General agent.",
      "Handle the request directly and use the knowledge base as your working area.",
    ].join("\n");
  }

  return [
    persona.body,
    "",
    `You are working as ${persona.name} (${agentSlug}).`,
  ].join("\n");
}

function makeTitle(text: string): string {
  const firstLine = text.split("\n").map((line) => line.trim()).find(Boolean) || "New conversation";
  return firstLine.slice(0, 80);
}

async function buildMentionContext(mentionedPaths: string[]): Promise<string> {
  if (mentionedPaths.length === 0) return "";

  const chunks = await Promise.all(
    mentionedPaths.map(async (pagePath) => {
      try {
        const page = await readPage(pagePath);
        return `--- ${page.frontmatter.title} (${pagePath}) ---\n${page.content}`;
      } catch {
        return null;
      }
    })
  );

  const valid = chunks.filter(Boolean);
  if (valid.length === 0) return "";

  return `\n\nReferenced pages:\n${valid.join("\n\n")}`;
}

export async function buildManualConversationPrompt(input: {
  agentSlug: string;
  userMessage: string;
  mentionedPaths?: string[];
  cabinetPath?: string;
}): Promise<{
  prompt: string;
  title: string;
  cwd?: string;
  adapterType: string;
  adapterConfig?: Record<string, unknown>;
  providerId: string;
  cabinetPath?: string;
}> {
  const persona = input.agentSlug === "general"
    ? null
    : await readPersona(input.agentSlug, input.cabinetPath);
  const mentionContext = await buildMentionContext(input.mentionedPaths || []);
  const baseCwd = input.cabinetPath ? path.join(DATA_DIR, input.cabinetPath) : DATA_DIR;
  const cwd =
    persona?.workdir && persona.workdir !== "/data"
      ? `${DATA_DIR}/${persona.workdir.replace(/^\/+/, "")}`
      : baseCwd;

  const prompt = [
    buildAgentContextHeader(persona, input.agentSlug),
    "",
    ...buildKnowledgeBaseScopeInstructions(baseCwd, input.cabinetPath),
    "Reflect useful outputs in KB files, not only in terminal text.",
    ...buildDiagramOutputInstructions(),
    buildCabinetEpilogueInstructions(),
    "",
    `User request:\n${input.userMessage}${mentionContext}`,
  ].join("\n");

  const defaultProviderId = getDefaultProviderId();

  return {
    prompt,
    title: makeTitle(input.userMessage),
    cwd,
    adapterType:
      persona?.adapterType ||
      defaultAdapterTypeForProvider(
        resolveExecutionProviderId({
          adapterType: persona?.adapterType,
          providerId: persona?.provider,
          defaultProviderId,
        })
      ),
    adapterConfig: persona?.adapterConfig,
    providerId: resolveExecutionProviderId({
      adapterType: persona?.adapterType,
      providerId: persona?.provider,
      defaultProviderId,
    }),
    cabinetPath: input.cabinetPath,
  };
}

export async function buildEditorConversationPrompt(input: {
  pagePath: string;
  userMessage: string;
  mentionedPaths?: string[];
  cabinetPath?: string;
}): Promise<{
  prompt: string;
  title: string;
  cwd?: string;
  mentionedPaths: string[];
  adapterType: string;
  adapterConfig?: Record<string, unknown>;
  providerId: string;
}> {
  const persona =
    (await readPersona("editor", input.cabinetPath)) ||
    (await readPersona("editor")) ||
    (await readLibraryPersona("editor", input.cabinetPath));
  const combinedMentionedPaths = Array.from(
    new Set([input.pagePath, ...(input.mentionedPaths || [])])
  );
  const mentionContext = await buildMentionContext(combinedMentionedPaths);
  const baseCwd = input.cabinetPath ? path.join(DATA_DIR, input.cabinetPath) : DATA_DIR;
  const cwd =
    persona?.workdir && persona.workdir !== "/data"
      ? `${DATA_DIR}/${persona.workdir.replace(/^\/+/, "")}`
      : baseCwd;

  const prompt = [
    buildAgentContextHeader(persona, "editor"),
    "",
    `You are editing the page at /data/${input.pagePath}.`,
    `Prefer making the requested changes directly in ${input.pagePath} unless the task clearly belongs in another KB file.`,
    "Do not assume the target is markdown. Follow the actual file type and Cabinet structure when choosing what to edit.",
    ...buildKnowledgeBaseScopeInstructions(baseCwd, input.cabinetPath),
    "Edit KB files directly and reflect useful outputs in the KB, not only in terminal text.",
    ...buildDiagramOutputInstructions(),
    buildCabinetEpilogueInstructions(),
    "",
    `User request:\n${input.userMessage}${mentionContext}`,
  ].join("\n");

  const defaultProviderId = getDefaultProviderId();

  return {
    prompt,
    title: makeTitle(input.userMessage),
    cwd,
    mentionedPaths: combinedMentionedPaths,
    adapterType:
      persona?.adapterType ||
      defaultAdapterTypeForProvider(
        resolveExecutionProviderId({
          adapterType: persona?.adapterType,
          providerId: persona?.provider,
          defaultProviderId,
        })
      ),
    adapterConfig: persona?.adapterConfig,
    providerId: resolveExecutionProviderId({
      adapterType: persona?.adapterType,
      providerId: persona?.provider,
      defaultProviderId,
    }),
  };
}

export async function startConversationRun(
  input: StartConversationInput
): Promise<ConversationMeta> {
  const resolvedProviderId = input.providerId || getDefaultProviderId();
  const resolvedAdapterType =
    input.adapterType || defaultAdapterTypeForProvider(resolvedProviderId);

  const meta = await createConversation({
    agentSlug: input.agentSlug,
    cabinetPath: input.cabinetPath,
    title: input.title,
    trigger: input.trigger,
    prompt: input.prompt,
    providerId: resolvedProviderId,
    adapterType: resolvedAdapterType,
    adapterConfig: input.adapterConfig,
    mentionedPaths: input.mentionedPaths,
    jobId: input.jobId,
    jobName: input.jobName,
    scheduledAt: input.scheduledAt,
  });

  try {
    await createDaemonSession({
      id: meta.id,
      prompt: input.prompt,
      providerId: resolvedProviderId,
      adapterType: resolvedAdapterType,
      adapterConfig: input.adapterConfig,
      cwd: input.cwd,
      timeoutSeconds: input.timeoutSeconds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start daemon session";
    await appendConversationTranscript(meta.id, `${message}\n`);
    await finalizeConversation(meta.id, {
      status: "failed",
      output: message,
      exitCode: 1,
    });
    throw error;
  }

  if (input.onComplete) {
    void waitForConversationCompletion(meta.id, input.onComplete);
  }

  return meta;
}

export async function waitForConversationCompletion(
  conversationId: string,
  onComplete?: (completion: ConversationCompletion) => Promise<void> | void
): Promise<ConversationCompletion> {
  const deadline = Date.now() + 15 * 60 * 1000;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 3000));

    try {
      const data = await getDaemonSessionOutput(conversationId);
      if (data.status === "running") {
        continue;
      }

      const normalizedStatus = data.status === "completed" ? "completed" : "failed";
      const currentMeta = await readConversationMeta(conversationId);
      const finalMeta =
        currentMeta?.status === "running"
          ? await finalizeConversation(conversationId, {
              status: normalizedStatus,
              output: data.output,
              exitCode: normalizedStatus === "completed" ? 0 : 1,
            })
          : currentMeta;

      if (!finalMeta) {
        throw new Error(`Conversation ${conversationId} disappeared during completion`);
      }

      const completion = {
        meta: finalMeta,
        output: data.output,
        status: normalizedStatus,
      } satisfies ConversationCompletion;

      if (onComplete) {
        await onComplete(completion);
      }

      return completion;
    } catch {
      // Retry until timeout. The daemon can briefly 404 while cleaning up.
    }
  }

  const finalMeta = await finalizeConversation(conversationId, {
    status: "failed",
    output: "Conversation timed out while waiting for completion.",
    exitCode: 124,
  });

  if (!finalMeta) {
    throw new Error(`Conversation ${conversationId} timed out and no metadata was found`);
  }

  const completion = {
    meta: finalMeta,
    output: "Conversation timed out while waiting for completion.",
    status: "failed",
  } satisfies ConversationCompletion;

  if (onComplete) {
    await onComplete(completion);
  }

  return completion;
}

function substituteTemplateVars(text: string, job: JobConfig): string {
  const now = new Date();
  return text
    .replace(/\{\{date\}\}/g, now.toISOString().split("T")[0])
    .replace(/\{\{datetime\}\}/g, now.toISOString())
    .replace(/\{\{job\.name\}\}/g, job.name)
    .replace(/\{\{job\.id\}\}/g, job.id)
    .replace(/\{\{job\.workdir\}\}/g, job.workdir || "/data");
}

async function processPostActions(
  actions: JobPostAction[] | undefined,
  job: JobConfig
): Promise<void> {
  if (!actions || actions.length === 0) return;

  for (const action of actions) {
    try {
      if (action.action === "git_commit") {
        const simpleGit = (await import("simple-git")).default;
        const git = simpleGit(DATA_DIR);
        await git.add(".");
        await git.commit(
          substituteTemplateVars(
            action.message || `Job ${job.name} completed {{date}}`,
            job
          )
        );
      }
    } catch (error) {
      console.error(`Post-action ${action.action} failed:`, error);
    }
  }
}

export async function startJobConversation(
  job: JobConfig,
  options: { scheduledAt?: string } = {}
): Promise<JobRun> {
  const persona = job.agentSlug ? await readPersona(job.agentSlug, job.cabinetPath) : null;
  const defaultProviderId = getDefaultProviderId();
  const jobPrompt = substituteTemplateVars(job.prompt, job);
  const baseCwd = job.cabinetPath ? path.join(DATA_DIR, job.cabinetPath) : DATA_DIR;
  const cwd =
    job.workdir && job.workdir !== "/data" && job.workdir !== "/"
      ? path.join(baseCwd, job.workdir.replace(/^\/+/, ""))
      : persona?.workdir && persona.workdir !== "/data" && persona.workdir !== "/"
        ? path.join(baseCwd, persona.workdir.replace(/^\/+/, ""))
        : baseCwd;

  const prompt = [
    buildAgentContextHeader(persona, job.agentSlug || "agent"),
    "",
    "This is a scheduled or manual Cabinet job.",
    ...buildKnowledgeBaseScopeInstructions(baseCwd, job.cabinetPath),
    "Reflect the results in KB files whenever useful.",
    ...buildDiagramOutputInstructions(),
    buildCabinetEpilogueInstructions(),
    "",
    `Job instructions:\n${jobPrompt}`,
  ].join("\n");

  const meta = await startConversationRun({
    agentSlug: job.agentSlug || "agent",
    title: job.name,
    trigger: "job",
    prompt,
    adapterType:
      job.adapterType ||
      persona?.adapterType ||
      defaultAdapterTypeForProvider(
        resolveExecutionProviderId({
          adapterType: job.adapterType || persona?.adapterType,
          providerId: job.provider || persona?.provider,
          defaultProviderId,
        })
      ),
    adapterConfig: job.adapterConfig || persona?.adapterConfig,
    providerId: resolveExecutionProviderId({
      adapterType: job.adapterType || persona?.adapterType,
      providerId: job.provider || persona?.provider,
      defaultProviderId,
    }),
    jobId: job.id,
    jobName: job.name,
    scheduledAt: options.scheduledAt,
    cabinetPath: job.cabinetPath,
    cwd,
    timeoutSeconds: job.timeout || 600,
    onComplete: async (completion) => {
      if (completion.status === "completed") {
        await processPostActions(job.on_complete, job);
      } else {
        await processPostActions(job.on_failure, job);
      }
    },
  });

  return {
    id: meta.id,
    jobId: job.id,
    status: "running",
    startedAt: meta.startedAt,
    output: "",
  };
}

// ---------------------------------------------------------------------------
// Multi-turn continuation
//
// continueConversationRun appends a user turn, then invokes the adapter
// directly (in-process) to produce an agent turn. Reuses all existing
// prompt builders (buildCabinetEpilogueInstructions, buildMentionContext,
// buildAgentContextHeader, buildKnowledgeBaseScopeInstructions,
// buildDiagramOutputInstructions) so the agent still writes to the KB
// with SUMMARY/CONTEXT/ARTIFACT trailer, cabinet-scoped cwd, persona, etc.
// ---------------------------------------------------------------------------

export interface ContinueConversationInput {
  userMessage: string;
  mentionedPaths?: string[];
  cabinetPath?: string;
  timeoutMs?: number;
}

function serializeTurnHistory(
  turns: { role: "user" | "agent"; content: string; pending?: boolean }[]
): string {
  const parts: string[] = [];
  for (const t of turns) {
    if (t.pending) continue;
    const role = t.role === "user" ? "user" : "assistant";
    parts.push(`<turn-${role}>\n${t.content.trim()}\n</turn-${role}>`);
  }
  return parts.join("\n\n");
}

async function buildContinuationPrompt(options: {
  mode: "resume" | "replay";
  meta: ConversationMeta;
  userMessage: string;
  mentionedPaths: string[];
  persona: AgentPersona | null;
  baseCwd: string;
  priorTurns: { role: "user" | "agent"; content: string; pending?: boolean }[];
}): Promise<string> {
  const mentionContext = await buildMentionContext(options.mentionedPaths);

  if (options.mode === "resume") {
    // Live session: persona + scope already live in the adapter's context.
    return [
      buildCabinetEpilogueInstructions(),
      mentionContext.trim(),
      "",
      `User follow-up:\n${options.userMessage}`,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  // Replay: cold start; rebuild the full agent context and append history.
  return [
    buildAgentContextHeader(options.persona, options.meta.agentSlug),
    "",
    ...buildKnowledgeBaseScopeInstructions(options.baseCwd, options.meta.cabinetPath),
    "Reflect useful outputs in KB files, not only in terminal text.",
    ...buildDiagramOutputInstructions(),
    buildCabinetEpilogueInstructions(),
    "",
    "Prior conversation (for context, do not re-output):",
    serializeTurnHistory(options.priorTurns),
    "",
    `User follow-up:\n${options.userMessage}${mentionContext}`,
  ].join("\n");
}

export async function continueConversationRun(
  conversationId: string,
  input: ContinueConversationInput
): Promise<ConversationMeta | null> {
  const meta = await readConversationMeta(conversationId, input.cabinetPath);
  if (!meta) return null;
  const cp = meta.cabinetPath || input.cabinetPath;

  // 1. Record the user turn immediately.
  await appendUserTurn(
    conversationId,
    {
      content: input.userMessage,
      mentionedPaths: input.mentionedPaths,
    },
    cp
  );

  // 2. Resolve adapter
  const adapterType = meta.adapterType || defaultAdapterTypeForProvider(meta.providerId);
  const adapter = agentAdapterRegistry.get(adapterType);

  if (!adapter || !adapter.execute) {
    await appendAgentTurn(
      conversationId,
      {
        content: `Adapter \`${adapterType}\` is not available for structured conversation runs.`,
        exitCode: 1,
        error: "adapter_unavailable",
      },
      cp
    );
    return readConversationMeta(conversationId, cp);
  }

  // 3. Session handle + mode selection
  const session = await readSession(conversationId, cp);
  const canResume =
    !!adapter.supportsSessionResume && !!session?.alive && !!session.resumeId;

  // 4. Rebuild persona context for replay mode
  const persona =
    meta.agentSlug && meta.agentSlug !== "general"
      ? await readPersona(meta.agentSlug, cp)
      : null;
  const baseCwd = cp ? path.join(DATA_DIR, cp) : DATA_DIR;
  const cwd =
    persona?.workdir && persona.workdir !== "/data"
      ? `${DATA_DIR}/${persona.workdir.replace(/^\/+/, "")}`
      : baseCwd;

  // 5. Assemble prior turns for replay
  const priorTurns = canResume
    ? []
    : (await readConversationTurns(conversationId, cp))
        .filter((t) => !t.pending)
        .map((t) => ({ role: t.role, content: t.content, pending: t.pending }));

  const prompt = await buildContinuationPrompt({
    mode: canResume ? "resume" : "replay",
    meta,
    userMessage: input.userMessage,
    mentionedPaths: input.mentionedPaths || [],
    persona,
    baseCwd,
    priorTurns,
  });

  // 6. Create the pending agent turn
  const pending = await appendAgentTurn(
    conversationId,
    { content: "Working on it…", pending: true },
    cp
  );
  if (!pending) return meta;
  const pendingTurnNumber = pending.turn;

  // 7. Execute adapter
  const logChunks: string[] = [];
  const ctx: AdapterExecutionContext = {
    runId: randomUUID(),
    adapterType: adapter.type,
    config: meta.adapterConfig || {},
    prompt,
    cwd,
    timeoutMs: input.timeoutMs ?? 10 * 60 * 1000,
    sessionId: canResume ? session!.resumeId! : null,
    onLog: async (stream, chunk) => {
      if (stream === "stdout") logChunks.push(chunk);
    },
  };

  try {
    const result = await adapter.execute(ctx);

    const rawOutput =
      (result.output && result.output.trim()) || logChunks.join("").trim() || "";
    const finalText = rawOutput
      ? extractAgentTurnContent(rawOutput) || rawOutput
      : "(no response)";

    const failed =
      result.exitCode !== 0 || !!result.errorMessage || result.timedOut;
    const awaitingInput = !failed && looksLikeAwaitingInput(finalText);

    await updateAgentTurn(
      conversationId,
      pendingTurnNumber,
      {
        content: failed
          ? `${finalText}\n\n_${result.errorMessage || "Adapter failed."}_`
          : rawOutput || finalText,
        pending: false,
        awaitingInput,
        tokens: result.usage
          ? {
              input: result.usage.inputTokens,
              output: result.usage.outputTokens,
              cache: result.usage.cachedInputTokens,
            }
          : undefined,
        sessionId: result.sessionId || undefined,
        exitCode: failed ? result.exitCode ?? 1 : undefined,
        error: failed ? result.errorMessage ?? undefined : undefined,
      },
      cp
    );

    if (result.sessionId) {
      await writeSession(
        conversationId,
        {
          kind: adapter.type,
          resumeId: result.sessionId,
          alive: !result.clearSession,
          lastUsedAt: new Date().toISOString(),
        },
        cp
      );
    } else if (result.clearSession) {
      await writeSession(
        conversationId,
        {
          kind: adapter.type,
          alive: false,
          lastUsedAt: new Date().toISOString(),
        },
        cp
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown adapter error";
    await updateAgentTurn(
      conversationId,
      pendingTurnNumber,
      {
        content: `_Adapter crashed: ${message}_`,
        pending: false,
        exitCode: 1,
        error: message,
      },
      cp
    );
  }

  return readConversationMeta(conversationId, cp);
}

// ---------------------------------------------------------------------------
// Compact
//
// Collapses prior turns into a single digest turn and kills the adapter
// session handle so the next continue starts a fresh session with only the
// digest for context. Freeing up context window without losing task state.
// ---------------------------------------------------------------------------

export interface CompactConversationInput {
  cabinetPath?: string;
  timeoutMs?: number;
}

export async function compactConversation(
  conversationId: string,
  input: CompactConversationInput = {}
): Promise<ConversationMeta | null> {
  const meta = await readConversationMeta(conversationId, input.cabinetPath);
  if (!meta) return null;
  const cp = meta.cabinetPath || input.cabinetPath;

  const turns = await readConversationTurns(conversationId, cp);
  if (turns.length === 0) return meta;

  const adapterType = meta.adapterType || defaultAdapterTypeForProvider(meta.providerId);
  const adapter = agentAdapterRegistry.get(adapterType);

  if (!adapter || !adapter.execute) {
    return meta;
  }

  // Build the compact prompt: full history + instruction to produce a digest.
  const history = serializeTurnHistory(
    turns.map((t) => ({ role: t.role, content: t.content, pending: t.pending }))
  );
  const compactPrompt = [
    "You are compacting a long task conversation into a concise digest.",
    "Produce ONE agent turn that captures:",
    "- the original user goal in one sentence",
    "- what has been done so far (bullet list, ≤8 items)",
    "- open questions or decisions still pending",
    "- relevant KB paths that were created/updated",
    "",
    "Keep it under 200 words. Do NOT restate the full content of prior turns.",
    "End with a short ```cabinet block (SUMMARY only).",
    "",
    "Prior conversation:",
    history,
  ].join("\n");

  const baseCwd = cp ? path.join(DATA_DIR, cp) : DATA_DIR;

  // Append a pending compaction turn so the UI shows progress.
  const pending = await appendAgentTurn(
    conversationId,
    { content: "Compacting…", pending: true },
    cp
  );
  if (!pending) return meta;

  const logChunks: string[] = [];
  const ctx: AdapterExecutionContext = {
    runId: randomUUID(),
    adapterType: adapter.type,
    config: meta.adapterConfig || {},
    prompt: compactPrompt,
    cwd: baseCwd,
    timeoutMs: input.timeoutMs ?? 3 * 60 * 1000,
    sessionId: null,
    onLog: async (stream, chunk) => {
      if (stream === "stdout") logChunks.push(chunk);
    },
  };

  try {
    const result = await adapter.execute(ctx);
    const rawOutput =
      (result.output && result.output.trim()) || logChunks.join("").trim() || "";
    const digest = rawOutput
      ? extractAgentTurnContent(rawOutput) || rawOutput
      : "Compaction produced no digest.";

    await updateAgentTurn(
      conversationId,
      pending.turn,
      {
        content: `**Compacted digest**\n\n${digest}`,
        pending: false,
        tokens: result.usage
          ? {
              input: result.usage.inputTokens,
              output: result.usage.outputTokens,
              cache: result.usage.cachedInputTokens,
            }
          : undefined,
      },
      cp
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown compact error";
    await updateAgentTurn(
      conversationId,
      pending.turn,
      {
        content: `_Compaction failed: ${message}_`,
        pending: false,
        exitCode: 1,
        error: message,
      },
      cp
    );
    return readConversationMeta(conversationId, cp);
  }

  // Kill the session so the next continue replays from the digest only.
  await writeSession(
    conversationId,
    {
      kind: adapter.type,
      alive: false,
      lastUsedAt: new Date().toISOString(),
    },
    cp
  );

  return readConversationMeta(conversationId, cp);
}
