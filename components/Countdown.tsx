"use client";

import { useEffect, useState } from "react";

type CountdownProps = {
  target: string; // ISO date
  className?: string;
  light?: boolean;
};

type Parts = { days: number; hours: number; minutes: number; seconds: number };

function partsUntil(target: string): Parts {
  const diff = Math.max(new Date(target).getTime() - Date.now(), 0);
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1000),
  };
}

/** Live countdown to an event date. Renders after mount to avoid hydration drift. */
export default function Countdown({
  target,
  className = "",
  light = false,
}: CountdownProps) {
  const [parts, setParts] = useState<Parts | null>(null);

  useEffect(() => {
    setParts(partsUntil(target));
    const id = setInterval(() => setParts(partsUntil(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  const cells: { label: string; value: number }[] = [
    { label: "Days", value: parts?.days ?? 0 },
    { label: "Hours", value: parts?.hours ?? 0 },
    { label: "Min", value: parts?.minutes ?? 0 },
    { label: "Sec", value: parts?.seconds ?? 0 },
  ];

  return (
    <div className={`flex gap-3 ${className}`} suppressHydrationWarning>
      {cells.map((c) => (
        <div
          key={c.label}
          className={`flex min-w-16 flex-col items-center px-3 py-2 ${
            light
              ? "glass-card backdrop-blur-md text-ivory"
              : "rounded-2xl bg-forest text-ivory"
          }`}
        >
          <span className="text-2xl font-bold tabular-nums md:text-3xl">
            {String(c.value).padStart(2, "0")}
          </span>
          <span className="glass-label text-[10px] uppercase tracking-widest">
            {c.label}
          </span>
        </div>
      ))}
    </div>
  );
}
