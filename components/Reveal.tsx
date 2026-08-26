"use client";

import { motion, useReducedMotion } from "framer-motion";

type RevealProps = {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
};

/** Fades + rises content into view when it enters the viewport. */
export default function Reveal({
  children,
  delay = 0,
  y = 32,
  className = "",
}: RevealProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.21, 0.68, 0.32, 0.99] }}
    >
      {children}
    </motion.div>
  );
}
