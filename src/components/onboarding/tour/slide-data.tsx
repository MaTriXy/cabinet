"use client";

import { useEffect, useState } from "react";
import {
  FileText,
  FileType,
  Image as ImageIcon,
  Video,
  Music,
  FileSpreadsheet,
  Table,
  Presentation,
  AppWindow,
  Code,
  GitBranch,
  Folder,
  ChevronDown,
} from "lucide-react";
import { MockupSidebar } from "./mockup-sidebar";
import { TOUR_PALETTE as P } from "./palette";

type IconComponent = typeof FileText;

// Vivid icon palette — mirrors the colors called out in the Getting
// Started page's "Supported File Types" table so the tour reads as a
// preview of the real sidebar's file-type chrome.
const ICON = {
  gray: "#6B7280",
  green: "#22C55E",
  red: "#EF4444",
  violet: "#A855F7",
  pink: "#EC4899",
  cyan: "#06B6D4",
  amber: "#F59E0B",
  blue: "#3B82F6",
  orange: "#F97316",
} as const;

interface TreeRow {
  label: string;
  icon: IconComponent;
  color: string;
  indent: number;
}

interface Scene {
  id: string;
  rootIcon: IconComponent;
  rootColor: string;
  rootLabel: string;
  rows: TreeRow[];
  caption: string;
}

// Auto-rotating showcase: five distinct knowledge-base scenes that
// demonstrate the breadth of file types Cabinet can render inline.
const SCENES: Scene[] = [
  {
    id: "thailand",
    rootIcon: ChevronDown as IconComponent,
    rootColor: P.textTertiary,
    rootLabel: "Thailand Trip",
    rows: [
      { label: "Itinerary.md", icon: FileText, color: ICON.gray, indent: 1 },
      { label: "Phuket sunset.jpg", icon: ImageIcon, color: ICON.pink, indent: 1 },
      { label: "Chiang Mai temple.jpg", icon: ImageIcon, color: ICON.pink, indent: 1 },
      { label: "Night market.mp4", icon: Video, color: ICON.cyan, indent: 1 },
      { label: "Budget.xlsx", icon: FileSpreadsheet, color: ICON.green, indent: 1 },
      { label: "Street food notes.mp3", icon: Music, color: ICON.amber, indent: 1 },
      { label: "Flights.pdf", icon: FileType, color: ICON.red, indent: 1 },
    ],
    caption: "Photos, video, sheets, audio, notes — one folder, one source of truth.",
  },
  {
    id: "tax-webapp",
    rootIcon: ChevronDown as IconComponent,
    rootColor: P.textTertiary,
    rootLabel: "Tax 2026",
    rows: [
      { label: "Calculator", icon: AppWindow, color: ICON.green, indent: 1 },
      { label: "Income.xlsx", icon: FileSpreadsheet, color: ICON.green, indent: 1 },
      { label: "Receipts.pdf", icon: FileType, color: ICON.red, indent: 1 },
      { label: "Deductions.md", icon: FileText, color: ICON.gray, indent: 1 },
      { label: "W-2 2026.pdf", icon: FileType, color: ICON.red, indent: 1 },
      { label: "CPA notes.docx", icon: FileText, color: ICON.blue, indent: 1 },
    ],
    caption: "Tax 2026 — a live calculator web app, embedded right in your cabinet.",
  },
  {
    id: "health",
    rootIcon: ChevronDown as IconComponent,
    rootColor: P.textTertiary,
    rootLabel: "Health",
    rows: [
      { label: "Daily vitamins.csv", icon: Table, color: ICON.green, indent: 1 },
      { label: "Supplements.md", icon: FileText, color: ICON.gray, indent: 1 },
      { label: "Dosage schedule.xlsx", icon: FileSpreadsheet, color: ICON.green, indent: 1 },
      { label: "Lab results.pdf", icon: FileType, color: ICON.red, indent: 1 },
      { label: "Progress chart.png", icon: ImageIcon, color: ICON.pink, indent: 1 },
    ],
    caption: "Vitamins & labs — a spreadsheet that feels like a page.",
  },
  {
    id: "work",
    rootIcon: ChevronDown as IconComponent,
    rootColor: P.textTertiary,
    rootLabel: "Work",
    rows: [
      { label: "Q2 report.pdf", icon: FileType, color: ICON.red, indent: 1 },
      { label: "Client contract.pdf", icon: FileType, color: ICON.red, indent: 1 },
      { label: "Board deck.pptx", icon: Presentation, color: ICON.orange, indent: 1 },
      { label: "Revenue 2026.xlsx", icon: FileSpreadsheet, color: ICON.green, indent: 1 },
      { label: "Policy.docx", icon: FileText, color: ICON.blue, indent: 1 },
      { label: "All-hands notes.md", icon: FileText, color: ICON.gray, indent: 1 },
    ],
    caption: "Work docs — PDFs, slides, sheets, all rendered inline.",
  },
  {
    id: "repo",
    rootIcon: GitBranch as IconComponent,
    rootColor: ICON.orange,
    rootLabel: "cabinet-repo",
    rows: [
      { label: "README.md", icon: FileText, color: ICON.gray, indent: 1 },
      { label: "package.json", icon: Code, color: ICON.violet, indent: 1 },
      { label: "src", icon: Folder, color: ICON.gray, indent: 1 },
      { label: "schema.ts", icon: Code, color: ICON.violet, indent: 1 },
      { label: ".repo.yaml", icon: GitBranch, color: ICON.orange, indent: 1 },
    ],
    caption: "Codebases — link any Git repo, searchable by your agents.",
  },
];

const SCENE_DURATION_MS = 3800;

export function SlideData() {
  const [sceneIdx, setSceneIdx] = useState(0);
  const scene = SCENES[sceneIdx];

  // Let the first scene finish its staggered populate (~2s) before the
  // auto-rotation kicks in. The mod-5 loop never stops — five clean
  // scenes reads as a tour of Cabinet's range.
  useEffect(() => {
    let intervalId: number | undefined;
    const startId = window.setTimeout(() => {
      intervalId = window.setInterval(() => {
        setSceneIdx((i) => (i + 1) % SCENES.length);
      }, SCENE_DURATION_MS);
    }, SCENE_DURATION_MS);
    return () => {
      window.clearTimeout(startId);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="grid h-full grid-cols-[minmax(280px,340px)_1fr] gap-10 lg:gap-14 items-center">
      {/* Left column: rotating scene display */}
      <div className="flex h-[500px] w-full flex-col gap-3">
        <div className="h-[440px] w-full">
          <MockupSidebar activeTab="data" viewTransitionName="cabinet-card">
            {/* Tree re-keyed on scene so rows re-animate per scene */}
            <div
              key={scene.id}
              className="relative h-full px-2.5 py-2"
              style={{
                animation: "cabinet-tour-fade-in 0.35s ease-out",
              }}
            >
              {/* Scene root row */}
              <div
                className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-[12px] opacity-0"
                style={{
                  color: P.text,
                  animation: "cabinet-tour-fade-up 0.35s ease-out forwards",
                  animationDelay: "80ms",
                }}
              >
                {(() => {
                  const Icon = scene.rootIcon;
                  return (
                    <Icon
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: scene.rootColor }}
                    />
                  );
                })()}
                <span className="truncate font-medium">{scene.rootLabel}</span>
              </div>

              {/* Scene child rows */}
              {scene.rows.map((row, i) => {
                const Icon = row.icon;
                return (
                  <div
                    key={row.label}
                    className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-[12px] opacity-0"
                    style={{
                      color: P.text,
                      paddingLeft: `${row.indent * 12 + 6}px`,
                      animation: "cabinet-tour-fade-up 0.35s ease-out forwards",
                      animationDelay: `${180 + i * 80}ms`,
                    }}
                  >
                    <Icon
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: row.color }}
                    />
                    <span className="truncate">{row.label}</span>
                  </div>
                );
              })}
            </div>
          </MockupSidebar>
        </div>

        {/* Caption + scene dots */}
        <div className="flex flex-col items-center gap-2 px-2">
          <p
            key={scene.id + "-caption"}
            className="font-body-serif text-[13px] leading-snug text-center opacity-0"
            style={{
              color: P.textSecondary,
              animation: "cabinet-tour-fade-up 0.4s ease-out forwards",
              animationDelay: "240ms",
              minHeight: "2.4em",
            }}
          >
            {scene.caption}
          </p>
          <div className="flex items-center gap-1.5">
            {SCENES.map((s, i) => (
              <span
                key={s.id}
                aria-hidden
                className="h-1 rounded-full transition-all duration-300"
                style={{
                  width: i === sceneIdx ? 14 : 4,
                  background: i === sceneIdx ? P.accent : P.textTertiary,
                  opacity: i === sceneIdx ? 1 : 0.35,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right column: copy */}
      <div className="flex flex-col gap-5 max-w-lg">
        <span
          className="inline-block w-fit rounded-full px-3 py-1 text-[10px] font-semibold tracking-[0.18em] opacity-0"
          style={{
            color: P.accent,
            background: P.accentBg,
            border: `1px solid ${P.borderDark}`,
            animation: "cabinet-tour-fade-up 0.4s ease-out forwards",
            animationDelay: "60ms",
          }}
        >
          01 &middot; DATA
        </span>
        <h2
          className="font-logo text-4xl italic tracking-tight opacity-0 lg:text-5xl"
          style={{
            color: P.text,
            animation: "cabinet-tour-fade-up 0.5s ease-out forwards",
            animationDelay: "180ms",
          }}
        >
          Your <span style={{ color: P.accent }}>single source</span> of truth.
        </h2>
        <p
          className="font-body-serif text-base leading-relaxed opacity-0 lg:text-lg"
          style={{
            color: P.textSecondary,
            animation: "cabinet-tour-fade-up 0.5s ease-out forwards",
            animationDelay: "320ms",
          }}
        >
          Markdown, PDFs, spreadsheets, slides, images, video, audio, linked
          repos, embedded web apps, Google Docs. Mention any of it with{" "}
          <span className="font-mono" style={{ color: P.accent }}>@</span>.
        </p>
      </div>
    </div>
  );
}
