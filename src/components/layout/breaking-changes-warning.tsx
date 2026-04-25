"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Heart } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// Bump when the disclaimer text materially changes — older acks become
// invalid and the user gets re-prompted with the new copy. The literal
// suffix is preserved (`:v2`) so existing users' acks aren't wiped.
const DISCLAIMER_VERSION = "v2";
const STORAGE_KEY = `cabinet.breaking-changes-warning-ack:${DISCLAIMER_VERSION}`;
const SERVER_ENDPOINT = "/api/disclaimer";

// Fired after the user explicitly accepts the disclaimer. Other surfaces
// (e.g. the tour auto-open) listen for this so they can sequence behind the
// disclaimer instead of stacking on top of it.
export const DISCLAIMER_ACKED_EVENT = "cabinet:disclaimer-acked";

export function isDisclaimerAcknowledged(): boolean {
  // Synchronous check for callers that need an immediate answer (e.g. the
  // tour-gate in app-shell). Server-side state is mirrored to localStorage
  // by the dialog component on mount, so this stays the source of truth
  // for downstream consumers.
  if (typeof window === "undefined") return false;
  try {
    return !!window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode); fail open so we don't block the
    // rest of the app forever on a check we can't perform.
    return true;
  }
}

export function BreakingChangesWarning() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    let local: string | null = null;
    try {
      local = localStorage.getItem(STORAGE_KEY);
    } catch {
      // localStorage unavailable (private mode, SSR); fall through to server
    }

    if (local) return;

    // No local ack — check server before showing. Survives browser-storage
    // clears, browser switches on the same install, and "Forget this site"
    // accidents. A server miss (404/500/network) falls back to "show the
    // disclaimer" — never silently skip it.
    void fetch(`${SERVER_ENDPOINT}?v=${DISCLAIMER_VERSION}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          setOpen(true);
          return;
        }
        const data = (await res.json()) as { acked?: boolean; acceptedAt?: string };
        if (data.acked) {
          // Mirror to localStorage so future loads are sync-fast; also tell
          // the tour gate it can proceed (otherwise it would still wait
          // forever on a missing local ack).
          try {
            localStorage.setItem(
              STORAGE_KEY,
              data.acceptedAt || new Date().toISOString(),
            );
          } catch {
            /* ignore */
          }
          window.dispatchEvent(new CustomEvent(DISCLAIMER_ACKED_EVENT));
        } else {
          setOpen(true);
        }
      })
      .catch(() => {
        if (!cancelled) setOpen(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const acknowledge = () => {
    const acceptedAt = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY, acceptedAt);
    } catch {
      // noop
    }
    // Fire-and-forget: the server-side persistence is a backup so future
    // "I cleared my browser storage" reloads stay quiet; the local ack is
    // the source of truth for *this* session, so we don't block UX on it.
    void fetch(SERVER_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ version: DISCLAIMER_VERSION, acceptedAt }),
    }).catch(() => {
      /* server unreachable — local ack still holds */
    });
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(DISCLAIMER_ACKED_EVENT));
    }
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v, details) => {
        if (v) return;
        // Esc and outside clicks must not auto-accept the legal disclaimer;
        // acceptance has to be a deliberate click on "I understand, continue"
        // (or the X). Reasons we ignore: "escape-key", "outside-press".
        const reason = details?.reason;
        if (reason === "escape-key" || reason === "outside-press") {
          details?.cancel?.();
          return;
        }
        acknowledge();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Heads up: Cabinet is in active development
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Cabinet is open-source software under active development and may
            introduce breaking changes without notice. You are running it at
            your own risk.
          </p>
          <p>
            Cabinet orchestrates third-party AI agents (Claude Code, Codex,
            Cursor, and others) and by design runs them with elevated
            permissions (e.g. <code className="px-1 py-0.5 rounded bg-muted font-mono text-xs">--dangerously-skip-permissions</code>)
            so they can read, modify, and delete files in your knowledge base
            and linked repositories. Agents can make mistakes, and the data
            you send to AI providers is governed by their terms, not ours.
          </p>
          <p>
            <strong className="text-foreground">Please back up anything you care about.</strong>{" "}
            If you&apos;re not comfortable with autonomous agents touching
            your files, or you&apos;re not keeping your own copies of
            important data, Cabinet may not be for you yet.
          </p>
          <p className="text-xs">
            Cabinet is provided &ldquo;as is&rdquo;, without warranty of any
            kind. The maintainers and contributors accept no liability for
            data loss, corruption, leakage, or any other harm arising from
            your use of Cabinet or the AI providers it integrates with. By
            continuing you agree to our{" "}
            <a
              href="https://runcabinet.com/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="https://runcabinet.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Privacy Policy
            </a>
            .
          </p>
          <p className="flex items-center gap-1.5">
            Thanks for being here. Community patience keeps this project
            moving <Heart className="h-3.5 w-3.5 inline text-rose-500" fill="currentColor" />
          </p>
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={acknowledge}>I understand, continue</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
