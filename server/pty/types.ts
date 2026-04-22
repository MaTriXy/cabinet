import type { WebSocket } from "ws";
import type * as pty from "node-pty";
import type { ClaudeStreamAccumulator } from "../../src/lib/agents/adapters/claude-stream";

export type SessionResolutionStatus = "completed" | "failed";

/**
 * Fields shared by every active session (PTY and structured). Kept here so
 * the PTY module can take `BaseSession`-typed arguments without having to
 * know about `StructuredSession`.
 */
export interface BaseSession {
  id: string;
  kind: "pty" | "structured";
  providerId: string;
  adapterType?: string;
  ws: WebSocket | null;
  createdAt: Date;
  output: string[];
  exited: boolean;
  exitCode: number | null;
  resolvedStatus?: SessionResolutionStatus;
  resolvingStatus?: boolean;
  stopFallbackTimer?: NodeJS.Timeout;
  stop: (signal?: NodeJS.Signals) => void;
}

export interface PtySession extends BaseSession {
  kind: "pty";
  pty: pty.IPty;
  timeoutHandle?: NodeJS.Timeout;
  initialPrompt?: string;
  initialPromptSent?: boolean;
  initialPromptTimer?: NodeJS.Timeout;
  promptSubmittedOutputLength?: number;
  autoExitRequested?: boolean;
  autoExitFallbackTimer?: NodeJS.Timeout;
  claudeCompletionTimer?: NodeJS.Timeout;
  readyStrategy?: "claude";
  outputMode?: "plain" | "claude-stream-json";
  structuredOutput?: ClaudeStreamAccumulator;
  /** Cabinet-block stream-extraction debounce timer. */
  streamExtractionTimer?: NodeJS.Timeout;
  /** Fingerprint of the last stream-extracted cabinet block, to avoid re-applying. */
  streamExtractionFingerprint?: string;
}

export interface CompletedOutputEntry {
  output: string;
  completedAt: number;
}
