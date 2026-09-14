"use client";

import type { ReactNode } from "react";

/**
 * The floating orb, shared by both corners.
 *
 * Voice on the left and chat on the right are the same object with a
 * different icon inside, so they are the same component rather than two that
 * happen to be styled alike. Anything that changes about the look changes in
 * one place and stays a pair.
 *
 * It sits above Retell's own widget, which claims a z-index of 999999.
 */
export default function OrbShell({
  side,
  label,
  note,
  live = false,
  busy = false,
  onClick,
  children,
}: {
  side: "left" | "right";
  label: string;
  /** A short line shown above the orb, for state the icon cannot carry. */
  note?: string;
  live?: boolean;
  busy?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className={`fixed bottom-5 z-[1000000] flex flex-col gap-2 sm:bottom-6 ${
        side === "left"
          ? "left-5 items-start sm:left-6"
          : "right-5 items-end sm:right-6"
      }`}
    >
      {note && (
        <div
          role="status"
          className="max-w-[15rem] rounded-2xl bg-forest px-4 py-2.5 text-sm font-medium text-ivory shadow-lg shadow-forest-ink/20"
        >
          {note}
        </div>
      )}

      {/* The rings sit outside the button so they can grow past its edge
          without the button needing to clip them. */}
      <span className="relative flex h-14 w-14 items-center justify-center sm:h-16 sm:w-16">
        <span aria-hidden="true" className="pointer-events-none absolute inset-0">
          <span className={`orb-wave ${live ? "orb-wave-live" : ""}`} />
          <span className={`orb-wave ${live ? "orb-wave-live" : ""}`} />
          <span className={`orb-wave ${live ? "orb-wave-live" : ""}`} />
        </span>

        <button
          type="button"
          onClick={onClick}
          disabled={busy}
          aria-label={label}
          title={label}
          className={`orb-float relative flex h-14 w-14 items-center justify-center rounded-full text-ivory transition-transform duration-300 hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest disabled:cursor-wait disabled:opacity-80 sm:h-16 sm:w-16 ${
            live ? "orb-face-live" : "orb-face"
          }`}
        >
          {busy && (
            <span className="absolute inset-0 animate-spin rounded-full border-2 border-ivory/25 border-t-ivory" />
          )}
          {children}
        </button>
      </span>
    </div>
  );
}
