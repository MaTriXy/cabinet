"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildConversationInstanceKey } from "@/lib/agents/conversation-identity";
import { deriveStatus } from "@/lib/agents/conversation-to-task-view";
import { AgentPill } from "@/components/tasks/board-v2/agent-pill";
import { StatusIcon, type CardState } from "@/components/tasks/board-v2/status-icon";
import { ProviderGlyph } from "@/components/agents/provider-glyph";
import { useProviderIcons } from "@/hooks/use-provider-icons";
import { formatRelative } from "./cabinet-utils";
import type { ConversationMeta } from "@/types/conversations";
import type { CabinetAgentSummary } from "@/types/cabinets";
import type { TaskStatus } from "@/types/tasks";

interface ActivityFeedProps {
  cabinetPath: string;
  visibilityMode: string;
  agents: CabinetAgentSummary[];
  onOpen: (conv: ConversationMeta) => void;
  onOpenWorkspace: () => void;
}

const TASK_STATUS_TO_CARD_STATE: Record<TaskStatus, CardState> = {
  running: "running",
  "awaiting-input": "ask",
  failed: "failed",
  done: "just-done",
  idle: "idle",
  archived: "idle",
};

export function ActivityFeed({
  cabinetPath,
  visibilityMode,
  agents,
  onOpen,
  onOpenWorkspace,
}: ActivityFeedProps) {
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const providerIcons = useProviderIcons();

  const agentsBySlug = useMemo(() => {
    const m = new Map<string, CabinetAgentSummary>();
    for (const a of agents) m.set(a.slug, a);
    return m;
  }, [agents]);

  const refresh = useCallback(async () => {
    try {
      const params = new URLSearchParams({ cabinetPath, limit: "20" });
      if (visibilityMode !== "own") params.set("visibilityMode", visibilityMode);
      const res = await fetch(`/api/agents/conversations?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setConversations((data.conversations || []) as ConversationMeta[]);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [cabinetPath, visibilityMode]);

  useEffect(() => {
    void refresh();
    const iv = setInterval(() => void refresh(), 6000);
    return () => clearInterval(iv);
  }, [refresh]);

  // Pin running conversations to top
  const sorted = useMemo(() => {
    const running = conversations.filter((c) => c.status === "running");
    const rest = conversations.filter((c) => c.status !== "running");
    return [...running, ...rest];
  }, [conversations]);

  const runningCount = sorted.filter((c) => c.status === "running").length;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-[1.65rem] font-semibold tracking-tight text-foreground">
            Activity
          </h2>
          <p className="text-[12px] text-muted-foreground">
            {loading ? "Loading..." : `${conversations.length} recent`}
            {runningCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-emerald-500">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {runningCount} running
              </span>
            )}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-2 text-xs"
          onClick={onOpenWorkspace}
        >
          <Users className="h-3.5 w-3.5" />
          View all
        </Button>
      </div>

      {/* Feed */}
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading activity...
        </div>
      ) : sorted.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          No conversations yet. Run a heartbeat or send a task to an agent.
        </p>
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-card">
          {sorted.map((conv) => {
            const cardState = TASK_STATUS_TO_CARD_STATE[deriveStatus(conv)];
            const agent = agentsBySlug.get(conv.agentSlug);
            const providerIcon = conv.providerId
              ? providerIcons.get(conv.providerId)
              : null;
            const tokens = conv.tokens?.total ?? 0;
            return (
              <li key={buildConversationInstanceKey(conv)}>
                <button
                  type="button"
                  onClick={() => onOpen(conv)}
                  className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/40"
                >
                  {/* Left: status + agent pill */}
                  <div className="flex shrink-0 items-center gap-2 pt-0.5">
                    <StatusIcon state={cardState} />
                    <AgentPill agent={agent} slug={conv.agentSlug} size="sm" />
                  </div>

                  {/* Center: title + summary */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-foreground">
                      {conv.title}
                    </p>
                    {conv.summary ? (
                      <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">
                        {conv.summary}
                      </p>
                    ) : null}
                  </div>

                  {/* Right: time + glyph / tokens */}
                  <div className="ml-2 flex shrink-0 flex-col items-end gap-0.5 pt-0.5 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <span className="tabular-nums">
                        {formatRelative(conv.lastActivityAt || conv.startedAt)}
                      </span>
                      {providerIcon ? (
                        <span
                          className="inline-flex size-4 items-center justify-center rounded border border-border/60 bg-muted/30"
                          title={providerIcon.name}
                        >
                          <ProviderGlyph
                            icon={providerIcon.icon}
                            asset={providerIcon.iconAsset}
                            className="size-2.5"
                          />
                        </span>
                      ) : null}
                    </div>
                    {tokens > 0 ? (
                      <span className="font-mono tabular-nums text-muted-foreground/80">
                        {(tokens / 1000).toFixed(1)}k tok
                      </span>
                    ) : null}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
