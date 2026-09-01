"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import PlaceholderImage from "@/components/PlaceholderImage";
import Reveal from "@/components/Reveal";
import type { GalleryItem } from "@/data/gallery";

export default function GalleryGrid({ items }: { items: GalleryItem[] }) {
  const [active, setActive] = useState<GalleryItem | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <div className="columns-2 gap-4 md:columns-3 [&>*]:mb-4">
        {items.map((g, i) => (
          <Reveal key={g.id} delay={(i % 4) * 0.06} className="break-inside-avoid">
            <button
              onClick={() => setActive(g)}
              className="block w-full cursor-zoom-in overflow-hidden rounded-2xl transition-transform hover:scale-[1.02]"
              aria-label={`Open ${g.caption}`}
            >
              <PlaceholderImage
                palette={g.palette}
                banglaCaption={g.banglaCaption}
                caption={g.caption}
                src={g.src}
                className={g.tall ? "h-80" : "h-52"}
              />
            </button>
          </Reveal>
        ))}
      </div>

      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActive(null)}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-forest-ink/85 p-6 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.92, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 16 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-3xl"
            >
              <PlaceholderImage
                palette={active.palette}
                banglaCaption={active.banglaCaption}
                caption={active.caption}
                src={active.src}
                className="h-[60vh] rounded-3xl"
              />
              <button
                onClick={() => setActive(null)}
                className="mx-auto mt-5 block rounded-full bg-white/15 px-6 py-2.5 text-sm font-semibold text-white hover:bg-white/25"
              >
                Close ✕
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
