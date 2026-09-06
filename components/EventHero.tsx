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
import Mandala from "@/components/Mandala";
import Countdown from "@/components/Countdown";
import { formatDate, formatTime } from "@/lib/format";
import type { CommunityEvent } from "@/data/events";

/**
 * Events page hero for the soonest upcoming event. Same emerald material as
 * the home page's featured block, with the alponas turning against the
 * scrollbar the way the landing hero's do.
 */
export default function EventHero({ event }: { event: CommunityEvent }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const alponaRotate = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const alponaRotateReverse = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const mandalaRotate = useTransform(scrollYProgress, [0, 1], [0, 45]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -110]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);

  const openness = event.membersOnly ? "Members" : "Open to all";

  return (
    <section
      ref={ref}
      className="emerald-panel relative isolate flex min-h-[88vh] items-center overflow-hidden pt-28 text-ivory"
    >
      {/* Corner mandala, drifting with the scrollbar */}
      <motion.div
        style={reduce ? undefined : { rotate: mandalaRotate }}
        className="pointer-events-none absolute -right-28 -top-40"
        aria-hidden="true"
      >
        <Mandala className="floral-soft h-[34rem] w-[34rem]" />
      </motion.div>

      {/* Alponas turning against the scroll, as on the landing hero */}
      <motion.div
        style={reduce ? undefined : { rotate: alponaRotate }}
        className="pointer-events-none absolute -left-16 top-[14%]"
        aria-hidden="true"
      >
        <Alpona className="floral-soft h-56 w-56 md:h-72 md:w-72" />
      </motion.div>
      <motion.div
        style={reduce ? undefined : { rotate: alponaRotateReverse }}
        className="pointer-events-none absolute -bottom-16 right-[8%]"
        aria-hidden="true"
      >
        <Alpona className="floral-soft h-40 w-40 md:h-56 md:w-56" />
      </motion.div>

      <motion.div
        style={reduce ? undefined : { y: contentY, opacity: contentOpacity }}
        className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-20"
      >
        <motion.span
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="block text-sm font-bold uppercase tracking-[0.2em] text-mint"
        >
          ✦ Next Event
        </motion.span>

        <motion.h1
          initial={reduce ? false : { opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease: [0.21, 0.68, 0.32, 0.99] }}
          className="mt-3 text-5xl font-black leading-[0.95] tracking-tight md:text-7xl lg:text-8xl"
        >
          {event.title}
        </motion.h1>

        <motion.p
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-6 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-base text-ivory-dim md:text-lg"
        >
          <span>{formatDate(event.date)}</span>
          <span aria-hidden="true" className="text-ivory/30">
            ·
          </span>
          <span>{formatTime(event.date)}</span>
          <span aria-hidden="true" className="text-ivory/30">
            ·
          </span>
          {event.mapUrl ? (
            <a
              href={event.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-mint/50 underline-offset-4 transition-colors hover:decoration-ivory"
            >
              {event.venue}
            </a>
          ) : (
            <span>{event.venue}</span>
          )}
        </motion.p>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="mt-5 flex flex-wrap items-center gap-3"
        >
          <p className="max-w-xl text-lg text-ivory-dim">{event.blurb}</p>
          <span className="rounded-full bg-ivory/15 px-3 py-1 text-xs font-semibold text-ivory">
            {openness}
          </span>
        </motion.div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6 }}
        >
          <div className="mt-9 text-xs font-semibold uppercase tracking-widest text-mint">
            Counting down
          </div>
          <Countdown target={event.date} light className="mt-3 flex-wrap" />
        </motion.div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.7 }}
          className="mt-9 flex flex-wrap gap-4"
        >
          <Link
            href="/register"
            className="rounded-full bg-flag-red px-8 py-4 font-semibold text-white shadow-sm transition-transform hover:scale-105"
          >
            Register &amp; Pay
          </Link>
          <Link
            href={`/events/${event.slug}`}
            className="rounded-full border-[1.5px] border-ivory/40 bg-transparent px-8 py-4 font-semibold text-ivory transition-colors hover:bg-ivory hover:text-forest"
          >
            Event Details
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
