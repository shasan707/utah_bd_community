import Link from "next/link";
import Icon from "@/components/Icon";
import PlaceholderImage from "@/components/PlaceholderImage";
import type { GalleryItem } from "@/data/gallery";

/** Enough tiles to fill a wide screen, so a short set does not leave gaps. */
const MIN_TILES = 8;

/** Repeats the set until the row is long enough to look full on a desktop. */
function fillRow(items: GalleryItem[]): GalleryItem[] {
  if (items.length === 0) return items;
  const row: GalleryItem[] = [];
  while (row.length < MIN_TILES) row.push(...items);
  return row;
}

/**
 * One picture. The spacing lives on the tile as a right margin rather than as
 * a flex gap on the row: that way each copy of the set measures exactly the
 * same width, which is what keeps the loop below seamless.
 */
function Tile({ item }: { item: GalleryItem }) {
  return (
    <Link
      href="/gallery"
      className="group relative block shrink-0 mr-4 transition-transform duration-300 hover:scale-[1.03] md:mr-6"
    >
      <PlaceholderImage
        palette={item.palette}
        banglaCaption={item.banglaCaption}
        caption={item.caption || undefined}
        src={item.src}
        className="h-[180px] w-[260px] rounded-2xl shadow-sm md:h-[220px] md:w-[320px]"
      />
      {item.kind === "video" && (
        <span className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm">
          <Icon name="play" className="h-4 w-4" />
        </span>
      )}
    </Link>
  );
}

/**
 * An endless row of community pictures gliding from right to left.
 *
 * The movement is the CSS marquee the festival ribbon already uses, so the
 * page gains no JavaScript. The set is laid out twice and the track slides
 * half its own width, which puts the second copy exactly where the first
 * began and makes the loop seamless. The copy is hidden from screen readers
 * so the captions are not announced twice. Hovering pauses it; when a visitor
 * has asked for less motion the row stops and can be swiped by hand instead.
 */
export default function PhotoMarquee({
  items,
  durationSeconds = 45,
  className = "",
}: {
  items: GalleryItem[];
  durationSeconds?: number;
  className?: string;
}) {
  if (items.length === 0) return null;
  const row = fillRow(items);

  return (
    <div className={`photo-marquee relative ${className}`}>
      <div
        className="marquee-track flex w-max"
        style={
          { "--marquee-duration": `${durationSeconds}s` } as React.CSSProperties
        }
      >
        <div className="flex">
          {row.map((item, i) => (
            <Tile key={`a-${i}`} item={item} />
          ))}
        </div>
        <div className="flex" aria-hidden="true">
          {row.map((item, i) => (
            <Tile key={`b-${i}`} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
}
