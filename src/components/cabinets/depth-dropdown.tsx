"use client";

import { ChevronDown, FolderTree, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CABINET_VISIBILITY_OPTIONS } from "@/lib/cabinets/visibility";
import type { CabinetVisibilityMode } from "@/types/cabinets";
import { cn } from "@/lib/utils";

interface DepthDropdownProps {
  mode: CabinetVisibilityMode;
  onChange: (mode: CabinetVisibilityMode) => void;
  /** Compact variant for the sidebar cabinet rail. */
  compact?: boolean;
  className?: string;
}

export function DepthDropdown({
  mode,
  onChange,
  compact,
  className,
}: DepthDropdownProps) {
  const current =
    CABINET_VISIBILITY_OPTIONS.find((o) => o.value === mode) ??
    CABINET_VISIBILITY_OPTIONS[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex items-center gap-1 rounded font-medium text-muted-foreground/80 transition-colors hover:bg-muted/50 hover:text-foreground data-[popup-open]:bg-muted/60 data-[popup-open]:text-foreground",
          compact ? "px-1 py-0.5 text-[10px]" : "px-1.5 py-0.5 text-[11px]",
          className
        )}
        title={current.label}
      >
        {!compact && <FolderTree className="size-3.5" />}
        <span className="tabular-nums">{current.shortLabel}</span>
        <ChevronDown className="size-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[220px]"
        collisionAvoidance={{ side: "none" }}
      >
        {CABINET_VISIBILITY_OPTIONS.map((opt) => {
          const active = opt.value === mode;
          return (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className="flex items-center justify-between gap-3 py-1.5"
            >
              <span className="flex items-center gap-2">
                <span className="inline-flex w-6 shrink-0 justify-center text-[11px] font-semibold tabular-nums text-muted-foreground">
                  {opt.shortLabel}
                </span>
                <span className="text-[12.5px]">{opt.label}</span>
              </span>
              {active && <Check className="size-3.5 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
