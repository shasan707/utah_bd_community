"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import OrbShell from "@/components/OrbShell";

/**
 * The voice assistant, as a floating orb in the bottom left corner.
 *
 * Retell's own widget sits bottom right and has no setting to move it, so the
 * chat half keeps that corner and this side is built here instead. The SDK is
 * pulled in only when somebody actually presses the orb, so a visitor who
 * never calls pays nothing for it.
 *
 * The orb renders nothing at all when the public key is missing, rather than
 * offering a button that cannot work.
 */

type Phase = "idle" | "starting" | "live" | "ending" | "error";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_RETELL_PUBLIC_KEY;
const AGENT_ID =
  process.env.NEXT_PUBLIC_RETELL_VOICE_AGENT_ID ||
  "agent_6525c1227b057c8336482a3668";

/** Minutes and seconds for the timer shown while a call is live. */
function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function MicIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

function StopIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <rect x="7" y="7" width="10" height="10" rx="2" />
    </svg>
  );
}

export default function VoiceOrb() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [note, setNote] = useState("");

  // The live Retell call object, kept out of state so that ending a call does
  // not depend on a render having happened first.
  const callRef = useRef<{ stop?: () => void } | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      try {
        callRef.current?.stop?.();
      } catch {
        // The page is going away; a failure to hang up cleanly is not worth
        // reporting to anybody.
      }
    };
  }, []);

  // The timer only runs while the call is live.
  useEffect(() => {
    if (phase !== "live") return;
    setSeconds(0);
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // An error message clears itself, so the orb returns to resting rather than
  // sitting there red for the rest of the visit.
  useEffect(() => {
    if (phase !== "error") return;
    const id = setTimeout(() => {
      if (mounted.current) {
        setPhase("idle");
        setNote("");
      }
    }, 6000);
    return () => clearTimeout(id);
  }, [phase]);

  const fail = useCallback((message: string) => {
    if (!mounted.current) return;
    callRef.current = null;
    setPhase("error");
    setNote(message);
  }, []);

  const hangUp = useCallback(() => {
    setPhase("ending");
    try {
      callRef.current?.stop?.();
    } catch {
      // Ignore: the call is being torn down either way.
    }
    callRef.current = null;
    if (mounted.current) {
      setPhase("idle");
      setNote("");
    }
  }, []);

  const start = useCallback(async () => {
    if (phase !== "idle" && phase !== "error") return;
    setPhase("starting");
    setNote("");

    try {
      // Loaded on demand, so the SDK never lands on a page nobody calls from.
      const mod = await import("retell-client-js-sdk");
      const RetellClient = (mod as Record<string, unknown>).RetellClient as
        | (new (opts: { key: string }) => {
            createWebCall: (opts: Record<string, unknown>) => unknown;
          })
        | undefined;

      if (typeof RetellClient !== "function") {
        fail("The voice assistant could not load. Please try the chat instead.");
        return;
      }

      const client = new RetellClient({ key: PUBLIC_KEY as string });
      const call = client.createWebCall({
        agent_id: AGENT_ID,
        hooks: {
          onStatus: (status: string) => {
            if (!mounted.current) return;
            if (status === "connected" || status === "ongoing") setPhase("live");
          },
          onEnd: () => {
            if (!mounted.current) return;
            callRef.current = null;
            setPhase("idle");
            setNote("");
          },
          onError: () => {
            fail("The call dropped. Please try again in a moment.");
          },
        },
      });

      callRef.current = call as { stop?: () => void };
      // Some builds report readiness through onStatus and some never do, so
      // the orb goes live here as well rather than hanging on "connecting".
      if (mounted.current && phase !== "error") setPhase("live");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/permission|denied|notallowed/i.test(message)) {
        fail("Microphone blocked. Allow the microphone and try again.");
      } else {
        fail("The call could not start. Please try the chat instead.");
      }
    }
  }, [phase, fail]);

  if (!PUBLIC_KEY) return null;

  const live = phase === "live";
  const busy = phase === "starting" || phase === "ending";

  const label = live
    ? `End call, ${clock(seconds)} elapsed`
    : busy
      ? "Connecting to the voice assistant"
      : "Talk to us";

  return (
    <OrbShell
      side="left"
      label={label}
      note={note || (live ? `Listening, ${clock(seconds)}` : undefined)}
      live={live}
      busy={busy}
      onClick={live ? hangUp : start}
    >
      {live ? <StopIcon /> : <MicIcon />}
    </OrbShell>
  );
}
