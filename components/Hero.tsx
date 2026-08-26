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
import Mountains from "@/components/Mountains";

const headline = ["Rise.", "Celebrate.", "Together."];

export default function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  // Scroll-linked: everything below responds directly to the scrollbar.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const wmScale = useTransform(scrollYProgress, [0, 1], [1, 1.45]);
  const wmOpacity = useTransform(scrollYProgress, [0, 0.65], [1, 0]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, -140]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.55], [1, 0]);
  const alponaRotate = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const alponaRotateReverse = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const glowY = useTransform(scrollYProgress, [0, 1], [0, 160]);

  return (
    <section
      ref={ref}
      className="relative flex min-h-screen items-center overflow-hidden bg-cream"
    >
      {/* Giant Bangla watermark — scales up and dissolves as you scroll away */}
      <motion.div
        style={reduce ? undefined : { scale: wmScale, opacity: wmOpacity }}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.4 }}
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        aria-hidden="true"
      >
        <span className="font-heading select-none text-[28vw] font-black leading-none tracking-tight text-forest/6 md:text-[22vw]">
          UTHA
        </span>
      </motion.div>

      {/* Gradient glows drifting with scroll */}
      <motion.div
        style={reduce ? undefined : { y: glowY }}
        className="pointer-events-none absolute -left-40 top-1/4 h-96 w-96 rounded-full bg-forest/15 blur-3xl"
      />
      <motion.div
        style={reduce ? undefined : { y: glowY }}
        className="pointer-events-none absolute -right-32 bottom-1/4 h-80 w-80 rounded-full bg-bengal-red/15 blur-3xl"
      />

      {/* Alponas spinning with the scrollbar */}
      <motion.div
        style={reduce ? undefined : { rotate: alponaRotate }}
        className="pointer-events-none absolute right-[8%] top-[18%]"
      >
        <Alpona className="h-40 w-40 text-forest/25 md:h-56 md:w-56" />
      </motion.div>
      <motion.div
        style={reduce ? undefined : { rotate: alponaRotateReverse }}
        className="pointer-events-none absolute bottom-[14%] left-[6%]"
      >
        <Alpona className="h-32 w-32 text-bengal-red/20 md:h-44 md:w-44" />
      </motion.div>

      {/* Content — slides up and fades as the page scrolls past */}
      <motion.div
        style={reduce ? undefined : { y: contentY, opacity: contentOpacity }}
        className="relative z-10 mx-auto w-full max-w-6xl px-5 pt-24"
      >
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-lg font-semibold text-bengal-red md:text-xl"
        >
          Utha means to rise ✦ Bangladeshi Community of Salt Lake City, Utah
        </motion.p>

        <h1 className="mt-4 text-6xl font-black leading-[0.95] tracking-tight text-forest-ink md:text-8xl lg:text-9xl">
          {headline.map((word, i) => (
            <motion.span
              key={word}
              initial={reduce ? false : { opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.8,
                delay: 0.35 + i * 0.18,
                ease: [0.21, 0.68, 0.32, 0.99],
              }}
              className={`block ${i === 1 ? "text-forest" : ""} ${
                i === 2 ? "text-bengal-red" : ""
              }`}
            >
              {word}
            </motion.span>
          ))}
        </h1>

        <motion.p
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 1.0 }}
          className="mt-6 max-w-xl text-lg text-forest-ink/70 md:text-xl"
        >
          From Boishakhi Mela to Victory Day, from pitha nights to summer
          picnics — Utha USA brings Bangladeshi families together, wherever in
          America we call home.
        </motion.p>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 1.15 }}
          className="mt-9 flex flex-wrap gap-4"
        >
          <Link
            href="/events"
            className="rounded-full bg-forest px-8 py-4 font-semibold text-cream shadow-lg shadow-forest/25 transition-transform hover:scale-105"
          >
            See Upcoming Events
          </Link>
          <Link
            href="/membership"
            className="rounded-full border-2 border-bengal-red px-8 py-4 font-semibold text-bengal-red transition-colors hover:bg-bengal-red hover:text-white"
          >
            Become a Member
          </Link>
        </motion.div>
      </motion.div>

      {/* Wasatch mountain ridge — the Utah half of the brand */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 text-forest/15">
        <Mountains className="h-28 w-full md:h-44" />
      </div>

      {/* Scroll cue */}
      <motion.div
        style={reduce ? undefined : { opacity: contentOpacity }}
        className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2"
      >
        <div className="flex h-12 w-7 items-start justify-center rounded-full border-2 border-forest-ink/25 p-1.5">
          <div className="scroll-cue-dot h-2.5 w-2.5 rounded-full bg-bengal-red" />
        </div>
      </motion.div>
    </section>
  );
}
