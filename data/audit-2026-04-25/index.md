---
title: "Cabinet — Pre-Release Product & UX Audit"
created: '2026-04-25T00:00:00.000Z'
modified: '2026-04-25T00:00:00.000Z'
tags:
  - audit
  - product
  - ux
  - pre-release
order: 0
---

# Cabinet — Pre-Release Product & UX Audit

**Auditor persona.** Top product + UX from Netflix, Meta, and the Claude team — wearing the same hat.
**Scope.** Web app served by `npm run dev:all` (Next.js + daemon, ports 4000 / 4100), build `0.3.4`, branch `dev/pre-release`, fresh boot on macOS, Chrome DevTools-driven walkthrough.
**Method.** Cold-boot the app, accept the disclaimer, walk every primary surface (Home, Editor, Agents, Tasks, Search, Settings, Terminal), capture screenshots, and read the network + console while clicking.
**Output.** This index + summary table at top, then one page per issue under `issues/` (134 total), grouped by area. Screenshots in `screenshots/`.

> This audit is **harsh on purpose**. The goal is to find every paper-cut and structural soft spot before a public release that will be judged in the first 5 minutes. Findings range from showstoppers to typography nitpicks; severity is called out per row.

## How to read this

- **Severity:** P0 (ship-blocker), P1 (high — fix before launch), P2 (medium — fix in next sprint), P3 (polish), P4 (nice-to-have).
- **Area:** BOOT, DISC (disclaimer/tour), HOME, NAV, EDIT, AG (agents), TASKS, SEARCH, SETT, STATUS, A11Y, PERF, COPY, SCHED, URL, MISC.
- **Type:** bug · UX · a11y · perf · copy · info-arch · branding.
- Each issue page has: observation, repro, recommendation, effort estimate, screenshot.

## Top 10 things I would fix this week

1. **#001** — `better-sqlite3` mismatch silently bricks the daemon when Node version drifts. Hard fail at boot, surface in UI.
2. **#008** — Disclaimer dismissal is not persistent — users re-sign every reload.
3. **#016** — GitHub stars badge flickers between three different values inside one navigation.
4. **#021** — Hash routes don't deep-link. Reloading a page URL drops the user on the homescreen.
5. **#038** — "Save failed" indicator sticks on the page even when there's nothing to save.
6. **#059** — Agent transcript concatenates sub-agent updates without line breaks — looks broken.
7. **#060** — Shell init line `running .zshenv 🌸` is leaking into agent output.
8. **#070** — Schedule view re-renders the same week 6× — no date variance.
9. **#082** — Settings → Profile dumps 230+ avatar/icon buttons with no search or grouping.
10. **#092** — Status pill says "All Systems Running" while the daemon is in fact down (optimistic UI).

## Themes

1. **Optimistic UI hides real failures.** Status, save state, and stars badge all show stale or wrong info before reality lands.
2. **Routes are inconsistent.** Two URL taxonomies coexist (`#/page/...` and `#/cabinet/./...`), and only one deep-links.
3. **Surface area outpaces affordance.** The status bar, toolbar, settings page, and avatar picker each carry too much in one row.
4. **Modals trap focus poorly.** Disclaimer + tour stack on top of each other; aria-hidden ancestors hold focused descendants.
5. **Copy is loose.** Mixed casing, repeating CTAs, vague verbs ("Mute"), undefined nouns ("Heartbeat" explained 2× but never on first use).
6. **Skills + provider story is invisible from the UI.** Half the agent value depends on `~/.cabinet/skills/` and CLI installs that have no in-app onboarding.

## Walkthrough — what a new user sees

1. **First load** — full-page disclaimer modal (long legal copy). Behind it, a tour modal stacks on top of the homescreen. Two modals + a not-yet-rendered chrome. Confusing first impression. (#006-#011)
2. **Homescreen** — "Good afternoon, Hila." plus a single example prompt and a row of pre-made cabinet templates. Status bar at the bottom is dense (status pill, uncommitted count, pull, replay tour, Discord, GitHub, stars). (#012-#020)
3. **Editor** — Top toolbar, source toggle, AI side panel CTA. Save state is shown in the status bar; "Save failed" sometimes lingers. Slash menu and bubble menu work. (#031-#046)
4. **Agents** — Sidebar lists the 5 default agents. Clicking an agent name in the sidebar lands on the agents *index*, not the agent — only by clicking the card on the index page does the detail page open. Agent detail mixes inline persona editing, a live preview of the same persona, the schedule, and the chat — long single-column scroll. (#047-#060)
5. **Tasks** — Kanban (Inbox / Your Turn / Running / Just Finished / Archive) with one demo task. Drawer opens to a transcript; "Enlarge" full-takes-over the area. Schedule view duplicates the same week 6×. (#061-#075)
6. **Search** — Cmd+K opens a clean dialog but no recent items, no snippets, no fuzzy ranking insight. (#076-#081)
7. **Settings** — 9 tabs. Profile is the longest by far because it lists 230+ avatar + fallback-icon buttons. Skills is empty in this fresh cabinet. (#082-#091)
8. **Status bar / footer** — collects 7 affordances; the status pill is the most important one and is buried among them. (#092-#096)
9. **Terminal** — `Cmd+`` toggle works, but in this audit it didn't visibly open within the viewport. (#127)

## Summary table — all 134 findings

The numbering is stable; click the ID to jump to the issue page.

**Status legend:** 🟢 Done · 🟡 Deferred / waiting · 🔴 Blocked · ⚪ Open · ✱ Skipped

| # | Severity | Area | Title | Status |
|---|---|---|---|---|
| [001](issues/001-better-sqlite3-mismatch.md) | P0 | BOOT | better-sqlite3 NODE_MODULE_VERSION crash silently kills daemon | 🟢 Done |
| [002](issues/002-daemon-down-status-mismatch.md) | P0 | BOOT | Daemon failure surfaces nowhere in UI | 🟢 Done |
| [003](issues/003-next16-middleware-deprecation.md) | P3 | BOOT | Next 16 "middleware" deprecation warning at boot | 🟢 Done |
| [004](issues/004-no-engines-block.md) | P2 | BOOT | `.nvmrc` says 22 but `package.json` has no `engines` block | ✱ Skipped |
| [005](issues/005-postinstall-swallows-errors.md) | P3 | BOOT | `postinstall` silently swallows xattr/chmod errors | 🟢 Done |
| [006](issues/006-disclaimer-no-escape.md) | P2 | DISC | Disclaimer modal cannot be dismissed via Escape key | 🟢 Done |
| [007](issues/007-disclaimer-stacks-on-tour.md) | P1 | DISC | Disclaimer modal and tour modal both visible at once | 🟢 Done |
| [008](issues/008-disclaimer-not-persistent.md) | P0 | DISC | Disclaimer dismissal is not persisted across reloads | 🟢 Done |
| [009](issues/009-tour-autolaunch-no-permanent-skip.md) | P2 | DISC | Tour auto-launches with no "don't show again" toggle | 🟢 Done |
| [010](issues/010-disclaimer-duplicate-buttons.md) | P3 | DISC | Disclaimer has both "I understand" and a "Close" X | 🟢 Done |
| [011](issues/011-aria-hidden-focused-descendant.md) | P1 | A11Y | aria-hidden on a focused descendant breaks AT | 🟢 Done |
| [012](issues/012-greeting-single-example.md) | P3 | HOME | Single canned prompt example is brittle | 🟢 Done |
| [013](issues/013-templates-no-scroll-affordance.md) | P3 | HOME | Templates row has no visible scroll affordance | 🟢 Done |
| [014](issues/014-browse-all-button-vs-link.md) | P3 | HOME | "Browse all →" is a button styled like a link | 🟢 Done |
| [015](issues/015-uncommitted-count-vague.md) | P2 | STATUS | "53 uncommitted" status text has no link / context | 🟢 Done |
| [016](issues/016-stars-badge-flicker.md) | P0 | HOME | GitHub stars badge flickers between 3 values | 🟢 Done |
| [017](issues/017-replay-tour-in-status-bar.md) | P3 | HOME | Replay-tour button buried in status bar | 🟢 Done |
| [018](issues/018-status-bar-overcrowded.md) | P2 | STATUS | Status bar packs 7 affordances in one row | 🟢 Done |
| [019](issues/019-send-button-disabled-no-cue.md) | P3 | HOME | Send button disabled state lacks hint | 🟢 Done |
| [020](issues/020-runnow-vs-heartbeat-confusion.md) | P2 | HOME | Run-now menu mixes one-off and recurring concepts | 🟢 Done |
| [021](issues/021-hash-routes-no-deep-link.md) | P0 | URL | `#/cabinet/./...` URLs don't deep-link on reload | 🟢 Done |
| [022](issues/022-sidebar-tabs-no-shortcut.md) | P3 | NAV | Sidebar tabs lack keyboard shortcuts | 🟢 Done |
| [023](issues/023-agent-sidebar-click-wrong-target.md) | P1 | AG | Clicking an agent in the sidebar opens the agents *list* | 🟢 Done |
| [024](issues/024-add-to-buttons-same-icon.md) | P3 | NAV | Three "Add to ..." buttons share one icon | 🟢 Done |
| [025](issues/025-sidebar-resize-no-double-click.md) | P3 | NAV | Sidebar resize handle has no double-click reset | 🟢 Done |
| [026](issues/026-sidebar-state-not-persisted.md) | P3 | NAV | Sidebar collapsed/expanded state is not persisted | 🟢 Done |
| [027](issues/027-cabinet-name-inconsistent.md) | P2 | NAV | "My Cabinet" vs "Cabinet" label flips by entry point | 🟢 Done |
| [028](issues/028-lowercase-cabinet-home.md) | P3 | NAV | Tiny lowercase `cabinet` text is actually a button | 🟢 Done |
| [029](issues/029-no-breadcrumbs.md) | P2 | NAV | No breadcrumbs for nested folders | 🟢 Done |
| [030](issues/030-tree-no-recency.md) | P3 | NAV | Page tree lacks modification recency cues | 🟡 Deferred |
| [031](issues/031-toolbar-overflow.md) | P2 | EDIT | Editor toolbar wraps and breaks layout at narrow widths | 🟢 Done |
| [032](issues/032-slash-menu-discoverability.md) | P3 | EDIT | Slash menu has no hover hint | 🟢 Done |
| [033](issues/033-source-toggle-copy.md) | P4 | EDIT | "Source" toggle copy could read "Markdown" | 🟢 Done |
| [034](issues/034-page-h1-too-small.md) | P3 | EDIT | Page H1 inherits breadcrumb size — feels secondary | 🟢 Done |
| [035](issues/035-ai-panel-redundant-cta.md) | P3 | EDIT | AI panel CTA repeats the textarea placeholder | 🟢 Done |
| [036](issues/036-ai-panel-placeholder-mismatch.md) | P4 | EDIT | AI panel button vs placeholder copy mismatch | 🟢 Done |
| [037](issues/037-ai-panel-model-grayed.md) | P3 | EDIT | AI panel model picker grayed without explanation | 🟢 Done |
| [038](issues/038-save-failed-sticky.md) | P0 | EDIT | "Save failed" persists after a no-op page open | 🟢 Done |
| [039](issues/039-cmd-s-undiscoverable.md) | P3 | EDIT | Cmd+S "Force save" not surfaced anywhere | 🟢 Done |
| [040](issues/040-no-autosave-indicator.md) | P3 | EDIT | No live auto-save indicator while typing | 🟢 Done |
| [041](issues/041-toolbar-no-active-state.md) | P3 | EDIT | Toolbar buttons missing active/applied state styling | 🟢 Done |
| [042](issues/042-rtl-toggle-prime-real-estate.md) | P4 | EDIT | RTL toggle takes prime toolbar slot | 🟢 Done |
| [043](issues/043-shortcut-hint-only-in-persona.md) | P3 | EDIT | Keyboard hint shown only in agent persona editor | 🟢 Done |
| [044](issues/044-drag-handle-hover-only.md) | P3 | EDIT | Drag handle is hover-only — invisible on touch | ⚪ Open |
| [045](issues/045-no-image-gallery.md) | P4 | EDIT | No gallery view for image-heavy folders | ⚪ Open |
| [046](issues/046-tree-drag-no-preview.md) | P3 | NAV | Sidebar drag-to-reorder lacks preview rect | 🟡 Deferred |
| [047](issues/047-agents-tab-blank-flash.md) | P3 | AG | Agents tab briefly renders blank main panel | 🟢 Done |
| [048](issues/048-agent-card-comma-string.md) | P3 | AG | Agent card metadata is one comma-joined string | 🟢 Done |
| [049](issues/049-org-chart-untested.md) | P3 | AG | Org chart entry point untested in this build | 🟢 Done |
| [050](issues/050-can-dispatch-no-tooltip.md) | P3 | AG | "Can dispatch" toggle has no tooltip | 🟢 Done |
| [051](issues/051-persona-double-render.md) | P2 | AG | Persona editor + live preview render same content twice | 🟢 Done |
| [052](issues/052-skills-no-onboarding.md) | P1 | AG | Skills require shell setup with no in-app guidance | 🟢 Done |
| [053](issues/053-provider-readonly.md) | P3 | AG | Provider field is readonly with no inline change | 🟢 Done |
| [054](issues/054-schedule-pause-only-via-manage.md) | P3 | AG | Heartbeat pause buried under "Manage" | 🟢 Done |
| [055](issues/055-recent-work-empty-state.md) | P3 | AG | "Recent work" empty state has no link to past runs | 🟢 Done |
| [056](issues/056-suggestion-buttons-static.md) | P3 | AG | Agent quick-action suggestion buttons are static | 🟢 Done |
| [057](issues/057-back-to-agents-not-breadcrumb.md) | P3 | AG | "Back to agents" should be breadcrumbs | 🟢 Done |
| [058](issues/058-avatar-picker-no-context-preview.md) | P3 | AG | Avatar/icon picker has no in-context preview | 🟡 Deferred |
| [059](issues/059-transcript-no-newlines.md) | P0 | AG | Sub-agent updates concatenate without line breaks | 🟢 Done |
| [060](issues/060-zshenv-leak.md) | P0 | AG | Shell init `running .zshenv 🌸` leaks into transcript | 🟢 Done |
| [061](issues/061-kanban-cramped.md) | P2 | TASKS | 5 columns cramped at 1440px viewport | 🟢 Done |
| [062](issues/062-inbox-empty-state.md) | P3 | TASKS | INBOX empty state competes with column header | 🟢 Done |
| [063](issues/063-your-turn-no-badge.md) | P3 | TASKS | YOUR TURN doesn't distinguish question vs approval | 🟢 Done |
| [064](issues/064-running-collapsed-default.md) | P3 | TASKS | RUNNING column collapsed by default | 🟢 Done |
| [065](issues/065-card-action-aria-bundle.md) | P1 | A11Y | Task card actions read as one big button | 🟢 Done |
| [066](issues/066-compact-rows-no-effect.md) | P3 | TASKS | Compact-rows toggle has no perceptible effect | 🟢 Done |
| [067](issues/067-enlarge-disorienting.md) | P3 | TASKS | "Enlarge" instantly takes over with no transition | 🟢 Done |
| [068](issues/068-task-title-truncate-no-tooltip.md) | P3 | TASKS | Long task titles truncate without tooltip | 🟢 Done |
| [069](issues/069-mute-button-ambiguous.md) | P2 | TASKS | "Mute" button copy is ambiguous | 🟢 Done |
| [070](issues/070-schedule-view-duplicate-week.md) | P0 | SCHED | Schedule view repeats the same week 6× | 🟢 Done |
| [071](issues/071-schedule-no-empty-day.md) | P3 | SCHED | Schedule view has no empty-day messaging | 🟢 Done |
| [072](issues/072-filter-tabs-meaning.md) | P3 | TASKS | Manual / Jobs / Heartbeat tabs lack tooltips | 🟢 Done |
| [073](issues/073-delete-all-no-confirm.md) | P1 | TASKS | "Delete all shown tasks" needs confirm dialog | 🟢 Done |
| [074](issues/074-send-disabled-no-hint.md) | P3 | TASKS | Send button disabled state lacks reason | 🟢 Done |
| [075](issues/075-close-x-and-esc-redundant.md) | P4 | TASKS | Close X and Esc both shown inline | 🟢 Done |
| [076](issues/076-cmdk-no-recent.md) | P3 | SEARCH | Cmd+K has no recent items | 🟢 Done |
| [077](issues/077-search-no-fuzzy-boost.md) | P3 | SEARCH | No fuzzy / recency boost surfaced | 🟡 Deferred |
| [078](issues/078-empty-search-no-suggestions.md) | P3 | SEARCH | Empty search lacks suggestions | 🟢 Done |
| [079](issues/079-search-no-snippets.md) | P2 | SEARCH | Results don't preview content snippets | 🟢 Done |
| [080](issues/080-tab-shortcut-conflicts.md) | P3 | SEARCH | "Tab = next match" conflicts with focus order | 🟢 Done |
| [081](issues/081-cmdk-hint-redundant.md) | P4 | SEARCH | ⌘K hint repeats inside the dialog itself | 🟢 Done |
| [082](issues/082-profile-avatar-overload.md) | P0 | SETT | Profile dumps 230+ avatar/icon buttons unfiltered | 🟢 Done |
| [083](issues/083-avatar-ip-risk.md) | P1 | SETT | Avatar names use copyrighted characters / fan tags | 🟢 Done |
| [084](issues/084-accent-color-no-contrast-warn.md) | P3 | SETT | Accent color picker lacks contrast warnings | 🟢 Done |
| [085](issues/085-workspace-below-fold.md) | P2 | SETT | Workspace section sits below 230 avatar buttons | 🟢 Done |
| [086](issues/086-no-save-above-fold.md) | P3 | SETT | No Save button above the fold | 🟢 Done |
| [087](issues/087-notifications-tab-untested.md) | P3 | SETT | Notifications tab not visited in audit (gap) | 🟢 Done |
| [088](issues/088-about-version-mismatch.md) | P3 | SETT | About version may not match `cabinet-release.json` | 🟢 Done |
| [089](issues/089-skills-home-vs-project.md) | P2 | SETT | Skills path is `~/.cabinet/skills` — confusing for project isolation | 🟡 Deferred |
| [090](issues/090-settings-link-slash-style.md) | P3 | URL | Settings link uses `#settings/...` (no leading slash) | 🟢 Done |
| [091](issues/091-settings-tabs-not-links.md) | P3 | SETT | Settings tabs are buttons — no right-click open | 🟢 Done |
| [092](issues/092-status-pill-lies.md) | P0 | STATUS | "All Systems Running" while daemon is down | 🟢 Done |
| [093](issues/093-pi-provider-branding.md) | P4 | STATUS | "Pi" provider name is unclear | 🟢 Done |
| [094](issues/094-not-installed-no-cta.md) | P2 | STATUS | "Not installed" rows lack one-click install | 🟢 Done |
| [095](issues/095-pull-button-no-remote.md) | P3 | STATUS | Pull button shown for non-git cabinets | 🟢 Done |
| [096](issues/096-stars-source-of-truth.md) | P2 | STATUS | Stars badge has no single source of truth | 🟢 Done |
| [097](issues/097-aria-hidden-focused.md) | P1 | A11Y | Modal hides focused element from AT | 🟢 Done |
| [098](issues/098-form-fields-no-id.md) | P2 | A11Y | Form fields without id/name (browser issue) | 🟢 Done |
| [099](issues/099-icon-only-buttons-contrast.md) | P3 | A11Y | Icon-only buttons rely on description for AT | 🟢 Done |
| [100](issues/100-status-color-only.md) | P2 | A11Y | Status uses color only — no shape/text fallback | 🟢 Done |
| [101](issues/101-focus-rings-light-theme.md) | P3 | A11Y | Focus rings hard to see in light theme | 🟢 Done |
| [102](issues/102-drag-no-keyboard.md) | P2 | A11Y | Drag handle has no keyboard equivalent | 🟢 Done |
| [103](issues/103-esc-not-universal.md) | P3 | A11Y | Esc closes some dialogs but not the disclaimer | 🟢 Done |
| [104](issues/104-conversations-poll-storm.md) | P2 | PERF | Repeated `/conversations` and `/sessions` polls | 🟢 Done |
| [105](issues/105-health-poll-loop.md) | P3 | PERF | `/api/health` polled per page open | 🟢 Done |
| [106](issues/106-fast-refresh-logs-prod.md) | P3 | PERF | Fast Refresh logs may leak into prod | 🟢 Done |
| [107](issues/107-telemetry-on-by-default-dev.md) | P2 | PERF | Telemetry init runs in `dev:all` by default | 🟢 Done |
| [108](issues/108-no-offline.md) | P4 | PERF | No service worker / offline support | ⚪ Open |
| [109](issues/109-disclaimer-too-long.md) | P2 | COPY | Disclaimer paragraph is intimidating wall of text | 🟢 Done |
| [110](issues/110-mixed-verb-casing.md) | P3 | COPY | Inconsistent verb pattern across "Add ..." buttons | 🟢 Done |
| [111](issues/111-chat-vs-discord.md) | P4 | COPY | Footer "Chat" link is unclear (means Discord) | 🟢 Done |
| [112](issues/112-stars-format-inconsistent.md) | P3 | COPY | Stars badge format varies (`1,703` vs `244` vs `1,236`) | 🟢 Done |
| [113](issues/113-heartbeat-explained-twice.md) | P3 | COPY | "Heartbeat" defined in both tour and Agents page | 🟢 Done |
| [114](issues/114-tour-replay-icon-ambiguous.md) | P4 | COPY | Tour-replay icon ambiguous | 🟢 Done |
| [115](issues/115-mention-picker-perf.md) | P3 | COPY | `@mention` picker behavior on slow networks unverified | 🟢 Done |
| [116](issues/116-schedule-week-repeat-bug.md) | P0 | SCHED | Same week renders 6× in calendar (rendering bug) | 🟢 Done |
| [117](issues/117-did-not-run-no-runnow.md) | P3 | SCHED | "did not run" rows lack inline Run-now | 🟢 Done |
| [118](issues/118-no-cron-source-toggle.md) | P3 | SCHED | No way to inspect/edit raw cron in UI | 🟢 Done |
| [119](issues/119-heartbeats-no-cabinet-mute.md) | P3 | SCHED | Heartbeats can't be muted per cabinet | 🟢 Done |
| [120](issues/120-add-routine-duplicate-entry.md) | P3 | SCHED | "Add scheduled job" has duplicate entry points | 🟢 Done |
| [121](issues/121-route-taxonomy-mixed.md) | P1 | URL | Two URL taxonomies coexist (`#/page/...` vs `#/cabinet/./...`) | 🟢 Done |
| [122](issues/122-url-no-cabinet-name.md) | P3 | URL | URLs don't include human-readable cabinet name | 🟡 Deferred |
| [123](issues/123-deeplink-survives-update.md) | P3 | URL | Deep links don't survive Electron auto-update | 🟡 Deferred |
| [124](issues/124-no-section-anchor.md) | P4 | URL | No `?focus=section` anchor support | ⚪ Open |
| [125](issues/125-zshenv-leak-source.md) | P0 | MISC | Shell init noise leaks via spawned PTY | 🟢 Done |
| [126](issues/126-save-failed-no-retry.md) | P2 | EDIT | "Save failed" lacks a retry control | 🟢 Done |
| [127](issues/127-terminal-toggle-no-feedback.md) | P3 | MISC | `Cmd+`` terminal toggle gave no visible feedback | 🟢 Done |
| [128](issues/128-global-agents-architecture.md) | P0 | AG | Global agents (start with editor): one identity, every cabinet | 🟢 Done |
| [129](issues/129-sidebar-cabinet-click-traps-view.md) | P0 | NAV | Sidebar cabinet click forces a view switch instead of acting like a folder | 🟢 Done |
| [130](issues/130-new-task-button-routes-instead-of-overlaying.md) | P0 | TASKS | "+ New Task" routes to tasks page before opening the dialog | 🟢 Done |
| [131](issues/131-post-launch-task-surface.md) | P0 | TASKS | Post-launch task surface: side panel by default, full-screen by promotion | 🟢 Done |
| [132](issues/132-sidebar-tasks-truncated-without-load-more.md) | P2 | NAV | Sidebar Recent Tasks caps at 6 with no way to see older | 🟢 Done |
| [133](issues/133-agents-navbar-thick-scrollbar.md) | P3 | TASKS | Tasks-board AGENTS strip shows a chunky native scrollbar | 🟢 Done |
| [134](issues/134-list-view-theme-mismatch.md) | P3 | TASKS | List view trigger badges fight the active theme | 🟢 Done |
| [135](issues/135-conflicting-keyboard-shortcuts.md) | P1 | A11Y | Global shortcuts conflict with macOS/browser system keys (⌘N, ⌘M, ⌘\`) | 🟢 Done |
| [136](issues/136-at-mention-not-implemented.md) | P2 | EDIT | @ mention hinted in status bar but extension not implemented | 🟢 Done |
| [137](issues/137-kb-page-lost-on-navigation.md) | P2 | NAV | Navigating to Agents/Tasks loses the open KB page on return | ⚪ Open |
| [138](issues/138-schedule-list-view-redundant.md) | P3 | SCHED | Tasks schedule tab has a Calendar/List toggle — list view is redundant | 🟢 Done |
| [139](issues/139-no-dynamic-tab-title.md) | P3 | NAV | Browser tab always shows "Cabinet" regardless of current page/section | 🟢 Done |
| [140](issues/140-inbox-add-button-hidden-when-tasks-exist.md) | P3 | TASKS | "Add task" affordance disappears once Inbox has any tasks | 🟢 Done |
| [141](issues/141-navigation-url-rethink.md) | P1 | NAV/URL | Navigation & URL rethink — page restoration + clean URL scheme (#122, #124, #137) | 🟢 Done |
| [142](issues/142-at-mention-editor.md) | P2 | EDIT | @ mention in KB editor — agents, pages, skills picker with inline chip | 🟡 In Progress |

## Suggested next steps

1. **Triage P0/P1 in a single sprint.** 23 issues, mostly UI rendering bugs and trust-eroding "lying" status indicators.
2. **Run a 5-second test** on the disclaimer + tour combo with 5 users — almost certainly the worst part of the first impression.
3. **Pick one URL taxonomy and migrate.** The current dual scheme will rot and break Electron deep links.
4. **Hire an a11y pass.** ~10 findings here are accessibility regressions — bottle them into one ticket and run axe on every primary surface.
5. **Set a "no-lies" rule.** Status indicators, save state, and external counts must reflect ground truth or be marked as stale.

— End of index. See `issues/` for the per-finding pages.
