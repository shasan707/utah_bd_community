"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";

/**
 * Copies the venue address to the clipboard, for pasting into a phone's map
 * app. The confirmation replaces the label for a moment rather than appearing
 * beside it, so the button does not change width and shift the card.
 *
 * Clipboard access can be refused, on an insecure origin or by the browser's
 * own settings, so a refusal selects nothing and says to copy by hand instead
 * of failing silently.
 */
export default function CopyAddress({
  address,
  className = "",
}: {
  address: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 2200);
    return () => clearTimeout(t);
  }, [state]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setState("done");
    } catch {
      setState("failed");
    }
  };

  const label =
    state === "done"
      ? "Address copied"
      : state === "failed"
        ? "Press and hold to copy"
        : "Copy address";

  return (
    <button
      type="button"
      onClick={copy}
      aria-live="polite"
      className={`flex items-center justify-center gap-2 rounded-full border-2 border-forest/30 px-6 py-3 font-semibold text-forest transition-colors hover:border-forest hover:bg-forest/5 ${className}`}
    >
      <Icon name={state === "done" ? "check" : "copy"} className="h-4 w-4" />
      {label}
    </button>
  );
}
