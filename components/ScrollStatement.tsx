"use client";

import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";
import Vine from "@/components/Vine";

const words: { text: string; red?: boolean }[] = [
  { text: "We" },
  { text: "left" },
  { text: "Bangladesh" },
  { text: "behind," },
  { text: "but" },
  { text: "carried" },
  { text: "its" },
  { text: "songs," },
  { text: "colors," },
  { text: "memories," },
  { text: "and" },
  { text: "warmth" },
  { text: "with" },
  { text: "us." },
  { text: "Here" },
  { text: "in" },
  { text: "Utah," },
  { text: "a" },
  { text: "little" },
  { text: "piece" },
  { text: "of" },
  { text: "home" },
  { text: "lives" },
  { text: "on" },
  { text: "in" },
  { text: "every" },
  { text: "melody," },
  { text: "every" },
  { text: "gathering," },
  { text: "and" },
  { text: "every" },
  { text: "child" },
  { text: "who" },
  { text: "proudly" },
  { text: "says," },
  { text: "“I", red: true },
  { text: "am", red: true },
  { text: "Bangali.”", red: true },
];

function Word({
  children,
  progress,
  range,
  red,
}: {
  children: string;
  progress: MotionValue<number>;
  range: [number, number];
  red?: boolean;
}) {
  const opacity = useTransform(progress, range, [0.12, 1]);
  return (
    <motion.span style={{ opacity }} className={red ? "text-bengal-red" : ""}>
      {children}{" "}
    </motion.span>
  );
}

/** Big statement whose words light up one by one, driven by the scrollbar. */
export default function ScrollStatement() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.85", "end 0.4"],
  });

  return (
    <section
      ref={ref}
      className="relative mx-auto max-w-5xl px-5 py-32 md:py-44"
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1 w-screen -translate-x-1/2 text-forest/10 md:top-8"
        aria-hidden="true"
      >
        <Vine uid="why" className="h-[120px] w-full" />
      </div>

      <p className="relative text-sm font-bold uppercase tracking-[0.2em] text-forest">
        ✦ Why Utah
      </p>
      <p className="relative mt-4 text-3xl font-bold leading-snug text-forest-ink md:text-5xl md:leading-snug">
        {reduce
          ? words.map((w, i) => (
              <span key={i} className={w.red ? "text-bengal-red" : ""}>
                {w.text}{" "}
              </span>
            ))
          : words.map((w, i) => (
              <Word
                key={i}
                progress={scrollYProgress}
                range={[i / words.length, (i + 1) / words.length]}
                red={w.red}
              >
                {w.text}
              </Word>
            ))}
      </p>
    </section>
  );
}
