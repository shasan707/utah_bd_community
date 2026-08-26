"use client";

import { motion, useScroll, useSpring } from "framer-motion";

/** Thin progress bar at the very top, filled by page scroll. */
export default function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 30,
    restDelta: 0.001,
  });

  return (
    <motion.div
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-[70] h-1 origin-left bg-gradient-to-r from-forest via-bengal-red to-forest"
    />
  );
}
