export type ConversationTrigger = "manual" | "job" | "heartbeat";
export type ConversationSource = "manual" | "editor";

export type ConversationStatus =
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type TurnRole = "user" | "agent";

/**
 * Canonical error taxonomy for a failed conversation turn. Each adapter's
 * classifyError() maps stderr + exit code into one of these kinds so the UI
 * can offer targeted remediation without knowing which provider was used.
 */
export type ConversationErrorKind =
  | "cli_not_found"
  | "auth_expired"
  | "rate_limited"
  | "session_expired"
  | "context_exceeded"
  | "transport"
  | "timeout"
  | "unknown";

export interface ConversationErrorClassification {
  kind: ConversationErrorKind;
  hint?: string;
  retryAfterSec?: number;
}

export interface ConversationResumeAttempt {
  at: string;
  result: "resumed" | "replayed" | "failed";
  reason?: string;
}

export interface ConversationArtifact {
  path: string;
  label?: string;
}

export interface TurnTokens {
  input: number;
  output: number;
  cache?: number;
}

export interface ConversationTurn {
  id: string;
  turn: number;
  role: TurnRole;
  ts: string;
  content: string;
  sessionId?: string;
  tokens?: TurnTokens;
  awaitingInput?: boolean;
  pending?: boolean;
  exitCode?: number | null;
  error?: string;
  mentionedPaths?: string[];
  artifacts?: string[];
}

export interface SessionHandle {
  kind: string;
  resumeId?: string;
  threadId?: string;
  alive: boolean;
  lastUsedAt?: string;
  /**
   * Adapter-agnostic blob produced by `adapter.sessionCodec.serialize(result.sessionParams)`.
   * Rehydrated by `adapter.sessionCodec.deserialize(codecBlob)` on the next continue
   * and passed to `ctx.sessionParams`. Only populated for adapters that declare
   * a `sessionCodec`.
   */
  codecBlob?: Record<string, unknown> | null;
  /** Optional user-facing display id produced by `sessionCodec.getDisplayId`. */
  displayId?: string;
}

export interface ConversationTokens {
  input: number;
  output: number;
  cache?: number;
  total: number;
}

export interface ConversationMeta {
  id: string;
  agentSlug: string;
  cabinetPath?: string;
  title: string;
  trigger: ConversationTrigger;
  status: ConversationStatus;
  startedAt: string;
  completedAt?: string;
  exitCode?: number | null;
  jobId?: string;
  jobName?: string;
  scheduledAt?: string;
  providerId?: string;
  adapterType?: string;
  adapterConfig?: Record<string, unknown>;
  promptPath: string;
  transcriptPath: string;
  mentionedPaths: string[];
  artifactPaths: string[];
  summary?: string;
  contextSummary?: string;

  // Multi-turn extensions (v2)
  turnCount?: number;
  lastActivityAt?: string;
  tokens?: ConversationTokens;
  runtime?: {
    contextWindow?: number;
  };
  doneAt?: string;
  archivedAt?: string;
  awaitingInput?: boolean;
  titlePinned?: boolean;
  summaryEditedAt?: string;

  /** Classified failure kind from the last failed run. Cleared on success. */
  errorKind?: ConversationErrorKind;
  /** Human-facing remediation hint for `errorKind`. */
  errorHint?: string;
  /** Seconds to wait before retry when `errorKind === "rate_limited"`. */
  errorRetryAfterSec?: number;
  /** Most recent resume/replay outcome. Written by the runner every turn. */
  lastResumeAttempt?: ConversationResumeAttempt;
}

export interface ConversationDetail {
  meta: ConversationMeta;
  prompt: string;
  request: string;
  transcript: string;
  rawTranscript: string;
  mentions: string[];
  artifacts: ConversationArtifact[];
  turns?: ConversationTurn[];
  session?: SessionHandle | null;
}

export interface ConversationRuntimeOverride {
  providerId?: string;
  adapterType?: string;
  model?: string;
  effort?: string;
}

export interface CreateConversationRequest extends ConversationRuntimeOverride {
  source?: ConversationSource;
  agentSlug?: string;
  userMessage: string;
  mentionedPaths?: string[];
  cabinetPath?: string;
  pagePath?: string;
}

export interface CreateConversationResponse {
  ok: boolean;
  conversation: ConversationMeta;
}
