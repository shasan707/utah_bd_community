"use client";

import { useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import PlaceholderImage from "@/components/PlaceholderImage";
import type { GalleryItem } from "@/data/gallery";
import { parseVideo } from "@/lib/video";

/** The player for one video, chosen from the pasted address. */
function VideoPlayer({ url, title }: { url: string; title: string }) {
  const v = parseVideo(url);
  if (v.type === "file") {
    return (
      <video
        src={v.src}
        controls
        autoPlay
        playsInline
        className="max-h-[70vh] w-full rounded-3xl bg-black"
      />
    );
  }
  if (v.type === "link") {
    return (
      <div className="rounded-3xl bg-white p-8 text-center">
        <p className="text-forest-ink">This video opens on another site.</p>
        <a
          href={v.href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block rounded-full bg-forest px-6 py-2.5 font-semibold text-ivory"
        >
          Open video
        </a>
      </div>
    );
  }
  return (
    <div className="aspect-video w-full overflow-hidden rounded-3xl bg-black">
      <iframe
        src={v.embed}
        title={title}
        className="h-full w-full"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      />
    </div>
  );
}

function Arrow({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      // The backdrop behind this button closes the viewer when it is clicked,
      // and without this the same click would travel on to it: the picture
      // would step forward and the viewer would shut in the same breath,
      // which looked exactly like the arrows doing nothing at all.
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={side === "left" ? "Previous" : "Next"}
      className={`absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/30 ${
        side === "left" ? "left-2 md:left-6" : "right-2 md:right-6"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2.2}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d={side === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
        />
      </svg>
    </button>
  );
}

/**
 * The full screen viewer for a set of pictures and videos.
 *
 * The parent owns which item is open: it passes the index, or null when the
 * viewer is shut, and `onChange` is normally the state setter itself so the
 * keyboard handler below does not have to be rebuilt on every render. Escape
 * closes; the arrow keys and the on-screen arrows walk the set and wrap around.
 */
export default function MediaLightbox({
  items,
  index,
  onChange,
}: {
  items: GalleryItem[];
  index: number | null;
  onChange: (index: number | null) => void;
}) {
  const many = items.length > 1;

  const step = useCallback(
    (delta: number) => {
      if (index === null || items.length === 0) return;
      onChange((index + delta + items.length) % items.length);
    },
    [index, items.length, onChange]
  );

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onChange(null);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, onChange, step]);

  const active = index === null ? null : items[index];

  /**
   * Swipe, for the phone. The horizontal distance has to beat both a minimum
   * and the vertical distance, so a scroll down the page or a shaky tap is
   * not mistaken for a swipe sideways.
   */
  const swipeFrom = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    swipeFrom.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const from = swipeFrom.current;
    swipeFrom.current = null;
    if (!from || !many) return;
    const dx = e.clientX - from.x;
    const dy = e.clientY - from.y;
    if (Math.abs(dx) < 45 || Math.abs(dx) <= Math.abs(dy)) return;
    step(dx < 0 ? 1 : -1);
  };

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => onChange(null)}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-forest-ink/85 p-6 backdrop-blur-sm"
        >
          {many && (
            <>
              <Arrow
                side="left"
                onClick={() => {
                  step(-1);
                }}
              />
              <Arrow
                side="right"
                onClick={() => {
                  step(1);
                }}
              />
            </>
          )}
          <motion.div
            key={index}
            initial={{ scale: 0.92, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 16 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            className="w-full max-w-4xl touch-pan-y"
          >
            {active.kind === "video" && active.videoUrl ? (
              <VideoPlayer
                url={active.videoUrl}
                title={active.banglaCaption || active.caption}
              />
            ) : (
              <PlaceholderImage
                palette={active.palette}
                banglaCaption={active.banglaCaption}
                caption={active.caption}
                src={active.src}
                className="h-[60vh] rounded-3xl"
              />
            )}
            {active.kind === "video" && (active.banglaCaption || active.caption) && (
              <div className="mt-4 text-center text-white">
                <div className="text-lg font-semibold">{active.banglaCaption}</div>
                {active.caption && (
                  <div className="text-xs uppercase tracking-widest text-white/70">
                    {active.caption}
                  </div>
                )}
              </div>
            )}
            <div className="mt-5 flex items-center justify-center gap-4">
              {many && (
                <span className="text-sm font-medium text-white/60">
                  {index! + 1} / {items.length}
                </span>
              )}
              <button
                onClick={() => onChange(null)}
                className="rounded-full bg-white/15 px-6 py-2.5 text-sm font-semibold text-white hover:bg-white/25"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
