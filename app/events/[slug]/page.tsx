import Link from "next/link";
import { notFound } from "next/navigation";
import Reveal from "@/components/Reveal";
import Countdown from "@/components/Countdown";
import Icon from "@/components/Icon";
import Alpona from "@/components/Alpona";
import EventMap from "@/components/EventMap";
import PlaceholderImage from "@/components/PlaceholderImage";
import PhotoMarquee from "@/components/PhotoMarquee";
import { getEventBySlug, getGalleryForEvent } from "@/lib/content";
import { formatDate, formatTime } from "@/lib/format";
import { paletteGradient } from "@/lib/palette";
import { feeItems } from "@/lib/payments/pricing";
import { getRegistrationStatus } from "@/lib/payments/settings";

export const revalidate = 60;

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const registration = event.registration ? await getRegistrationStatus() : null;
  const canRegister = Boolean(registration?.open && registration.pricing);
  const fees = registration?.pricing ? feeItems(registration.pricing) : [];
  const mapQuery = event.address || `${event.venue}, ${event.city}`;
  const photos = await getGalleryForEvent(slug);

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
            </div>
            {event.address && (
              <div className="mt-2 flex items-center gap-2 text-sm text-white/75">
                <Icon name="pin" className="h-4 w-4 opacity-0" />
                {event.address}
              </div>
            )}
            {canRegister && (
              <Link
                href="/register"
                className="mt-8 inline-flex items-center gap-3 rounded-full bg-white px-9 py-4 font-heading text-lg font-black text-forest shadow-lg transition-transform hover:scale-105"
              >
                Register &amp; Pay
                <span aria-hidden="true">→</span>
              </Link>
            )}
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
            {canRegister && (
              <Reveal delay={0.25}>
                <div className="emerald-panel relative mt-10 overflow-hidden rounded-3xl p-8 text-center text-ivory">
                  <Alpona className="floral-soft absolute -right-14 -top-14 h-48 w-48" />
                  <div className="relative">
                    <div className="text-xs font-bold uppercase tracking-[0.25em] text-mint">
                      Reserve your seats
                    </div>
                    <h3 className="mt-2 font-heading text-2xl font-black md:text-3xl">
                      Register and pay online
                    </h3>
                    <dl className="mx-auto mt-5 flex max-w-md flex-wrap justify-center gap-x-8 gap-y-2 text-sm">
                      {fees.map((f) => (
                        <div key={f.label} className="flex items-baseline gap-2">
                          <dt className="text-ivory-dim">{f.label}</dt>
                          <dd className="font-bold text-ivory">{f.value}</dd>
                        </div>
                      ))}
                    </dl>
                    <Link
                      href="/register"
                      className="cta-accent mt-7 inline-block rounded-full px-10 py-4 font-heading text-lg font-black"
                    >
                      Register &amp; Pay
                    </Link>
                    <p className="mt-4 text-sm text-mint">
                      Two minutes. You get a code, then pay by Zelle.
                    </p>
                  </div>
                </div>
              </Reveal>
            )}
            {!event.registration && (
              <Reveal delay={0.25}>
                <div className="mt-8 rounded-2xl border border-sand bg-cream-dim p-5 text-sm text-forest-ink/70">
                  <strong className="text-forest">Note:</strong> this is a sample
                  event with placeholder details. Real dates, venues, and
                  registration will appear here once BAU announces them.
                </div>
              </Reveal>
            )}
          </div>

          <div className="space-y-6">
            <Reveal delay={0.15}>
              <div className="rounded-3xl border border-sand bg-white p-6 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-widest text-forest-ink/50">
                  Starts in
                </div>
                <Countdown target={event.date} className="mt-3 flex-wrap" />
                <Link
                  href={canRegister ? "/register" : "/contact"}
                  className="mt-6 block rounded-full bg-forest px-6 py-3.5 text-center font-semibold text-cream transition-transform hover:scale-105"
                >
                  {canRegister ? "Register & Pay" : "I'm Interested"}
                </Link>
              </div>
            </Reveal>
            <Reveal delay={0.2}>
              <div className="rounded-3xl border border-sand bg-white p-6 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-widest text-forest-ink/50">
                  Where
                </div>
                <div className="mt-2 font-bold text-forest-ink">{event.venue}</div>
                <address className="mt-1 not-italic text-sm leading-relaxed text-forest-ink/70">
                  {event.address || event.city}
                </address>
                <EventMap
                  query={mapQuery}
                  title={`Map of ${event.venue}`}
                  className="mt-4 h-56"
                />
                {event.mapUrl && (
                  <a
                    href={event.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 flex items-center justify-center gap-2 rounded-full border-2 border-forest px-6 py-3 font-semibold text-forest transition-colors hover:bg-forest hover:text-cream"
                  >
                    <Icon name="pin" className="h-4 w-4" />
                    Open in Google Maps
                  </a>
                )}
              </div>
            </Reveal>
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

      {photos.length > 0 && (
        <section className="overflow-hidden bg-cream py-14">
          <div className="mx-auto max-w-5xl px-5">
            <Reveal>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-forest">
                ✦ From our community
              </p>
              <h2 className="mt-2 text-2xl font-bold text-forest-ink md:text-3xl">
                Faces from our gatherings.
              </h2>
            </Reveal>
          </div>
          <Reveal delay={0.1}>
            <PhotoMarquee items={photos} className="mt-8" />
          </Reveal>
        </section>
      )}
    </div>
  );
}
