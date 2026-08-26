"use client";

import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from "framer-motion";

type ScaleInProps = {
  children: React.ReactNode;
  className?: string;
};

/** Curtain effect: the section rises and grows from 0.92x to full size as it scrolls into view. */
export default function ScaleIn({ children, className = "" }: ScaleInProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "start 0.3"],
  });
  const scale = useTransform(scrollYProgress, [0, 1], [0.92, 1]);
  const opacity = useTransform(scrollYProgress, [0, 1], [0.65, 1]);

  return (
    <div ref={ref} className={className}>
      <motion.div style={reduce ? undefined : { scale, opacity }}>
        {children}
      </motion.div>
    </div>
  );
}
