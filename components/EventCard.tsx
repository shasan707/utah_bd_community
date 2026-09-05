import Link from "next/link";
import TiltCard from "@/components/TiltCard";
import PlaceholderImage from "@/components/PlaceholderImage";
import { formatDateShort, formatTime } from "@/lib/format";
import type { CommunityEvent } from "@/data/events";

export default function EventCard({
  event,
  openness,
}: {
  event: CommunityEvent;
  /** Home page only. Omitted elsewhere, so no badge renders. */
  openness?: string;
}) {
  return (
    <TiltCard className="h-full">
      <Link
        href={`/events/${event.slug}`}
        className="group flex h-full flex-col overflow-hidden rounded-3xl border border-sand bg-white shadow-sm transition-shadow hover:shadow-xl"
      >
        <PlaceholderImage
          palette={event.palette}
          banglaCaption={event.banglaTitle}
          src={event.imageUrl}
          className="h-44"
        />
        <div className="flex flex-1 flex-col p-6">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-widest text-forest">
            <span>{formatDateShort(event.date)}</span>
            <span className="text-sand">•</span>
            <span>{formatTime(event.date)}</span>
            {openness && (
              <span className="ml-auto rounded-full bg-forest/10 px-2.5 py-1 normal-case tracking-normal text-forest">
                {openness}
              </span>
            )}
            {event.free && (
              <span
                className={`rounded-full bg-forest/10 px-2.5 py-1 normal-case tracking-normal text-forest ${
                  openness ? "" : "ml-auto"
                }`}
              >
                Free
              </span>
            )}
          </div>
          <h3 className="mt-3 text-xl font-bold text-forest-ink group-hover:text-forest">
            {event.title}
          </h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-forest-ink/60">
            {event.blurb}
          </p>
          <span className="mt-4 text-sm font-semibold text-bengal-red">
            Details →
          </span>
        </div>
      </Link>
    </TiltCard>
  );
}
