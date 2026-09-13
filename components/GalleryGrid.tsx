"use client";

import { useMemo, useState } from "react";
import MediaLightbox from "@/components/MediaLightbox";
import PlaceholderImage from "@/components/PlaceholderImage";
import PlayBadge from "@/components/PlayBadge";
import Reveal from "@/components/Reveal";
import type { GalleryItem } from "@/data/gallery";

type Filter = "all" | "photo" | "video";

export default function GalleryGrid({ items }: { items: GalleryItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

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
      onClick={() => {
        setFilter(f);
        // The open index points into the filtered list, so it stops meaning
        // the same picture once the filter changes.
        setOpen(null);
      }}
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
                onClick={() => setOpen(i)}
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

      <MediaLightbox items={shown} index={open} onChange={setOpen} />
    </>
  );
}
