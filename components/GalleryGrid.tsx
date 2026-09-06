"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import PlaceholderImage from "@/components/PlaceholderImage";
import Reveal from "@/components/Reveal";
import type { GalleryItem } from "@/data/gallery";
import { parseVideo } from "@/lib/video";

type Filter = "all" | "photo" | "video";

function PlayBadge({ large = false }: { large?: boolean }) {
  const size = large ? "h-16 w-16" : "h-11 w-11";
  return (
    <span
      className={`flex ${size} items-center justify-center rounded-full bg-white/90 text-forest shadow-lg`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className={large ? "ml-1 h-7 w-7" : "ml-0.5 h-5 w-5"} fill="currentColor">
        <path d="M8 5.5v13l11-6.5z" />
      </svg>
    </span>
  );
}

/** The player for one video tile, chosen from the pasted address. */
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

export default function GalleryGrid({ items }: { items: GalleryItem[] }) {
  const [active, setActive] = useState<GalleryItem | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hasVideos = items.some((g) => g.kind === "video");
  const hasPhotos = items.some((g) => g.kind !== "video");
  const shown = useMemo(
    () =>
      items.filter((g) =>
        filter === "all" ? true : filter === "video" ? g.kind === "video" : g.kind !== "video"
      ),
    [items, filter]
  );

  const chip = (f: Filter, label: string) => (
    <button
      type="button"
      onClick={() => setFilter(f)}
      className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
        filter === f ? "bg-forest text-ivory" : "bg-white text-forest-ink/70 hover:bg-cream-dim"
      }`}
    >
      {label}
    </button>
  );

  return (
    <>
      {hasVideos && hasPhotos && (
        <div className="mb-6 flex flex-wrap gap-2">
          {chip("all", "All")}
          {chip("photo", "Photos")}
          {chip("video", "Videos")}
        </div>
      )}

      <div className="columns-2 gap-4 md:columns-3 [&>*]:mb-4">
        {shown.map((g, i) => {
          const video = g.kind === "video";
          return (
            <Reveal key={g.id} delay={(i % 4) * 0.06} className="break-inside-avoid">
              <button
                onClick={() => setActive(g)}
                className={`group relative block w-full overflow-hidden rounded-2xl transition-transform hover:scale-[1.02] ${
                  video ? "cursor-pointer" : "cursor-zoom-in"
                }`}
                aria-label={`${video ? "Play" : "Open"} ${g.banglaCaption || g.caption}`}
              >
                <PlaceholderImage
                  palette={g.palette}
                  banglaCaption={g.banglaCaption}
                  caption={g.caption}
                  src={g.src}
                  className={g.tall ? "h-80" : "h-52"}
                />
                {video && (
                  <>
                    <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover:bg-black/20">
                      <PlayBadge />
                    </span>
                    <span className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                      Video
                    </span>
                  </>
                )}
              </button>
            </Reveal>
          );
        })}
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
              className="w-full max-w-4xl"
            >
              {active.kind === "video" && active.videoUrl ? (
                <VideoPlayer url={active.videoUrl} title={active.banglaCaption || active.caption} />
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
                    <div className="text-xs uppercase tracking-widest text-white/70">{active.caption}</div>
                  )}
                </div>
              )}
              <button
                onClick={() => setActive(null)}
                className="mx-auto mt-5 block rounded-full bg-white/15 px-6 py-2.5 text-sm font-semibold text-white hover:bg-white/25"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
