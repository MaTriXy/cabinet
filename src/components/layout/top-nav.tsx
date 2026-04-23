"use client";

import { Home, Users, CheckSquare, Timer, Settings as SettingsIcon, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/stores/app-store";
import { ROOT_CABINET_PATH } from "@/lib/cabinets/paths";
import type { SectionType, SelectedSection } from "@/stores/app-store";

interface NavTab {
  id: SectionType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  targetSection: (scopedCabinet: string) => SelectedSection;
  /** Returns true when the current section should highlight this tab. */
  matches: (section: SelectedSection) => boolean;
}

const TABS: NavTab[] = [
  {
    id: "home",
    label: "Home",
    icon: Home,
    targetSection: () => ({ type: "home" }),
    matches: (s) => s.type === "home",
  },
  {
    id: "agents",
    label: "Agents",
    icon: Users,
    targetSection: (cabinetPath) => ({ type: "agents", cabinetPath }),
    matches: (s) => s.type === "agents" || s.type === "agent",
  },
  {
    id: "tasks",
    label: "Tasks",
    icon: CheckSquare,
    targetSection: (cabinetPath) => ({ type: "tasks", cabinetPath }),
    matches: (s) => s.type === "tasks" || s.type === "task",
  },
  {
    id: "jobs",
    label: "Jobs",
    icon: Timer,
    targetSection: (cabinetPath) => ({ type: "jobs", cabinetPath }),
    matches: (s) => s.type === "jobs",
  },
  {
    id: "settings",
    label: "Settings",
    icon: SettingsIcon,
    targetSection: () => ({ type: "settings" }),
    matches: (s) => s.type === "settings",
  },
];

export function TopNav() {
  const section = useAppStore((s) => s.section);
  const setSection = useAppStore((s) => s.setSection);
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useAppStore((s) => s.setSidebarCollapsed);

  const scopedCabinet = section.cabinetPath || ROOT_CABINET_PATH;

  return (
    <nav
      aria-label="Primary"
      className="flex h-10 shrink-0 items-center gap-0.5 border-b border-border bg-background/70 px-2 backdrop-blur-sm"
    >
      <button
        type="button"
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        aria-label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
        className="mr-1 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden"
      >
        <Menu className="size-4" />
      </button>
      <ul className="flex items-center gap-0.5" role="tablist">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = tab.matches(section);
          return (
            <li key={tab.id}>
              <button
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={tab.label}
                title={tab.label}
                onClick={() => setSection(tab.targetSection(scopedCabinet))}
                className={cn(
                  "relative inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium transition-colors sm:px-2.5",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
