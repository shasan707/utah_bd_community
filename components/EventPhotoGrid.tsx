"use client";

import Link from "next/link";
import { useState } from "react";
import MediaLightbox from "@/components/MediaLightbox";
import PlaceholderImage from "@/components/PlaceholderImage";
import PlayBadge from "@/components/PlayBadge";
import Reveal from "@/components/Reveal";
import type { GalleryItem } from "@/data/gallery";

/** How many tiles the event page shows before handing over to the gallery. */
const MAX_TILES = 6;

const TILE = "h-56 w-full md:h-72";

/**
 * The pictures from one event, as a row of large even tiles.
 *
 * Even heights rather than the gallery's masonry: on an event page a tidy grid
 * reads better than a ragged one. Clicking a tile opens the shared viewer, so
 * a visitor can look through the set without leaving the page. When the event
 * has more pictures than fit, the last tile becomes the way through to the
 * full gallery instead of another picture.
 */
export default function EventPhotoGrid({
  items,
  className = "",
}: {
  items: GalleryItem[];
  className?: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  if (items.length === 0) return null;

  const shown = items.slice(0, MAX_TILES);
  const extra = items.length - shown.length;

  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6">
        {shown.map((g, i) => {
          const video = g.kind === "video";
          const isLast = i === shown.length - 1;

          if (isLast && extra > 0) {
            return (
              <Reveal key={g.id} delay={(i % 3) * 0.06}>
                <Link
                  href="/gallery"
                  className="group relative block overflow-hidden rounded-2xl shadow-sm transition-transform hover:scale-[1.02]"
                >
                  <PlaceholderImage
                    palette={g.palette}
                    banglaCaption={g.banglaCaption}
                    src={g.src}
                    className={TILE}
                  />
                  <span className="absolute inset-0 flex flex-col items-center justify-center bg-forest-ink/65 text-white transition-colors group-hover:bg-forest-ink/75">
                    <span className="font-heading text-3xl font-black">+{extra}</span>
                    <span className="mt-1 text-xs font-bold uppercase tracking-[0.2em]">
                      See all
                    </span>
                  </span>
                </Link>
              </Reveal>
            );
          }

          return (
            <Reveal key={g.id} delay={(i % 3) * 0.06}>
              <button
                type="button"
                onClick={() => setOpen(i)}
                aria-label={`${video ? "Play" : "Open"} ${g.banglaCaption || g.caption}`}
                className={`group relative block w-full overflow-hidden rounded-2xl shadow-sm transition-transform hover:scale-[1.02] ${
                  video ? "cursor-pointer" : "cursor-zoom-in"
                }`}
              >
                <PlaceholderImage
                  palette={g.palette}
                  banglaCaption={g.banglaCaption}
                  caption={g.caption}
                  src={g.src}
                  className={TILE}
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

      {/* The viewer walks the whole set, including the pictures past the grid. */}
      <MediaLightbox items={items} index={open} onChange={setOpen} />
    </div>
  );
}
