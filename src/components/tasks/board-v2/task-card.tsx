"use client";

import { Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { isLegacyAdapterType } from "@/lib/agents/adapters/legacy-ids";
import type { TaskMeta } from "@/types/tasks";
import type { CabinetAgentSummary } from "@/types/cabinets";
import type { LaneKey } from "./lane-rules";
import { AgentPill } from "./agent-pill";
import { StatusIcon, deriveCardState } from "./status-icon";

function relTime(fromIso: string | undefined, now: number): string {
  if (!fromIso) return "";
  const mins = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function TaskCard({
  task,
  lane,
  agent,
  isActive,
  now,
  onClick,
}: {
  task: TaskMeta;
  lane: LaneKey;
  agent: CabinetAgentSummary | undefined;
  isActive: boolean;
  now: number;
  onClick: () => void;
}) {
  const state = deriveCardState(task, lane);
  const lastActivity = task.lastActivityAt ?? task.startedAt;
  const isTerminal = isLegacyAdapterType(task.adapterType);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative w-full rounded-md border bg-card p-3 text-left transition-all",
        "hover:border-foreground/30 hover:shadow-sm",
        isActive ? "border-foreground/50 shadow-sm" : "border-border/60",
        isTerminal &&
          "border-l-2 border-l-emerald-500/60 bg-[linear-gradient(to_right,rgba(16,185,129,0.035),transparent_30%)]"
      )}
    >
      <div className="flex items-center gap-2">
        <StatusIcon state={state} />
        <AgentPill agent={agent} slug={task.agentSlug ?? "general"} />
        {isTerminal && (
          <span
            title="Running in terminal (PTY) mode"
            className="ml-auto inline-flex items-center gap-0.5 rounded bg-emerald-500/15 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400"
          >
            <Terminal className="size-2.5" />
            PTY
          </span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-[13px] leading-snug text-foreground">
        {task.title}
      </p>
      <div className="mt-2 flex items-center gap-2 text-[10.5px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
        <span>{relTime(lastActivity, now)}</span>
      </div>
    </button>
  );
}
