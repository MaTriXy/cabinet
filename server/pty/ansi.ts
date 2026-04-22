/**
 * ANSI escape + control-char stripping. Used by both the PTY lifecycle (to
 * turn raw TUI output into something plain-text-searchable for cabinet-block
 * extraction, summaries, transcript syncing) and by structured-session
 * finalizers in the daemon (for the same reason — adapter stderr can contain
 * colored diagnostic output).
 */
export function stripAnsi(str: string): string {
  return str
    .replace(/\x1B\][^\x07]*(?:\x07|\x1B\\)/g, "")
    .replace(/\x1B[P^_][\s\S]*?\x1B\\/g, "")
    .replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\x1B[@-_]/g, "")
    .replace(/[\x00-\x08\x0B-\x1A\x1C-\x1F\x7F]/g, "");
}
