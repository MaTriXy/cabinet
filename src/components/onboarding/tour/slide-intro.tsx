"use client";

import { useEffect, useState } from "react";
import { MockupSidebar } from "./mockup-sidebar";
import { TOUR_PALETTE as P } from "./palette";

// Orchestrated timing for the intro sequence. Copy lands first, then the
// Cabinet shell pops in narrow, expands horizontally, reveals its title,
// and finally the three drawer tabs populate one by one.
const COPY_H1_DELAY = 80;
const COPY_SUB_DELAY = 240;
const SHELL_APPEAR_DELAY = 520; // when the cabinet shell fades in narrow
const EXPAND_TRIGGER_DELAY = 820; // when width starts animating out
const EXPAND_DURATION = 680; // width morph duration
const TITLE_REVEAL_DELAY = EXPAND_TRIGGER_DELAY + EXPAND_DURATION; // ~1500ms
const TABS_START_DELAY = TITLE_REVEAL_DELAY + 120; // tabs follow title

const NARROW_WIDTH = 92;
const FULL_WIDTH = 300;

export function SlideIntro() {
  // Flip from narrow → full width after the shell has popped in, so the
  // CSS transition has both values to animate between.
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setExpanded(true), EXPAND_TRIGGER_DELAY);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-10">
      <div className="flex flex-col items-center gap-3 text-center max-w-2xl">
        <h2
          className="font-logo text-5xl tracking-tight italic opacity-0 lg:text-6xl"
          style={{
            color: P.text,
            animation: "cabinet-tour-fade-up 0.55s ease-out forwards",
            animationDelay: `${COPY_H1_DELAY}ms`,
          }}
        >
          Meet your <span style={{ color: P.accent }}>Cabinet</span>.
        </h2>
        <p
          className="font-body-serif text-lg leading-relaxed opacity-0 lg:text-xl"
          style={{
            color: P.textSecondary,
            animation: "cabinet-tour-fade-up 0.55s ease-out forwards",
            animationDelay: `${COPY_SUB_DELAY}ms`,
          }}
        >
          Your AI team. Your knowledge base. One place.
        </p>
      </div>

      {/* Width-morph wrapper. Starts narrow so the bottom drawer rail
          reads as a near-square, then eases out to the tour width. */}
      <div
        className="opacity-0"
        style={{
          width: expanded ? FULL_WIDTH : NARROW_WIDTH,
          transition: `width ${EXPAND_DURATION}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          animation: "cabinet-tour-pop-in 0.5s ease-out forwards",
          animationDelay: `${SHELL_APPEAR_DELAY}ms`,
        }}
      >
        <MockupSidebar
          activeTab={null}
          title="Cabinet"
          titleDelay={TITLE_REVEAL_DELAY}
          headerBadge=""
          hideBody
          tabsPopIn
          tabsPopInDelay={TABS_START_DELAY}
          viewTransitionName="cabinet-card"
        />
      </div>
    </div>
  );
}
