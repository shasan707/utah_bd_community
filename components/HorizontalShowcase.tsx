"use client";

import { useRef } from "react";
import Link from "next/link";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import Alpona from "@/components/Alpona";
import { events } from "@/data/events";
import { paletteGradient } from "@/lib/palette";
import { formatDateShort } from "@/lib/format";

function Panel({ index }: { index: number }) {
  const e = events[index];
  return (
    <Link
      href={`/events/${e.slug}`}
      className="group relative flex h-[58vh] w-[74vw] shrink-0 flex-col justify-between overflow-hidden rounded-[2rem] p-8 text-white transition-transform duration-300 hover:scale-[1.015] md:h-[62vh] md:w-[44vw] md:p-10"
      style={{ background: paletteGradient[e.palette] }}
    >
      <Alpona className="absolute -right-16 -top-16 h-64 w-64 text-white/15 transition-transform duration-500 group-hover:rotate-45" />
      <div className="flex items-start justify-between">
        <span className="text-sm font-bold text-white/60">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
          {e.tag}
        </span>
      </div>
      <div>
        <div className="text-4xl font-black leading-tight md:text-5xl">
          {e.banglaTitle}
        </div>
        <div className="mt-2 text-lg font-semibold text-white/85 md:text-xl">{e.title}</div>
        <div className="mt-3 text-sm text-white/75">
          {formatDateShort(e.date)} · {e.venue}
        </div>
        <div className="mt-5 inline-block rounded-full bg-white/15 px-5 py-2 text-sm font-semibold backdrop-blur-sm transition-colors group-hover:bg-white group-hover:text-forest-ink">
          Explore →
        </div>
      </div>
    </Link>
  );
}

/**
 * Pinned section: the page scrolls vertically while the festival panels
 * travel horizontally, driven directly by the scrollbar.
 */
export default function HorizontalShowcase() {
  const targetRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: targetRef });
  const x = useTransform(scrollYProgress, [0, 1], ["1%", "-72%"]);

  if (reduce) {
    return (
      <section className="bg-forest-ink py-20">
        <div className="mx-auto max-w-6xl px-5 pb-8">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-bengal-red">
            ✦ A Year of Festivals
          </p>
          <h2 className="mt-2 text-3xl font-bold text-cream md:text-5xl">
            One Year, All Our Festivals
          </h2>
        </div>
        <div className="flex gap-6 overflow-x-auto px-5 pb-6">
          {events.map((_, i) => (
            <Panel key={i} index={i} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section ref={targetRef} className="relative h-[340vh] bg-forest-ink">
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden">
        <div className="mx-auto w-full max-w-6xl px-5 pb-8">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-bengal-red">
            ✦ A Year of Festivals
          </p>
          <h2 className="mt-2 text-3xl font-bold text-cream md:text-5xl">
            One Year, All Our Festivals
          </h2>
          <p className="mt-2 text-sm text-cream/50">
            Keep scrolling. The year moves with you.
          </p>
        </div>
        <motion.div style={{ x }} className="flex gap-6 pl-[6vw] md:gap-8">
          {events.map((_, i) => (
            <Panel key={i} index={i} />
          ))}
          <div className="flex h-[58vh] w-[40vw] shrink-0 items-center justify-center md:h-[62vh]">
            <Link
              href="/events"
              className="rounded-full border-2 border-cream px-8 py-4 font-semibold text-cream transition-colors hover:bg-cream hover:text-forest-ink"
            >
              All Events →
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
