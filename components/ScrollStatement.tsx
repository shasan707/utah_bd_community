"use client";

import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";

const words: { text: string; red?: boolean }[] = [
  { text: "We" },
  { text: "left" },
  { text: "Bangladesh" },
  { text: "carrying" },
  { text: "Bangladesh" },
  { text: "inside" },
  { text: "us." },
  { text: "Utha" },
  { text: "USA" },
  { text: "is" },
  { text: "where" },
  { text: "it" },
  { text: "wakes" },
  { text: "up" },
  { text: "—" },
  { text: "every" },
  { text: "mela," },
  { text: "every" },
  { text: "song," },
  { text: "every" },
  { text: "child" },
  { text: "proud" },
  { text: "to" },
  { text: "say:" },
  { text: "I", red: true },
  { text: "am", red: true },
  { text: "Bangali.", red: true },
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
    <section ref={ref} className="mx-auto max-w-5xl px-5 py-32 md:py-44">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-bengal-red">
        ✦ Why Utha
      </p>
      <p className="mt-4 text-3xl font-bold leading-snug text-forest-ink md:text-5xl md:leading-snug">
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
