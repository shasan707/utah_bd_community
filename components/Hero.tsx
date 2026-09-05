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
  // Kantha rings: same scroll driver, one third the speed, opposite direction.
  const ringRotateTopRight = useTransform(scrollYProgress, [0, 1], [0, -50]);
  const ringRotateBottomLeft = useTransform(scrollYProgress, [0, 1], [0, 40]);

  return (
    <section
      ref={ref}
      className="relative isolate flex min-h-screen items-center overflow-hidden bg-cream"
    >
      {/* Sunrise sky. Sits beneath every existing layer. */}
      <div className="hero-glow" aria-hidden="true" />
      <div className="hero-sun" aria-hidden="true" />

      {/* Giant watermark that scales up and dissolves as you scroll away */}
      <motion.div
        style={reduce ? undefined : { scale: wmScale, opacity: wmOpacity }}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.4 }}
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        aria-hidden="true"
      >
        <span className="font-heading select-none text-[28vw] font-black leading-none tracking-tight text-forest/5 md:text-[22vw]">
          UTHA
        </span>
      </motion.div>

      {/* Gradient glows drifting with scroll */}
      <motion.div
        style={reduce ? undefined : { y: glowY }}
        className="pointer-events-none absolute -left-40 top-1/4 h-96 w-96 rounded-full bg-forest/7 blur-3xl"
      />
      <motion.div
        style={reduce ? undefined : { y: glowY }}
        className="pointer-events-none absolute -right-32 bottom-1/4 h-80 w-80 rounded-full bg-sage/12 blur-3xl"
      />

      {/* Alponas spinning with the scrollbar */}
      <motion.div
        style={reduce ? undefined : { rotate: ringRotateTopRight }}
        className="pointer-events-none absolute right-6 top-[3%] hidden h-32 w-32 md:top-[9%] md:h-72 md:w-72 min-[900px]:block"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 400 400"
          className="absolute left-1/2 top-1/2 h-[324px] w-[324px] -translate-x-1/2 -translate-y-1/2"
          aria-hidden="true"
        >
          <circle cx="200" cy="200" r="190" fill="none" stroke="#0E7C5B" strokeOpacity=".35" strokeWidth="2.5" strokeDasharray="9 7" strokeLinecap="round" />
          <circle cx="200" cy="200" r="165" fill="none" stroke="#0E7C5B" strokeOpacity=".16" strokeWidth="1.5" strokeDasharray="6 9" strokeLinecap="round" />
        </svg>
      </motion.div>
      <motion.div
        style={reduce ? undefined : { rotate: alponaRotate }}
        className="pointer-events-none absolute right-6 top-[3%] md:top-[9%]"
      >
        <Alpona className="h-32 w-32 text-forest/16 md:h-72 md:w-72" />
      </motion.div>
      <motion.div
        style={reduce ? undefined : { rotate: ringRotateBottomLeft }}
        className="pointer-events-none absolute bottom-0 left-5 hidden h-24 w-24 md:bottom-[7%] md:h-36 md:w-36 min-[900px]:block"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 200 200"
          className="absolute left-1/2 top-1/2 h-[174px] w-[174px] -translate-x-1/2 -translate-y-1/2"
          aria-hidden="true"
        >
          <circle cx="100" cy="100" r="92" fill="none" stroke="#C77B57" strokeOpacity=".4" strokeWidth="1.75" strokeDasharray="10 8" strokeLinecap="round" />
        </svg>
      </motion.div>
      <motion.div
        style={reduce ? undefined : { rotate: alponaRotateReverse }}
        className="pointer-events-none absolute bottom-0 left-5 md:bottom-[7%]"
      >
        <Alpona className="h-24 w-24 text-clay/18 md:h-36 md:w-36" />
      </motion.div>

      {/* Content slides up and fades as the page scrolls past */}
      <motion.div
        style={reduce ? undefined : { y: contentY, opacity: contentOpacity }}
        className="relative z-10 mx-auto w-full max-w-6xl px-5 pt-24"
      >
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-lg font-semibold text-forest md:text-xl"
        >
          Utha means to rise ✦ Bangladeshi Community of Salt Lake City, Utah
        </motion.p>

        <motion.p
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.28 }}
          className="mt-3 text-xl text-forest-ink/70 md:text-2xl"
        >
          স্বাগতম — Welcome home.
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
              {i < headline.length - 1 ? `${word} ` : word}
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
          picnics, Utha USA brings Bangladeshi families together in the heart
          of Utah, and there&apos;s always room for one more.
        </motion.p>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 1.15 }}
          className="mt-9 flex flex-wrap gap-4"
        >
          <Link
            href="/events"
            className="rounded-full bg-forest px-8 py-4 font-semibold text-ivory shadow-sm shadow-forest/15 transition-colors hover:bg-forest-deep"
          >
            See Upcoming Events
          </Link>
          <Link
            href="/membership"
            className="rounded-full border border-forest/30 px-8 py-4 font-semibold text-forest transition-colors hover:bg-forest hover:text-ivory"
          >
            Become a Member
          </Link>
        </motion.div>
      </motion.div>

      {/* Wasatch mountain ridge, the Utah half of the brand */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 text-forest/15">
        <Mountains
          className="h-28 w-full md:h-44"
          back="#E3EDE7"
          mid="#C8DAD0"
          front="#93BFA4"
        />
      </div>
    </section>
  );
}
