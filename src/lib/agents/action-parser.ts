import type { AgentAction, AgentActionType } from "@/types/actions";
import { MAX_ACTIONS_PER_TURN } from "@/types/actions";

const CABINET_ACTIONS_RE = /```cabinet-actions\s*([\s\S]*?)```/gi;
const CABINET_BLOCK_RE = /```cabinet\s*([\s\S]*?)```/gi;
const INLINE_RE =
  /^(LAUNCH_TASK|SCHEDULE_JOB|SCHEDULE_TASK)\s*:\s*(.+)$/;

export interface ParseAgentActionsResult {
  actions: AgentAction[];
  truncated: boolean;
}

export function parseAgentActions(
  output: string,
  prompt?: string
): ParseAgentActionsResult {
  const promptFingerprints = prompt ? fingerprintsFromPrompt(prompt) : new Set<string>();

  const seen = new Set<string>();
  const actions: AgentAction[] = [];
  let truncated = false;

  const push = (action: AgentAction | null) => {
    if (!action) return;
    if (actions.length >= MAX_ACTIONS_PER_TURN) {
      truncated = true;
      return;
    }
    const fp = fingerprint(action);
    if (seen.has(fp)) return;
    if (promptFingerprints.has(fp)) return;
    seen.add(fp);
    actions.push(action);
  };

  // Prefer JSON blocks first — they're authoritative for multi-line prompts.
  for (const match of output.matchAll(CABINET_ACTIONS_RE)) {
    for (const action of parseJsonBlock(match[1])) {
      push(action);
    }
  }

  // Then inline markers inside any ```cabinet block.
  for (const match of output.matchAll(CABINET_BLOCK_RE)) {
    for (const line of match[1].split("\n")) {
      const action = parseInlineLine(line);
      if (action) push(action);
    }
  }

  // Finally: stray inline markers outside any fenced block. Some CLIs strip
  // fencing from their final turn output; this keeps the protocol forgiving.
  for (const line of output.split("\n")) {
    if (INLINE_RE.test(line)) {
      const action = parseInlineLine(line);
      if (action) push(action);
    }
  }

  return { actions, truncated };
}

function parseJsonBlock(body: string): AgentAction[] {
  const trimmed = body.trim();
  if (!trimmed) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return [];
  }

  const arr = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray((parsed as Record<string, unknown>).actions)
      ? ((parsed as Record<string, unknown>).actions as unknown[])
      : [parsed];

  const out: AgentAction[] = [];
  for (const raw of arr) {
    const action = coerceJsonAction(raw);
    if (action) out.push(action);
  }
  return out;
}

function parseInlineLine(rawLine: string): AgentAction | null {
  const line = rawLine.trim();
  if (!line) return null;
  const match = INLINE_RE.exec(line);
  if (!match) return null;
  const type = match[1] as AgentActionType;
  const parts = splitPipe(match[2]);

  if (type === "LAUNCH_TASK") {
    if (parts.length < 3) return null;
    const [agent, title, ...rest] = parts;
    const prompt = rest.join(" | ").trim();
    if (!agent || !title || !prompt) return null;
    return { type, agent, title, prompt };
  }
  if (type === "SCHEDULE_JOB") {
    if (parts.length < 4) return null;
    const [agent, name, schedule, ...rest] = parts;
    const prompt = rest.join(" | ").trim();
    if (!agent || !name || !schedule || !prompt) return null;
    return { type, agent, name, schedule, prompt };
  }
  if (type === "SCHEDULE_TASK") {
    if (parts.length < 4) return null;
    const [agent, when, title, ...rest] = parts;
    const prompt = rest.join(" | ").trim();
    if (!agent || !when || !title || !prompt) return null;
    return { type, agent, when, title, prompt };
  }
  return null;
}

function coerceJsonAction(raw: unknown): AgentAction | null {
  if (!isRecord(raw)) return null;
  const type = String(raw.type || "").toUpperCase() as AgentActionType;
  const agent = pickString(raw, ["agent", "agentSlug", "to", "target"]);
  if (!agent) return null;

  if (type === "LAUNCH_TASK") {
    const title = pickString(raw, ["title", "name"]);
    const prompt = pickString(raw, ["prompt", "description", "body"]);
    if (!title || !prompt) return null;
    return { type, agent, title, prompt };
  }
  if (type === "SCHEDULE_JOB") {
    const name = pickString(raw, ["name", "title"]);
    const schedule = pickString(raw, ["schedule", "cron"]);
    const prompt = pickString(raw, ["prompt", "description", "body"]);
    if (!name || !schedule || !prompt) return null;
    return { type, agent, name, schedule, prompt };
  }
  if (type === "SCHEDULE_TASK") {
    const when = pickString(raw, ["when", "at", "runAt", "scheduleAt"]);
    const title = pickString(raw, ["title", "name"]);
    const prompt = pickString(raw, ["prompt", "description", "body"]);
    if (!when || !title || !prompt) return null;
    return { type, agent, when, title, prompt };
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickString(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = source[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function splitPipe(value: string): string[] {
  return value
    .split("|")
    .map((s) => s.trim())
    .filter((s, i, arr) => s.length > 0 || i < arr.length - 1);
}

export function fingerprint(action: AgentAction): string {
  switch (action.type) {
    case "LAUNCH_TASK":
      return `LAUNCH_TASK:${action.agent}:${action.title}:${action.prompt}`;
    case "SCHEDULE_JOB":
      return `SCHEDULE_JOB:${action.agent}:${action.name}:${action.schedule}:${action.prompt}`;
    case "SCHEDULE_TASK":
      return `SCHEDULE_TASK:${action.agent}:${action.when}:${action.title}:${action.prompt}`;
  }
}

function fingerprintsFromPrompt(prompt: string): Set<string> {
  const out = new Set<string>();
  const { actions } = parseAgentActionsInternal(prompt);
  for (const a of actions) out.add(fingerprint(a));
  return out;
}

// Internal re-entry used only by fingerprintsFromPrompt to avoid the
// prompt-fingerprint filter when scanning the prompt itself.
function parseAgentActionsInternal(output: string): ParseAgentActionsResult {
  const seen = new Set<string>();
  const actions: AgentAction[] = [];

  const push = (action: AgentAction | null) => {
    if (!action) return;
    const fp = fingerprint(action);
    if (seen.has(fp)) return;
    seen.add(fp);
    actions.push(action);
  };

  for (const match of output.matchAll(CABINET_ACTIONS_RE)) {
    for (const action of parseJsonBlock(match[1])) push(action);
  }
  for (const match of output.matchAll(CABINET_BLOCK_RE)) {
    for (const line of match[1].split("\n")) {
      push(parseInlineLine(line));
    }
  }
  for (const line of output.split("\n")) {
    if (INLINE_RE.test(line)) push(parseInlineLine(line));
  }

  return { actions, truncated: false };
}
