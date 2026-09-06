"use client";

import { useState } from "react";

export type DayPoint = { date: string; label: string; paid: number; waiting: number };

/** Paid = confirmed registrations, waiting = still pending. Status colors, validated. */
const PAID = "#0E7C5B";
const WAITING = "#D9A21B";

/**
 * Registrations per day for the last two weeks, stacked by whether they
 * have paid. Inline SVG with a hover tooltip and a table view.
 */
export default function DailyChart({ days }: { days: DayPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);

  const max = Math.max(1, ...days.map((d) => d.paid + d.waiting));
  const W = 640;
  const H = 180;
  const padL = 28;
  const padB = 26;
  const padT = 10;
  const innerW = W - padL - 8;
  const innerH = H - padB - padT;
  const slot = innerW / Math.max(1, days.length);
  const barW = Math.max(6, Math.min(28, slot * 0.6));
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  const ticks = [0, Math.ceil(max / 2), max];
  const total = days.reduce((s, d) => s + d.paid + d.waiting, 0);

  return (
    <div className="rounded-3xl border border-sand bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-forest">
            Registrations, last 14 days
          </h3>
          <p className="mt-1 text-sm text-forest-ink/60">
            {total} in total, by the day they registered.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-forest-ink/70">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: PAID }} />
            paid
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: WAITING }} />
            waiting
          </span>
          <button
            type="button"
            onClick={() => setTable((t) => !t)}
            className="rounded-full border border-sand px-3 py-1 font-semibold text-forest-ink/70 hover:border-forest"
          >
            {table ? "Chart" : "Table"}
          </button>
        </div>
      </div>

      {table ? (
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-forest-ink/50">
              <th className="py-1 font-semibold">Day</th>
              <th className="py-1 text-right font-semibold">Paid</th>
              <th className="py-1 text-right font-semibold">Waiting</th>
              <th className="py-1 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date} className="border-t border-sand/70">
                <td className="py-1.5 text-forest-ink">{d.label}</td>
                <td className="py-1.5 text-right text-forest-ink">{d.paid}</td>
                <td className="py-1.5 text-right text-forest-ink">{d.waiting}</td>
                <td className="py-1.5 text-right font-semibold text-forest-ink">{d.paid + d.waiting}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative mt-4">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-44 w-full"
            role="img"
            aria-label="Registrations per day, paid and waiting"
            onMouseLeave={() => setHover(null)}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={padL}
                  x2={W - 8}
                  y1={y(t)}
                  y2={y(t)}
                  stroke="#dfd8cb"
                  strokeWidth={1}
                />
                <text x={padL - 6} y={y(t) + 4} fontSize={10} textAnchor="end" fill="#676d68">
                  {t}
                </text>
              </g>
            ))}
            {days.map((d, i) => {
              const x = padL + i * slot + (slot - barW) / 2;
              const paidTop = y(d.paid);
              const waitTop = y(d.paid + d.waiting);
              const gap = d.paid > 0 && d.waiting > 0 ? 2 : 0;
              const active = hover === i;
              return (
                <g
                  key={d.date}
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  tabIndex={0}
                >
                  <rect x={padL + i * slot} y={padT} width={slot} height={innerH} fill="transparent" />
                  {d.paid > 0 && (
                    <rect
                      x={x}
                      y={paidTop}
                      width={barW}
                      height={y(0) - paidTop}
                      rx={3}
                      fill={PAID}
                      opacity={hover === null || active ? 1 : 0.45}
                    />
                  )}
                  {d.waiting > 0 && (
                    <rect
                      x={x}
                      y={waitTop}
                      width={barW}
                      height={Math.max(0, paidTop - waitTop - gap)}
                      rx={3}
                      fill={WAITING}
                      opacity={hover === null || active ? 1 : 0.45}
                    />
                  )}
                  {d.paid + d.waiting > 0 && (
                    <text
                      x={x + barW / 2}
                      y={waitTop - 4}
                      fontSize={10}
                      textAnchor="middle"
                      fill="#1d1d1f"
                      fontWeight={600}
                    >
                      {d.paid + d.waiting}
                    </text>
                  )}
                  <text
                    x={x + barW / 2}
                    y={H - 8}
                    fontSize={10}
                    textAnchor="middle"
                    fill={active ? "#1d1d1f" : "#676d68"}
                  >
                    {d.label}
                  </text>
                </g>
              );
            })}
          </svg>
          {hover !== null && days[hover] && (
            <div
              className="pointer-events-none absolute -top-2 rounded-xl border border-sand bg-white px-3 py-2 text-xs shadow-lg"
              style={{
                left: `${((padL + hover * slot + slot / 2) / W) * 100}%`,
                transform: "translateX(-50%)",
              }}
            >
              <div className="font-semibold text-forest-ink">{days[hover].label}</div>
              <div className="text-forest-ink/70">
                {days[hover].paid} paid, {days[hover].waiting} waiting
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
