"use client";

import { Pause } from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import { getAgentColor, tintFromHex } from "@/lib/agents/cron-compute";
import { resolveAgentIcon } from "@/lib/agents/icon-catalog";
import type { CabinetAgentSummary } from "@/types/cabinets";
import { agentDropId } from "./dnd-keys";

/**
 * Phase 4: each agent avatar becomes a drop target. Dragging a card onto
 * an agent reassigns the conversation. Paused agents accept drops (per
 * PRD §7.2 — pausing disables cron, not manual work).
 */
export function PeopleRail({ agents }: { agents: CabinetAgentSummary[] }) {
  if (agents.length === 0) return null;
  return (
    <aside className="group/rail relative z-10 flex h-full w-12 shrink-0 flex-col gap-1 border-l border-border/60 bg-background/80 backdrop-blur transition-[width] duration-200 hover:w-56">
      <div className="px-2 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground opacity-0 transition-opacity group-hover/rail:opacity-100">
        Agents
      </div>
      {agents.map((agent) => (
        <DroppableAgent key={agent.scopedId} agent={agent} />
      ))}
      <div className="mt-auto px-2 py-2 text-[10px] leading-snug text-muted-foreground opacity-0 transition-opacity group-hover/rail:opacity-100">
        Drop a card on an agent to hand off.
      </div>
    </aside>
  );
}

function DroppableAgent({ agent }: { agent: CabinetAgentSummary }) {
  const { setNodeRef, isOver } = useDroppable({
    id: agentDropId(agent.slug),
    data: { agentSlug: agent.slug },
  });
  const tint = agent.color ? tintFromHex(agent.color) : getAgentColor(agent.slug);
  const Icon = resolveAgentIcon(agent.slug, agent.iconKey ?? null);
  const paused = !agent.active;
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "mx-1 flex items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors",
        isOver && "ring-2 ring-offset-1 ring-offset-background",
        !isOver && "hover:bg-muted/60"
      )}
      style={isOver ? { boxShadow: `0 0 0 2px ${tint.text}` } : undefined}
      title={`Hand off to ${agent.displayName ?? agent.name}${paused ? " (paused)" : ""}`}
    >
      <span
        className="relative inline-flex size-8 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: tint.bg, color: tint.text }}
      >
        <Icon className="size-4" />
        {paused && (
          <span className="absolute -bottom-0.5 -right-0.5 inline-flex size-3 items-center justify-center rounded-full bg-background ring-1 ring-border">
            <Pause className="size-2 text-muted-foreground" />
          </span>
        )}
      </span>
      <span className="flex-1 overflow-hidden whitespace-nowrap opacity-0 transition-opacity group-hover/rail:opacity-100">
        <span className="block text-[12px] font-medium leading-tight text-foreground">
          {agent.displayName ?? agent.name}
        </span>
        <span className="block text-[10px] leading-tight text-muted-foreground">
          {paused ? "Paused" : "Ready"}
        </span>
      </span>
    </div>
  );
}
