"use client";

import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from "framer-motion";

type ScrollZoomProps = {
  children: React.ReactNode;
  className?: string;
};

/** Image container whose content zooms out from 1.25x to 1x as it scrolls through the viewport. */
export default function ScrollZoom({ children, className = "" }: ScrollZoomProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1.25, 1.05, 1]);

  return (
    <div ref={ref} className={`overflow-hidden ${className}`}>
      <motion.div style={reduce ? undefined : { scale }} className="h-full w-full">
        {children}
      </motion.div>
    </div>
  );
}
