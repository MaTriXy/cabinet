/**
 * Centralized drop-target id prefixes. Both the Kanban grid and the
 * People rail register droppables under one shared DndContext; these
 * prefixes let the drag-end handler tell them apart.
 */
export const LANE_DROP_PREFIX = "lane:";
export const CARD_DROP_PREFIX = "card:";
export const AGENT_DROP_PREFIX = "agent:";

import type { LaneKey } from "./lane-rules";

export function laneDropId(lane: LaneKey): string {
  return `${LANE_DROP_PREFIX}${lane}`;
}
export function cardDropId(taskId: string): string {
  return `${CARD_DROP_PREFIX}${taskId}`;
}
export function agentDropId(slug: string): string {
  return `${AGENT_DROP_PREFIX}${slug}`;
}
