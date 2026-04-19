"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Calendar as CalendarIcon,
  CheckCircle,
  File as FileIcon,
  FileCode,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Play,
  Plus,
  Power,
  Send,
  Sparkles,
  Trash2,
  Download,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  AgentIdentity,
  getAgentDisplayName,
} from "@/components/agents/agent-identity";
import type { AgentPersona } from "@/lib/agents/persona-manager";
import type { ConversationMeta } from "@/types/conversations";
import type {
  CabinetAgentSummary,
  CabinetJobSummary,
} from "@/types/cabinets";
import { cronToHuman } from "@/lib/agents/cron-utils";
import { getAgentColor, tintFromHex } from "@/lib/agents/cron-compute";
import { ScheduleCalendar } from "@/components/cabinets/schedule-calendar";
import { SchedulePicker } from "@/components/mission-control/schedule-picker";
import {
  TaskRuntimePicker,
  type TaskRuntimeSelection,
} from "@/components/composer/task-runtime-picker";
import { useEditor, EditorContent } from "@tiptap/react";
import { editorExtensions } from "@/components/editor/extensions";
import { markdownToHtml } from "@/lib/markdown/to-html";
import { htmlToMarkdown } from "@/lib/markdown/to-markdown";

interface AgentJob {
  id: string;
  name: string;
  enabled: boolean;
  schedule: string;
  prompt: string;
}

function formatRelative(iso?: string): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "just now";
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function formatDuration(ms: number): string {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  return `${h}h`;
}

function triggerIcon(trigger: ConversationMeta["trigger"]) {
  switch (trigger) {
    case "job":
      return Briefcase;
    case "heartbeat":
      return Sparkles;
    default:
      return MessageSquare;
  }
}

function triggerLabel(trigger: ConversationMeta["trigger"]): string {
  switch (trigger) {
    case "job":
      return "Job";
    case "heartbeat":
      return "Heartbeat";
    default:
      return "Chat";
  }
}

function conversationDurationMs(convo: ConversationMeta): number {
  const start = new Date(convo.startedAt).getTime();
  const end = convo.completedAt
    ? new Date(convo.completedAt).getTime()
    : convo.lastActivityAt
      ? new Date(convo.lastActivityAt).getTime()
      : Date.now();
  return Math.max(0, end - start);
}

/* ─── Conversation status presentation ─── */
type ConversationDisplayStatus =
  | "running"
  | "awaiting"
  | "completed"
  | "failed"
  | "cancelled"
  | "closed";

const CLOSED_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // 7d of no activity → auto-close

function displayStatus(c: ConversationMeta): ConversationDisplayStatus {
  if (c.archivedAt) return "closed";
  if (c.status === "running") {
    return c.awaitingInput ? "awaiting" : "running";
  }
  if (c.status === "failed") return "failed";
  if (c.status === "cancelled") return "cancelled";
  // completed
  const last = new Date(c.lastActivityAt || c.completedAt || c.startedAt).getTime();
  if (Date.now() - last > CLOSED_AFTER_MS) return "closed";
  return "completed";
}

function statusPresentation(s: ConversationDisplayStatus) {
  switch (s) {
    case "running":
      return {
        icon: Loader2,
        iconClass: "text-primary animate-spin",
        label: "Working",
        labelClass: "text-primary",
      };
    case "awaiting":
      return {
        icon: HelpCircle,
        iconClass: "text-amber-500",
        label: "Needs reply",
        labelClass: "text-amber-600 dark:text-amber-400",
      };
    case "completed":
      return {
        icon: CheckCircle,
        iconClass: "text-green-500",
        label: "Done",
        labelClass: "text-muted-foreground",
      };
    case "failed":
      return {
        icon: XCircle,
        iconClass: "text-red-500",
        label: "Failed",
        labelClass: "text-red-500",
      };
    case "cancelled":
      return {
        icon: XCircle,
        iconClass: "text-muted-foreground/50",
        label: "Cancelled",
        labelClass: "text-muted-foreground",
      };
    case "closed":
      return {
        icon: Archive,
        iconClass: "text-muted-foreground/40",
        label: "Closed",
        labelClass: "text-muted-foreground/70",
      };
  }
}

/* ─── Artifact helpers ─── */
interface Artifact {
  path: string;
  ts: string;
  conversationId: string;
  conversationTitle: string;
}

function iconForPath(path: string) {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  if (["md", "mdx", "txt"].includes(ext)) return FileText;
  if (["png", "jpg", "jpeg", "gif", "svg", "webp", "avif"].includes(ext))
    return ImageIcon;
  if (["csv", "xlsx", "xls", "numbers", "tsv"].includes(ext))
    return FileSpreadsheet;
  if (
    [
      "js",
      "jsx",
      "ts",
      "tsx",
      "json",
      "yaml",
      "yml",
      "html",
      "css",
      "py",
      "go",
      "rs",
      "sh",
    ].includes(ext)
  )
    return FileCode;
  return FileIcon;
}

function splitPath(path: string): { dir: string; file: string } {
  const parts = path.split("/").filter(Boolean);
  const file = parts.pop() || path;
  const dir = parts.join("/");
  return { dir, file };
}

/* ─── Status ─── */
type AgentStatus = "working" | "ready" | "paused";

function computeStatus(
  persona: AgentPersona,
  conversations: ConversationMeta[]
): AgentStatus {
  if (!persona.active) return "paused";
  const hasRunning = conversations.some((c) => c.status === "running");
  return hasRunning ? "working" : "ready";
}

/* ─── Schedule adapters ─── */
function personaToCabinetAgent(persona: AgentPersona): CabinetAgentSummary {
  const cabinetPath = persona.cabinetPath || ".";
  return {
    scopedId: `${cabinetPath}::agent::${persona.slug}`,
    name: persona.name,
    slug: persona.slug,
    emoji: persona.emoji || "🤖",
    role: persona.role,
    active: persona.active,
    department: persona.department,
    type: persona.type,
    heartbeat: persona.heartbeat,
    workspace: persona.workspace,
    jobCount: 0,
    taskCount: 0,
    cabinetPath,
    cabinetName: "",
    cabinetDepth: 0,
    inherited: false,
    displayName: persona.displayName,
    iconKey: persona.iconKey,
    color: persona.color,
    avatar: persona.avatar,
    avatarExt: persona.avatarExt,
  };
}

function jobToCabinetJob(job: AgentJob, persona: AgentPersona): CabinetJobSummary {
  const cabinetPath = persona.cabinetPath || ".";
  return {
    scopedId: `${cabinetPath}::job::${job.id}`,
    id: job.id,
    name: job.name,
    enabled: job.enabled,
    schedule: job.schedule,
    prompt: job.prompt,
    ownerAgent: persona.slug,
    ownerScopedId: `${cabinetPath}::agent::${persona.slug}`,
    cabinetPath,
    cabinetName: "",
    cabinetDepth: 0,
    inherited: false,
  };
}

function aggregateArtifacts(conversations: ConversationMeta[]): Artifact[] {
  const map = new Map<string, Artifact>();
  for (const c of conversations) {
    const ts = c.lastActivityAt || c.completedAt || c.startedAt;
    for (const path of c.artifactPaths || []) {
      const existing = map.get(path);
      if (!existing || new Date(ts).getTime() > new Date(existing.ts).getTime()) {
        map.set(path, {
          path,
          ts,
          conversationId: c.id,
          conversationTitle: c.title || c.summary || "Untitled",
        });
      }
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()
  );
}

/* ─── Section shell ─── */
function Section({
  title,
  meta,
  action,
  children,
}: {
  title: string;
  meta?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="px-6 py-6 border-b border-border/40">
      <header className="flex items-baseline justify-between mb-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-[15px] font-medium">{title}</h2>
          {meta && (
            <span className="text-[11px] text-muted-foreground">{meta}</span>
          )}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

/* ─── Status chip ─── */
function StatusChip({
  status,
  color,
  onClick,
}: {
  status: AgentStatus;
  color: string;
  onClick?: () => void;
}) {
  const label = status === "working" ? "Working" : status === "ready" ? "Ready" : "Paused";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border/70 px-2 py-0.5 text-[11px] font-medium transition-colors",
        onClick && "hover:border-border hover:bg-accent/40 cursor-pointer",
        status === "paused" && "text-muted-foreground"
      )}
      style={status !== "paused" ? { color } : undefined}
    >
      <span className="relative inline-flex h-1.5 w-1.5">
        {status === "working" && (
          <span
            className="absolute inset-0 rounded-full animate-ping"
            style={{ backgroundColor: color, opacity: 0.6 }}
          />
        )}
        <span
          className={cn(
            "relative inline-block h-1.5 w-1.5 rounded-full",
            status === "paused" && "bg-muted-foreground/40"
          )}
          style={status !== "paused" ? { backgroundColor: color } : undefined}
        />
      </span>
      {label}
    </button>
  );
}

/* ─── Top action bar ─── */
function TopBar({
  persona,
  status,
  scheduleOpen,
  onBack,
  onToggleSchedule,
  onToggleActive,
  onExport,
  onDelete,
}: {
  persona: AgentPersona;
  status: AgentStatus;
  scheduleOpen: boolean;
  onBack: () => void;
  onToggleSchedule: () => void;
  onToggleActive: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  const palette = persona.color
    ? tintFromHex(persona.color)
    : getAgentColor(persona.slug);

  return (
    <div className="flex items-center justify-between px-6 pt-4">
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-[12px] gap-1.5 -ml-2 text-muted-foreground"
        onClick={onBack}
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to agents
      </Button>

      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant={scheduleOpen ? "secondary" : "ghost"}
                size="sm"
                className="h-7 gap-1.5 text-[12px]"
                onClick={onToggleSchedule}
              >
                {scheduleOpen ? (
                  <X className="h-3.5 w-3.5" />
                ) : (
                  <CalendarIcon className="h-3.5 w-3.5" />
                )}
                {scheduleOpen ? "Close schedule" : "Schedule"}
              </Button>
            }
          />
          <TooltipContent>
            {scheduleOpen
              ? "Return to the profile view"
              : "See past and upcoming runs for this agent"}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={onToggleActive}
                className={cn(
                  "inline-flex items-center gap-1.5 h-7 rounded-md border px-2.5 text-[12px] font-medium transition-colors",
                  persona.active
                    ? "border-border hover:bg-accent/40"
                    : "border-dashed border-border/60 text-muted-foreground hover:bg-accent/30"
                )}
                style={persona.active ? { color: palette.text } : undefined}
              >
                <Power className="h-3.5 w-3.5" />
                {persona.active ? "Active" : "Stopped"}
              </button>
            }
          />
          <TooltipContent>
            {persona.active
              ? "Stop this agent — pauses heartbeat and all scheduled jobs. Manual chats still work."
              : "Resume this agent — re-enables heartbeat and scheduled jobs."}
          </TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7 text-muted-foreground"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={onExport}>
              <Download className="h-3.5 w-3.5 mr-2" />
              Export persona
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="text-red-500 focus:text-red-500 focus:bg-red-500/10"
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Delete agent
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {/* palette ref to suppress unused var warning when active */}
      <span className="hidden" aria-hidden style={{ color: palette.text }}>
        {status}
      </span>
    </div>
  );
}

/* ─── Hero (identity only; top-bar handled separately) ─── */
function Hero({
  persona,
  status,
}: {
  persona: AgentPersona;
  status: AgentStatus;
}) {
  const palette = persona.color
    ? tintFromHex(persona.color)
    : getAgentColor(persona.slug);

  return (
    <div className="px-6 pt-5 pb-5">
      <div className="flex items-center gap-4">
        <AgentIdentity
          agent={{
            slug: persona.slug,
            cabinetPath: persona.cabinetPath,
            displayName: persona.displayName,
            iconKey: persona.iconKey,
            color: persona.color,
            avatar: persona.avatar,
            avatarExt: persona.avatarExt,
          }}
          size="lg"
          className="!h-16 !w-16 rounded-2xl [&>svg]:!h-7 [&>svg]:!w-7"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-[24px] font-semibold tracking-[-0.02em] leading-tight truncate">
              {getAgentDisplayName(persona) || persona.name}
            </h1>
            <StatusChip status={status} color={palette.text} />
          </div>
          <p className="text-[13px] text-muted-foreground mt-0.5 truncate flex items-center gap-2">
            <span>{persona.role}</span>
            {persona.department && (
              <>
                <span className="opacity-40">·</span>
                <span>{persona.department}</span>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Composer ─── */
function Composer({
  persona,
  onSubmit,
  submitting,
}: {
  persona: AgentPersona;
  onSubmit: (message: string, runtime: TaskRuntimeSelection) => void;
  submitting: boolean;
}) {
  const [value, setValue] = useState("");
  const palette = persona.color
    ? tintFromHex(persona.color)
    : getAgentColor(persona.slug);
  const [focused, setFocused] = useState(false);
  const [runtime, setRuntime] = useState<TaskRuntimeSelection>(() => ({
    providerId: persona.provider || undefined,
    adapterType: persona.adapterType || undefined,
    model:
      (persona.adapterConfig?.model as string | undefined) || undefined,
    effort:
      (persona.adapterConfig?.effort as string | undefined) || undefined,
  }));

  const suggestions = useMemo(() => {
    const slug = persona.slug.toLowerCase();
    if (slug.includes("ceo")) return ["Set goals for the quarter", "Review team status", "Plan next initiative"];
    if (slug.includes("editor")) return ["Review this page", "Fix the grammar", "Summarize this doc"];
    if (slug.includes("cto") || slug.includes("dev"))
      return ["Review my PR", "Fix the build", "Plan the sprint"];
    if (slug.includes("copy")) return ["Write landing copy", "Rewrite in brand voice", "Draft an email"];
    if (slug.includes("market")) return ["Draft a blog post", "Plan next campaign", "Audit our content"];
    return ["Summarize recent work", "Propose next steps", "Draft an update"];
  }, [persona.slug]);

  const name = getAgentDisplayName(persona) || persona.name;

  const handleSubmit = () => {
    if (!value.trim()) return;
    onSubmit(value.trim(), runtime);
    setValue("");
  };

  const apply = (s: string) => setValue(s);

  return (
    <div className="px-6 pb-5">
      <div
        className={cn(
          "relative rounded-2xl border bg-card transition-all",
          focused ? "shadow-sm" : "border-border"
        )}
        style={
          focused
            ? {
                borderColor: palette.text,
                boxShadow: `0 0 0 3px ${palette.bg}`,
              }
            : undefined
        }
      >
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder={`Ask ${name} something…`}
          rows={3}
          className="w-full resize-none bg-transparent px-4 pt-3 pb-1 text-[14px] leading-relaxed focus:outline-none"
        />
        <div className="flex items-center justify-between px-3 pb-2.5 pt-1 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <TaskRuntimePicker value={runtime} onChange={setRuntime} />
            <span className="text-[11px] text-muted-foreground whitespace-nowrap hidden sm:inline">
              ⌘↵ to send
            </span>
          </div>
          <Button
            size="sm"
            className="h-7 gap-1.5 px-3 text-[12px] shrink-0"
            onClick={handleSubmit}
            disabled={!value.trim() || submitting}
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Send
          </Button>
        </div>
      </div>

      {/* Suggested prompts */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => apply(s)}
            className="text-[11px] text-muted-foreground hover:text-foreground rounded-full border border-border/60 px-2.5 py-1 hover:border-border transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Conversations ─── */
function ConversationsSection({
  conversations,
  onOpen,
  onSeeAll,
}: {
  conversations: ConversationMeta[];
  onOpen: (c: ConversationMeta) => void;
  onSeeAll?: () => void;
}) {
  const top = conversations.slice(0, 7);
  return (
    <Section
      title="Conversations"
      meta={`${conversations.length} total`}
      action={
        conversations.length > top.length && onSeeAll && (
          <button
            onClick={onSeeAll}
            className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            See all <ArrowRight className="h-3 w-3" />
          </button>
        )
      }
    >
      {top.length === 0 ? (
        <p className="text-[12px] text-muted-foreground py-6 text-center">
          No conversations yet. Send a prompt above to start one.
        </p>
      ) : (
        <ul className="space-y-0">
          {top.map((c) => {
            const TriggerIcon = triggerIcon(c.trigger);
            const duration = conversationDurationMs(c);
            const title = (c.title || c.summary || "Untitled")
              .replace(/^---\s*\n/, "")
              .replace(/^#+\s*/, "")
              .trim();
            const ds = displayStatus(c);
            const sp = statusPresentation(ds);
            const Icon = sp.icon;
            const highlight = ds === "awaiting";
            const dim = ds === "closed" || ds === "cancelled";
            return (
              <li key={c.id}>
                <button
                  onClick={() => onOpen(c)}
                  className={cn(
                    "w-full flex items-center gap-3 px-2 py-2.5 -mx-2 rounded-md transition-colors text-left group",
                    highlight
                      ? "bg-amber-500/5 hover:bg-amber-500/10"
                      : "hover:bg-accent/40",
                    dim && "opacity-60 hover:opacity-100"
                  )}
                >
                  <span className="shrink-0">
                    <Icon className={cn("h-3.5 w-3.5", sp.iconClass)} />
                  </span>
                  <span className="flex-1 min-w-0 flex items-baseline gap-2">
                    <span className="text-[13px] truncate">{title}</span>
                    {highlight && (
                      <span className={cn("text-[10px] font-medium uppercase tracking-wider shrink-0", sp.labelClass)}>
                        {sp.label}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-4 text-[11px] text-muted-foreground tabular-nums shrink-0">
                    <span className="inline-flex items-center gap-1">
                      <TriggerIcon className="h-3 w-3 opacity-70" />
                      <span>{triggerLabel(c.trigger)}</span>
                    </span>
                    <span className="w-14 text-right">
                      {formatRelative(c.lastActivityAt || c.startedAt)}
                    </span>
                    <span className="w-8 text-right">
                      {ds === "running" ? "—" : formatDuration(duration)}
                    </span>
                    <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

/* ─── Recent work (KB artifacts this agent touched) ─── */
function RecentWorkSection({
  artifacts,
  onOpenPath,
}: {
  artifacts: Artifact[];
  onOpenPath: (path: string) => void;
}) {
  const top = artifacts.slice(0, 5);
  return (
    <Section
      title="Recent work"
      meta={
        artifacts.length > 0
          ? `${artifacts.length} file${artifacts.length === 1 ? "" : "s"} touched`
          : undefined
      }
      action={
        artifacts.length > top.length && (
          <button className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
            See all <ArrowRight className="h-3 w-3" />
          </button>
        )
      }
    >
      {top.length === 0 ? (
        <p className="text-[12px] text-muted-foreground py-6 text-center">
          No edits yet. Files this agent writes to will appear here.
        </p>
      ) : (
        <ul className="space-y-0">
          {top.map((a) => {
            const Icon = iconForPath(a.path);
            const { dir, file } = splitPath(a.path);
            return (
              <li key={a.path}>
                <button
                  onClick={() => onOpenPath(a.path)}
                  className="w-full flex items-center gap-3 px-2 py-2.5 -mx-2 rounded-md hover:bg-accent/40 transition-colors text-left group"
                >
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="flex-1 min-w-0 flex items-baseline gap-2">
                    <span className="text-[13px] truncate">{file}</span>
                    {dir && (
                      <span className="text-[11px] text-muted-foreground/70 truncate font-mono">
                        {dir}
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 w-14 text-right">
                    {formatRelative(a.ts)}
                  </span>
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

/* ─── Schedule ─── */
function ScheduleSection({
  persona,
  jobs,
  onToggleJob,
  onRunJob,
  onAddJob,
  onRunHeartbeat,
  onManage,
}: {
  persona: AgentPersona;
  jobs: AgentJob[];
  onToggleJob: (id: string) => void;
  onRunJob: (id: string) => void;
  onAddJob: (draft: { name: string; schedule: string; prompt: string }) => Promise<void>;
  onRunHeartbeat: () => void;
  onManage: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState("0 9 * * 1-5");
  const [prompt, setPrompt] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName("");
    setSchedule("0 9 * * 1-5");
    setPrompt("");
    setAdding(false);
  };

  const canSave = name.trim().length > 0 && prompt.trim().length > 0;

  const handleCreate = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onAddJob({
        name: name.trim(),
        schedule,
        prompt: prompt.trim(),
      });
      reset();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section
      title="Schedule"
      action={
        <button
          onClick={onManage}
          className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          Manage <ArrowRight className="h-3 w-3" />
        </button>
      }
    >
      <ul className="space-y-0">
        {/* Heartbeat */}
        <li className="flex items-center gap-3 px-2 py-2.5 -mx-2 rounded-md hover:bg-accent/30 transition-colors">
          <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span className="flex-1 text-[13px]">Heartbeat</span>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {cronToHuman(persona.heartbeat)}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7"
            onClick={onRunHeartbeat}
            title="Run now"
          >
            <Play className="h-3 w-3" />
          </Button>
        </li>
        {/* Jobs */}
        {jobs.map((job) => (
          <li
            key={job.id}
            className="flex items-center gap-3 px-2 py-2.5 -mx-2 rounded-md hover:bg-accent/30 transition-colors"
          >
            <Briefcase className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="flex-1 text-[13px] truncate">{job.name}</span>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {cronToHuman(job.schedule)}
            </span>
            <button
              onClick={() => onToggleJob(job.id)}
              className={cn(
                "text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded transition-colors",
                job.enabled
                  ? "bg-green-500/10 text-green-600 dark:text-green-400"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {job.enabled ? "on" : "off"}
            </button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7"
              onClick={() => onRunJob(job.id)}
              title="Run now"
            >
              <Play className="h-3 w-3" />
            </Button>
          </li>
        ))}
        {/* Add */}
        {!adding ? (
          <li>
            <button
              onClick={() => setAdding(true)}
              className="w-full flex items-center gap-3 px-2 py-2.5 -mx-2 rounded-md text-muted-foreground hover:bg-accent/30 hover:text-foreground transition-colors text-left"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 text-[13px]">Add routine</span>
            </button>
          </li>
        ) : (
          <li className="mt-2">
            <div className="rounded-lg border border-border bg-card/40 p-3 space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Name
                </label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. PR babysitter"
                  className="mt-1 w-full bg-muted/30 border border-transparent hover:border-border/60 focus:border-border focus:bg-background rounded-md px-2.5 py-1.5 text-[13px] focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") reset();
                  }}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Schedule
                </label>
                <div className="mt-1">
                  <SchedulePicker value={schedule} onChange={setSchedule} />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Prompt
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="What should this routine do each run? This is sent to the agent."
                  rows={3}
                  className="mt-1 w-full resize-none bg-muted/30 border border-transparent hover:border-border/60 focus:border-border focus:bg-background rounded-md px-2.5 py-1.5 text-[13px] leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[11px]"
                  onClick={reset}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-[11px] gap-1.5"
                  onClick={handleCreate}
                  disabled={!canSave || saving}
                >
                  {saving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                  Create routine
                </Button>
              </div>
            </div>
          </li>
        )}
      </ul>
    </Section>
  );
}

/* ─── Details (compact field grid) ─── */
function Field({
  label,
  value,
  mono,
  readOnly,
  className,
  onSave,
}: {
  label: string;
  value: string;
  mono?: boolean;
  readOnly?: boolean;
  className?: string;
  onSave?: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
     
    setDraft(value);
  }, [value]);

  const commit = () => {
    if (readOnly || !onSave) return;
    if (draft !== value) onSave(draft);
  };

  return (
    <div className={cn("flex flex-col gap-1 min-w-0", className)}>
      <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {label}
      </label>
      <input
        value={draft}
        readOnly={readOnly || !onSave}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(value);
            e.currentTarget.blur();
          }
        }}
        className={cn(
          "bg-muted/30 border border-transparent rounded-md px-2.5 py-1.5 text-[13px] transition-colors",
          "hover:border-border/60",
          "focus:outline-none focus:border-border focus:bg-background focus:ring-1 focus:ring-primary/30",
          (readOnly || !onSave) &&
            "text-muted-foreground cursor-default hover:border-transparent",
          mono && "font-mono text-[12px]"
        )}
      />
    </div>
  );
}

function DetailsSection({
  persona,
  onSaveField,
}: {
  persona: AgentPersona;
  onSaveField: (field: string, value: string) => void;
}) {
  return (
    <Section title="Details">
      <div className="grid grid-cols-6 gap-x-3 gap-y-3">
        <Field
          label="Display name"
          value={persona.displayName || persona.name}
          className="col-span-3"
          onSave={(v) => onSaveField("displayName", v)}
        />
        <Field
          label="Role"
          value={persona.role}
          className="col-span-3"
          onSave={(v) => onSaveField("role", v)}
        />
        <Field
          label="Department"
          value={persona.department}
          className="col-span-2"
          onSave={(v) => onSaveField("department", v)}
        />
        <Field
          label="Type"
          value={persona.type}
          className="col-span-2"
          onSave={(v) => onSaveField("type", v)}
        />
        <Field
          label="Workspace"
          value={persona.workspace || "/"}
          className="col-span-2"
          mono
          onSave={(v) => onSaveField("workspace", v)}
        />
        <Field
          label="Tags"
          value={persona.tags.join(", ")}
          className="col-span-4"
          onSave={(v) => onSaveField("tags", v)}
        />
        <Field
          label="Provider"
          value={persona.provider}
          className="col-span-2"
          mono
          readOnly
        />
      </div>
    </Section>
  );
}

/* ─── Schedule view (full calendar) ─── */
function ScheduleView({
  persona,
  jobs,
  conversations,
  onEventClick,
  onClose,
}: {
  persona: AgentPersona;
  jobs: AgentJob[];
  conversations: ConversationMeta[];
  onEventClick: (c: ConversationMeta) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"day" | "week" | "month">("week");
  const [anchor, setAnchor] = useState<Date>(() => new Date());

  const cabinetAgent = useMemo(() => personaToCabinetAgent(persona), [persona]);
  const cabinetJobs = useMemo(
    () => jobs.map((j) => jobToCabinetJob(j, persona)),
    [jobs, persona]
  );

  const shift = (dir: -1 | 1) => {
    const d = new Date(anchor);
    if (mode === "day") d.setDate(d.getDate() + dir);
    else if (mode === "week") d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setAnchor(d);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/40">
        <div className="flex items-center gap-1">
          {(["day", "week", "month"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "text-[12px] px-2.5 py-1 rounded capitalize",
                mode === m
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[12px]"
            onClick={() => shift(-1)}
          >
            ←
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[12px]"
            onClick={() => setAnchor(new Date())}
          >
            Today
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[12px]"
            onClick={() => shift(1)}
          >
            →
          </Button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <ScheduleCalendar
          mode={mode}
          anchor={anchor}
          agents={[cabinetAgent]}
          jobs={cabinetJobs}
          manualConversations={conversations}
          onEventClick={(e) => {
            if (e.sourceType === "manual" && e.conversationId) {
              const c = conversations.find((x) => x.id === e.conversationId);
              if (c) onEventClick(c);
            }
          }}
          onDayClick={(d) => {
            setMode("day");
            setAnchor(d);
          }}
        />
      </div>
      {/* Inert reference to onClose for future ESC shortcut */}
      <button type="button" className="sr-only" onClick={onClose}>
        close schedule
      </button>
    </div>
  );
}

/* ─── Persona editor (markdown viewer / editor, no section chrome) ─── */
function PersonaEditor({
  persona,
  onSave,
}: {
  persona: AgentPersona;
  onSave: (body: string) => Promise<void>;
}) {
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const loadingRef = useRef(false);

  const editor = useEditor({
    extensions: editorExtensions,
    content: "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          "focus:outline-none",
          "prose prose-sm dark:prose-invert max-w-none",
          "prose-headings:font-semibold",
          "prose-h1:text-[16px] prose-h2:text-[14px] prose-h3:text-[13px]",
          "prose-p:text-[13px] prose-li:text-[13px]",
          "prose-code:text-[12px] prose-code:bg-muted prose-code:px-1 prose-code:rounded",
          "prose-pre:bg-muted/40 prose-pre:border prose-pre:border-border",
          "prose-strong:text-foreground",
          "min-h-[220px]"
        ),
      },
    },
    onUpdate: () => {
      if (loadingRef.current) return;
      setDirty(true);
    },
  });

  // Load persona body into the editor when it changes externally and we aren't mid-edit.
  useEffect(() => {
    let cancelled = false;
    if (!editor) return;
    if (dirty) return;
    const md = persona.body || "";
    (async () => {
      const html = md.trim() ? await markdownToHtml(md) : "";
      if (cancelled || !editor) return;
      loadingRef.current = true;
      editor.commands.setContent(html, { emitUpdate: false });
      loadingRef.current = false;
    })();
    return () => {
      cancelled = true;
    };
  }, [editor, persona.body, dirty]);

  const handleSave = async () => {
    if (!editor || !dirty) return;
    const html = editor.getHTML();
    const md = htmlToMarkdown(html);
    if (md === (persona.body || "")) {
      setDirty(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(md);
      setSavedAt(Date.now());
      setDirty(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = async () => {
    if (!editor) return;
    const md = persona.body || "";
    const html = md.trim() ? await markdownToHtml(md) : "";
    loadingRef.current = true;
    editor.commands.setContent(html, { emitUpdate: false });
    loadingRef.current = false;
    setDirty(false);
  };

  // ⌘↵ save, Esc revert — scoped to the editor DOM only.
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSave();
      }
      if (e.key === "Escape" && dirty) {
        e.preventDefault();
        handleDiscard();
      }
    };
    dom.addEventListener("keydown", handler);
    return () => dom.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, dirty]);

  return (
    <div className="px-6 pt-8 pb-12 border-t border-border/40">
      <div className="flex items-center justify-between mb-3 h-7">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          Persona instructions
        </span>
        <div className="flex items-center gap-2">
          {dirty ? (
            <span className="text-[11px] text-muted-foreground italic">
              Unsaved changes
            </span>
          ) : savedAt ? (
            <span className="text-[11px] text-muted-foreground">Saved</span>
          ) : null}
          {dirty && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px]"
              onClick={handleDiscard}
              disabled={saving}
            >
              Discard
            </Button>
          )}
          <Button
            size="sm"
            className="h-7 text-[11px] gap-1.5"
            onClick={handleSave}
            disabled={!dirty || saving}
          >
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CheckCircle className="h-3 w-3" />
            )}
            Save
          </Button>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-muted/10 px-4 py-3 focus-within:border-border focus-within:bg-background focus-within:ring-1 focus-within:ring-primary/30 transition-colors">
        <EditorContent editor={editor} />
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground/70">
        ⌘↵ to save · Esc to revert · / for commands
      </p>
    </div>
  );
}

/* ─── Main ─── */
export function AgentDetailV2({
  slug,
  onBack,
  onOpenConversation,
  onSeeAllConversations,
}: {
  slug: string;
  onBack?: () => void;
  onOpenConversation?: (c: ConversationMeta) => void;
  onSeeAllConversations?: () => void;
}) {
  const [persona, setPersona] = useState<AgentPersona | null>(null);
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [jobs, setJobs] = useState<AgentJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [personaRes, convoRes, jobsRes] = await Promise.all([
        fetch(`/api/agents/personas/${slug}`),
        fetch(
          `/api/agents/conversations?agent=${encodeURIComponent(slug)}&limit=50`
        ),
        fetch(`/api/agents/${slug}/jobs`),
      ]);
      if (personaRes.ok) {
        const data = await personaRes.json();
        setPersona(data.persona);
      }
      if (convoRes.ok) {
        const data = await convoRes.json();
        setConversations(data.conversations || []);
      }
      if (jobsRes.ok) {
        const data = await jobsRes.json();
        setJobs(data.jobs || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleComposerSubmit = useCallback(
    async (message: string, runtime: TaskRuntimeSelection) => {
      if (!persona) return;
      setSubmitting(true);
      try {
        const res = await fetch("/api/agents/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userMessage: message,
            agentSlug: persona.slug,
            cabinetPath: persona.cabinetPath,
            source: "manual",
            providerId: runtime.providerId,
            adapterType: runtime.adapterType,
            model: runtime.model,
            effort: runtime.effort,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.conversation && onOpenConversation) {
            onOpenConversation(data.conversation);
          } else {
            await refresh();
          }
        }
      } finally {
        setSubmitting(false);
      }
    },
    [persona, refresh, onOpenConversation]
  );

  const toggleJob = useCallback(
    async (id: string) => {
      await fetch(`/api/agents/${slug}/jobs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle" }),
      });
      refresh();
    },
    [slug, refresh]
  );

  const runJob = useCallback(
    async (id: string) => {
      await fetch(`/api/agents/${slug}/jobs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run" }),
      });
      refresh();
    },
    [slug, refresh]
  );

  const runHeartbeat = useCallback(async () => {
    await fetch(`/api/agents/personas/${slug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "run" }),
    });
    refresh();
  }, [slug, refresh]);

  const addJob = useCallback(
    async (draft: { name: string; schedule: string; prompt: string }) => {
      await fetch(`/api/agents/${slug}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      await refresh();
    },
    [slug, refresh]
  );

  const handleExport = useCallback(() => {
    // Stream the persona file via the existing export route; browser handles download.
    window.open(`/api/agents/personas/${slug}/export`, "_blank");
  }, [slug]);

  const handleDelete = useCallback(async () => {
    if (!persona) return;
    const name = getAgentDisplayName(persona) || persona.name || slug;
    const confirmed = window.confirm(
      `Delete agent "${name}"?\n\nThis removes the persona file and scheduled jobs. Past conversations stay on disk.`
    );
    if (!confirmed) return;
    const res = await fetch(`/api/agents/personas/${slug}`, {
      method: "DELETE",
    });
    if (res.ok) {
      if (onBack) onBack();
      else history.back();
    } else {
      window.alert("Delete failed. Check the console for details.");
    }
  }, [persona, slug, onBack]);

  const toggleActive = useCallback(async () => {
    setTogglingActive(true);
    await fetch(`/api/agents/personas/${slug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle" }),
    });
    setTogglingActive(false);
    refresh();
  }, [slug, refresh]);

  const saveField = useCallback(
    async (field: string, value: string) => {
      const body: Record<string, unknown> = { [field]: value };
      if (field === "tags") {
        body.tags = value
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
      }
      await fetch(`/api/agents/personas/${slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      refresh();
    },
    [slug, refresh]
  );

  const artifacts = useMemo(
    () => aggregateArtifacts(conversations),
    [conversations]
  );

  if (loading || !persona) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  const handleOpenConversation = (c: ConversationMeta) => {
    if (onOpenConversation) {
      onOpenConversation(c);
    } else {
      // demo fallback: log + full page nav (if inside main shell this is overridden)
      console.log("open conversation", c);
    }
  };

  const handleOpenPath = (path: string) => {
    // Demo route — open the KB page in the main app shell.
    const hash = `#/page/${path.replace(/^\/+/, "")}`;
    window.location.assign(`/${hash}`);
  };

  const status = computeStatus(persona, conversations);

  return (
    <TooltipProvider>
      <div className="h-full w-full flex flex-col overflow-hidden">
        {/* Top bar stays pinned */}
        <div className="shrink-0">
          <TopBar
            persona={persona}
            status={status}
            scheduleOpen={scheduleOpen}
            onBack={onBack || (() => history.back())}
            onToggleSchedule={() => setScheduleOpen((v) => !v)}
            onToggleActive={togglingActive ? () => {} : toggleActive}
            onExport={handleExport}
            onDelete={handleDelete}
          />
        </div>
        {scheduleOpen ? (
          <ScheduleView
            persona={persona}
            jobs={jobs}
            conversations={conversations}
            onEventClick={handleOpenConversation}
            onClose={() => setScheduleOpen(false)}
          />
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="mx-auto max-w-[840px] w-full flex flex-col">
              <Hero persona={persona} status={status} />
              <div className="sticky top-0 z-10 bg-background/95 backdrop-blur">
                <Composer
                  persona={persona}
                  onSubmit={handleComposerSubmit}
                  submitting={submitting}
                />
              </div>
              <ConversationsSection
                conversations={conversations}
                onOpen={handleOpenConversation}
                onSeeAll={onSeeAllConversations}
              />
              <RecentWorkSection
                artifacts={artifacts}
                onOpenPath={handleOpenPath}
              />
              <ScheduleSection
                persona={persona}
                jobs={jobs}
                onToggleJob={toggleJob}
                onRunJob={runJob}
                onAddJob={addJob}
                onRunHeartbeat={runHeartbeat}
                onManage={() => setScheduleOpen(true)}
              />
              <DetailsSection persona={persona} onSaveField={saveField} />
              <PersonaEditor
                persona={persona}
                onSave={(body) => saveField("body", body)}
              />
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
