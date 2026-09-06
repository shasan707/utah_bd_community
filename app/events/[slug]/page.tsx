import Link from "next/link";
import { notFound } from "next/navigation";
import Reveal from "@/components/Reveal";
import Countdown from "@/components/Countdown";
import Icon from "@/components/Icon";
import Alpona from "@/components/Alpona";
import PlaceholderImage from "@/components/PlaceholderImage";
import { getEventBySlug } from "@/lib/content";
import { formatDate, formatTime } from "@/lib/format";
import { paletteGradient } from "@/lib/palette";

export const revalidate = 60;

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  return (
    <div>
      {/* Hero band */}
      <section
        className="relative overflow-hidden pt-40 pb-16 text-white"
        style={{ background: paletteGradient[event.palette] }}
      >
        <Alpona className="absolute -right-20 -top-20 h-80 w-80 text-white/15" />
        <Alpona className="drift-slow absolute -bottom-24 -left-16 h-72 w-72 text-white/10" />
        <div className="relative mx-auto max-w-5xl px-5">
          <Reveal>
            <Link
              href="/events"
              className="text-sm font-semibold text-white/75 hover:text-white"
            >
              ← All events
            </Link>
            <div className="mt-4 text-sm font-bold uppercase tracking-[0.25em] text-white/80">
              ✦ {event.banglaTitle}
            </div>
            <h1 className="mt-1 text-4xl font-black md:text-6xl">
              {event.title}
            </h1>
            <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-2 text-sm text-white/85">
              <span className="flex items-center gap-2">
                <Icon name="calendar" />
                {formatDate(event.date)}
              </span>
              <span className="flex items-center gap-2">
                <Icon name="clock" />
                {formatTime(event.date)}
                {event.endTime ? ` to ${event.endTime}` : ""}
              </span>
              <span className="flex items-center gap-2">
                <Icon name="pin" />
                {event.mapUrl ? (
                  <a
                    href={event.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-white/40 underline-offset-4 transition-colors hover:decoration-white"
                  >
                    {event.venue}
                  </a>
                ) : (
                  event.venue
                )}
                {`, ${event.city}`}
              </span>
              <span className="rounded-full bg-white/20 px-3 py-0.5 font-semibold">
                {event.free ? "Free entry" : "Ticketed"}
              </span>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-16">
        <div className="grid gap-12 md:grid-cols-[2fr_1fr]">
          <div>
            <Reveal>
              <h2 className="text-2xl font-bold text-forest-ink">
                About this event
              </h2>
            </Reveal>
            {event.description.map((para, i) => (
              <Reveal key={i} delay={0.1 + i * 0.08}>
                <p className="mt-4 leading-relaxed text-forest-ink/75">{para}</p>
              </Reveal>
            ))}
            <Reveal delay={0.25}>
              <div className="mt-8 rounded-2xl border border-sand bg-cream-dim p-5 text-sm text-forest-ink/70">
                <strong className="text-forest">Note:</strong> this is a sample
                event with placeholder details. Real dates, venues, and
                registration will appear here once BAU announces them.
              </div>
            </Reveal>
          </div>

          <div className="space-y-6">
            <Reveal delay={0.15}>
              <div className="rounded-3xl border border-sand bg-white p-6 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-widest text-forest-ink/50">
                  Starts in
                </div>
                <Countdown target={event.date} className="mt-3 flex-wrap" />
                <Link
                  href="/contact"
                  className="mt-6 block rounded-full bg-forest px-6 py-3.5 text-center font-semibold text-cream transition-transform hover:scale-105"
                >
                  I&apos;m Interested
                </Link>
              </div>
            </Reveal>
            {event.mapUrl && (
              <Reveal delay={0.2}>
                <a
                  href={event.mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-full border-2 border-forest px-6 py-3.5 font-semibold text-forest transition-colors hover:bg-forest hover:text-cream"
                >
                  <Icon name="pin" className="h-4 w-4" />
                  Open in Google Maps
                </a>
              </Reveal>
            )}
            <Reveal delay={0.25}>
              <PlaceholderImage
                palette={event.palette}
                banglaCaption={event.banglaTitle}
                caption={event.imageUrl ? undefined : "Venue photo placeholder"}
                src={event.imageUrl}
                className="h-52 rounded-3xl"
              />
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}
