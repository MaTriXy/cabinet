"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, Loader2, ShieldAlert, X } from "lucide-react";
import type {
  ActionWarning,
  AgentAction,
  DispatchedAction,
  PendingAction,
} from "@/types/actions";
import { HARD_WARNINGS } from "@/types/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TYPE_COLORS: Record<string, string> = {
  LAUNCH_TASK: "bg-pink-500/15 text-pink-400 border-pink-500/20",
  SCHEDULE_JOB: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  SCHEDULE_TASK: "bg-violet-500/15 text-violet-400 border-violet-500/20",
};

const VISIBLE_ROW_CAP = 100;

function actionHeadline(action: AgentAction): string {
  if (action.type === "SCHEDULE_JOB") {
    return `${action.agent} · ${action.name} · ${action.schedule}`;
  }
  if (action.type === "SCHEDULE_TASK") {
    return `${action.agent} · ${action.title} · ${action.when}`;
  }
  return `${action.agent} · ${action.title}`;
}

function hasHard(warnings: ActionWarning[]): boolean {
  return warnings.some((w) => HARD_WARNINGS.has(w.code));
}

export interface PendingActionsPanelProps {
  conversationId: string;
  cabinetPath?: string;
  pending: PendingAction[];
  dispatched?: DispatchedAction[];
  onRefresh?: () => void;
}

export function PendingActionsPanel({
  conversationId,
  cabinetPath,
  pending,
  dispatched,
  onRefresh,
}: PendingActionsPanelProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState<null | "approve" | "reject">(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const blockedByDispatcher = useMemo(
    () =>
      pending.length > 0 &&
      pending[0].warnings.some((w) => w.code === "persona_cannot_dispatch"),
    [pending]
  );

  const approvable = useMemo(
    () => pending.filter((item) => !hasHard(item.warnings)),
    [pending]
  );

  const allApprovableSelected =
    approvable.length > 0 && approvable.every((item) => selected.has(item.id));

  const visibleRows = showAll ? pending : pending.slice(0, VISIBLE_ROW_CAP);
  const hiddenCount = Math.max(0, pending.length - visibleRows.length);

  const toggle = (id: string, hard: boolean) => {
    if (hard) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(approvable.map((item) => item.id)));
  };

  const clearSelection = () => {
    setSelected(new Set());
  };

  const submit = async (mode: "approve" | "reject", ids: string[]) => {
    if (ids.length === 0) return;
    setSubmitting(mode);
    setError(null);
    try {
      const body: Record<string, unknown> = { cabinetPath };
      if (mode === "approve") body.approve = ids;
      else body.reject = ids;
      const res = await fetch(
        `/api/agents/conversations/${encodeURIComponent(conversationId)}/actions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }
      clearSelection();
      onRefresh?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(null);
    }
  };

  const pendingApproveIds = [...selected];
  const rejectIds = Array.from(selected);

  if (pending.length === 0 && (!dispatched || dispatched.length === 0)) {
    return null;
  }

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-border bg-muted/10">
      <header className="flex items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-3.5 text-amber-400" />
          <h3 className="text-[12px] font-semibold">
            {pending.length > 0
              ? `Agent proposed ${pending.length} action${pending.length === 1 ? "" : "s"}`
              : `Actions resolved`}
          </h3>
          {dispatched && dispatched.length > 0 && (
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {dispatched.filter((a) => a.status === "dispatched").length} dispatched ·{" "}
              {dispatched.filter((a) => a.status === "rejected").length} rejected
            </span>
          )}
        </div>
        {pending.length > 0 && !blockedByDispatcher && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={allApprovableSelected ? clearSelection : selectAll}
              disabled={submitting !== null}
            >
              {allApprovableSelected ? "Deselect all" : "Select all"}
            </Button>
            <span className="mx-1 h-4 w-px bg-border" aria-hidden />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-[11px] text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
              disabled={submitting !== null || pending.length === 0}
              onClick={() =>
                void submit(
                  "reject",
                  pending.map((item) => item.id)
                )
              }
              title="Reject every pending action"
            >
              {submitting === "reject" && selected.size === 0 ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <X className="size-3" />
              )}
              Reject all ({pending.length})
            </Button>
            <Button
              variant="default"
              size="sm"
              className="h-7 gap-1 px-2 text-[11px]"
              disabled={submitting !== null || approvable.length === 0}
              onClick={() =>
                void submit(
                  "approve",
                  approvable.map((item) => item.id)
                )
              }
              title="Approve and dispatch every action that has no hard blockers"
            >
              {submitting === "approve" && selected.size === 0 ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Check className="size-3" />
              )}
              Approve all ({approvable.length})
            </Button>
            {selected.size > 0 && (
              <>
                <span className="mx-1 h-4 w-px bg-border" aria-hidden />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-[11px] text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                  disabled={submitting !== null}
                  onClick={() => void submit("reject", rejectIds)}
                >
                  <X className="size-3" /> Reject selected
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 gap-1 px-2 text-[11px]"
                  disabled={submitting !== null}
                  onClick={() => void submit("approve", pendingApproveIds)}
                >
                  {submitting === "approve" ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Check className="size-3" />
                  )}
                  Approve selected ({selected.size})
                </Button>
              </>
            )}
          </div>
        )}
      </header>

      {blockedByDispatcher && (
        <div className="border-b border-border bg-rose-500/10 px-3 py-2 text-[11.5px] text-rose-400">
          This agent does not have permission to assign tasks. Enable <em>Can
          assign tasks to other team members</em> on its agent page to let it
          dispatch work.
        </div>
      )}

      {error && (
        <div className="border-b border-border bg-rose-500/10 px-3 py-2 text-[11.5px] text-rose-400">
          {error}
        </div>
      )}

      {pending.length > 0 && (
        <ul className="divide-y divide-border">
          {visibleRows.map((item) => {
            const hard = hasHard(item.warnings);
            const checked = selected.has(item.id);
            const color =
              TYPE_COLORS[item.action.type] ||
              "bg-muted/30 text-muted-foreground border-border";
            return (
              <li
                key={item.id}
                className={cn(
                  "flex items-start gap-2 px-3 py-2.5",
                  hard && "opacity-70"
                )}
              >
                <input
                  type="checkbox"
                  className="mt-1 size-3.5 shrink-0 accent-foreground disabled:opacity-50"
                  checked={checked}
                  disabled={hard || blockedByDispatcher || submitting !== null}
                  onChange={() => toggle(item.id, hard)}
                  aria-label={`Select ${item.action.type}`}
                />
                <span
                  className={cn(
                    "mt-0.5 shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider",
                    color
                  )}
                >
                  {item.action.type}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-medium text-foreground/95">
                    {actionHeadline(item.action)}
                  </div>
                  <div className="mt-0.5 whitespace-pre-wrap break-words text-[11.5px] text-foreground/70">
                    {item.action.prompt}
                  </div>
                  {item.warnings.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {item.warnings.map((warning, wi) => {
                        const tone =
                          warning.severity === "hard"
                            ? "bg-rose-500/15 text-rose-400 border-rose-500/25"
                            : "bg-amber-500/15 text-amber-400 border-amber-500/25";
                        return (
                          <span
                            key={wi}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[9.5px]",
                              tone
                            )}
                            title={warning.message}
                          >
                            <AlertTriangle className="size-2.5" />
                            {warning.code}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {hiddenCount > 0 && (
        <div className="border-t border-border bg-muted/30 px-3 py-1.5 text-center">
          <button
            type="button"
            className="text-[11px] font-medium text-primary hover:underline"
            onClick={() => setShowAll(true)}
          >
            Show {hiddenCount} more…
          </button>
        </div>
      )}

      {dispatched && dispatched.length > 0 && pending.length === 0 && (
        <ul className="divide-y divide-border">
          {dispatched.slice(-20).map((entry) => {
            const tone =
              entry.status === "dispatched"
                ? "text-emerald-400"
                : "text-muted-foreground line-through";
            return (
              <li
                key={entry.id}
                className="flex items-start gap-2 px-3 py-1.5 text-[11.5px]"
              >
                <span className={cn("font-mono text-[10px] uppercase", tone)}>
                  {entry.status}
                </span>
                <span className="min-w-0 flex-1 truncate text-foreground/80">
                  {entry.action.type} → {entry.action.agent}
                </span>
                {entry.conversationId && (
                  <a
                    href={`/agents/conversations/${encodeURIComponent(entry.conversationId)}`}
                    className="text-[10.5px] text-primary hover:underline"
                  >
                    open
                  </a>
                )}
                {entry.jobId && (
                  <span className="font-mono text-[10px] text-muted-foreground">
                    job: {entry.jobId}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
