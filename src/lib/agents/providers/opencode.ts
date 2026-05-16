import type { AgentProvider, ProviderStatus } from "../provider-interface";
import {
  checkCliProviderAvailable,
  execCli,
  resolveCliCommand,
} from "../provider-cli";

const OPENCODE_VARIANT_LEVELS = [
  { id: "minimal", name: "Minimal", description: "Skip extra reasoning" },
  { id: "low", name: "Low", description: "Quick reasoning" },
  { id: "medium", name: "Medium", description: "Balanced depth" },
  { id: "high", name: "High", description: "Thorough reasoning" },
  { id: "xhigh", name: "Extra High", description: "Maximum depth" },
  { id: "max", name: "Max", description: "Provider max effort" },
] as const;

// Used only when `opencode models` discovery fails (CLI not installed or
// not authed). OpenCode reaches the API directly so we can't include
// ChatGPT-only ids like `gpt-5.5` here. Refreshed 2026-05-03.
const OPENCODE_FALLBACK_MODELS = [
  { id: "openai/gpt-5.4", name: "openai/gpt-5.4" },
  { id: "openai/gpt-5.4-mini", name: "openai/gpt-5.4-mini" },
  { id: "openai/gpt-5.3-codex", name: "openai/gpt-5.3-codex" },
  { id: "anthropic/claude-opus-4-7", name: "anthropic/claude-opus-4-7" },
  { id: "anthropic/claude-sonnet-4-6", name: "anthropic/claude-sonnet-4-6" },
  { id: "google/gemini-3.1-pro", name: "google/gemini-3.1-pro" },
  { id: "xai/grok-4.3", name: "xai/grok-4.3" },
] as const;

function withVariants<T extends { id: string; name: string }>(models: readonly T[]) {
  return models.map((model) => ({
    ...model,
    effortLevels: [...OPENCODE_VARIANT_LEVELS],
  }));
}

/**
 * Pure parser for `opencode models` stdout. Each usable line is a
 * `vendor/model` id (the command is entitlement-gated server-side — it only
 * lists providers the user has authed + the always-on OpenCode Zen subset).
 * Lines without a `/` are CLI chrome/noise and are dropped. Empty output →
 * the offline fallback list so the picker is never blank.
 */
export function parseOpenCodeModels(stdout: string | null | undefined) {
  const out = (stdout || "").trim();
  if (!out) return withVariants(OPENCODE_FALLBACK_MODELS);
  const parsed = out
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && line.includes("/"))
    .map((id) => ({
      id,
      name: id,
      effortLevels: [...OPENCODE_VARIANT_LEVELS],
    }));
  return parsed.length > 0 ? parsed : withVariants(OPENCODE_FALLBACK_MODELS);
}

export const openCodeProvider: AgentProvider = {
  id: "opencode",
  name: "OpenCode",
  type: "cli",
  icon: "opencode",
  iconAsset: "/providers/opencode.svg",
  installMessage:
    "OpenCode CLI not found. Install with: npm i -g opencode-ai",
  installSteps: [
    {
      title: "Install OpenCode",
      detail: "Run the following in your terminal:",
      command: "npm i -g opencode-ai",
    },
    {
      title: "Configure a provider",
      detail:
        "OpenCode routes to many providers. Configure at least one (OpenAI, Anthropic, OpenRouter, etc.) via environment variables or `opencode auth`.",
      command: "opencode auth",
      link: {
        label: "OpenCode docs",
        url: "https://opencode.ai/docs",
      },
    },
    {
      title: "Verify setup",
      detail: "Confirm headless mode works:",
      command: "opencode run 'Reply with exactly OK'",
    },
  ],
  detachedPromptLaunchMode: "one-shot",
  supportsTerminalResume: true,
  models: OPENCODE_FALLBACK_MODELS.map((model) => ({
    id: model.id,
    name: model.name,
    effortLevels: [...OPENCODE_VARIANT_LEVELS],
  })),
  effortLevels: [...OPENCODE_VARIANT_LEVELS],
  command: "opencode",
  commandCandidates: [
    `${process.env.HOME || ""}/.local/bin/opencode`,
    "/usr/local/bin/opencode",
    "/opt/homebrew/bin/opencode",
    "opencode",
  ],

  buildArgs(prompt: string, _workdir: string): string[] {
    return ["run", prompt];
  },

  buildOneShotInvocation(prompt: string, workdir: string, opts) {
    const baseArgs = this.buildArgs ? this.buildArgs(prompt, workdir) : [];
    const args = [...baseArgs];
    if (opts?.model) {
      args.push("--model", opts.model);
    }
    if (opts?.effort) {
      args.push("--variant", opts.effort);
    }
    if (opts?.resumeId) {
      args.push("--session", opts.resumeId);
    }
    return {
      command: this.command || "opencode",
      args,
    };
  },

  async listModels() {
    try {
      const cmd = resolveCliCommand(this);
      // Steady state this is a local cache read (~/.cache/opencode/models.json),
      // but the very first run on a fresh machine populates that cache from
      // models.dev — give it headroom so cold starts don't fall back.
      const out = await execCli(cmd, ["models"], { timeout: 15_000 });
      return parseOpenCodeModels(out);
    } catch {
      return withVariants(OPENCODE_FALLBACK_MODELS);
    }
  },

  async isAvailable(): Promise<boolean> {
    return checkCliProviderAvailable(this);
  },

  async healthCheck(): Promise<ProviderStatus> {
    try {
      const available = await this.isAvailable();
      if (!available) {
        return {
          available: false,
          authenticated: false,
          error: this.installMessage,
        };
      }

      try {
        const cmd = resolveCliCommand(this);
        const version = await execCli(cmd, ["--version"], { timeout: 5000 });

        return {
          available: true,
          authenticated: true,
          version: version ? `OpenCode ${version}` : "OpenCode installed",
        };
      } catch {
        return {
          available: true,
          authenticated: false,
          error: "OpenCode is installed but not verified. Configure a provider (e.g. OPENAI_API_KEY).",
        };
      }
    } catch (error) {
      return {
        available: false,
        authenticated: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};
