"use client";

import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from "framer-motion";

type ParallaxBlockProps = {
  children: React.ReactNode;
  /** Pixels of vertical drift as the block crosses the viewport. */
  drift?: number;
  className?: string;
};

/** Wrapper whose content drifts slower than the page while scrolling (parallax). */
export default function ParallaxBlock({
  children,
  drift = 60,
  className = "",
}: ParallaxBlockProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [drift, -drift]);

  return (
    <div ref={ref} className={className}>
      <motion.div style={reduce ? undefined : { y }}>{children}</motion.div>
    </div>
  );
}
