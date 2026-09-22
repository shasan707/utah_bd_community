import Link from "next/link";
import { notFound } from "next/navigation";
import Reveal from "@/components/Reveal";
import Countdown from "@/components/Countdown";
import Icon from "@/components/Icon";
import Alpona from "@/components/Alpona";
import EventMap from "@/components/EventMap";
import PlaceholderImage from "@/components/PlaceholderImage";
import PhotoMarquee from "@/components/PhotoMarquee";
import EventPhotoGrid from "@/components/EventPhotoGrid";
import CopyAddress from "@/components/CopyAddress";
import { fullAddress, mapsUrl, placeLine } from "@/lib/address";
import { eventScheduleHtml } from "@/lib/schedule";
import { getEventBySlug, getEventPhotos } from "@/lib/content";
import { formatDate, formatTime } from "@/lib/format";
import { paletteGradient } from "@/lib/palette";
import { feeItems } from "@/lib/payments/pricing";
import { canRegisterFor, getRegistrationStatus } from "@/lib/payments/settings";
import { attendance } from "@/lib/payments/attendance";

export const revalidate = 60;

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) notFound();

  const registration = await getRegistrationStatus();
  const canRegister = canRegisterFor(registration, event.date);
  const fees = registration.pricing ? feeItems(registration.pricing) : [];
  const mapQuery = fullAddress(event);
  // Under the venue name in the sidebar: the street when there is one, and
  // otherwise the city, but only when the city is not already part of the
  // venue line itself.
  const venueSecondLine =
    event.address?.trim() ||
    (placeLine(event) === event.venue ? "" : event.city);
  const photos = await getEventPhotos(slug);
  const schedule = eventScheduleHtml();
  // Only for the event people can register for; zero (and hidden) below
  // the floor or when registration is closed.
  const coming = canRegister ? await attendance() : { people: 0, families: 0 };

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
          {/* The event's own picture sits beside the title rather than in a
              corner far below. The words stay on the gradient, so the title
              stays readable whatever the photograph happens to look like. */}
          <div
            className={`grid items-center gap-10 ${
              event.imageUrl ? "md:grid-cols-[1.2fr_1fr]" : ""
            }`}
          >
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
                <a
                  href={mapsUrl(event)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-white/40 underline-offset-4 transition-colors hover:decoration-white"
                >
                  {placeLine(event)}
                </a>
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
            {coming.people > 0 && (
              <p className="mt-4 text-sm font-semibold text-white/90" data-attendance={coming.people}>
                <span className="text-mint">✦</span> {coming.people} people are coming so far.
                Join them.
              </p>
            )}
          </Reveal>
            {event.imageUrl && (
              <Reveal delay={0.15}>
                <PlaceholderImage
                  palette={event.palette}
                  src={event.imageUrl}
                  className="h-60 w-full rounded-3xl shadow-2xl ring-1 ring-white/25 sm:h-72 md:h-[380px]"
                />
              </Reveal>
            )}
          </div>
        </div>
      </section>

      {/* This event's own pictures, large and straight under the title. */}
      {photos.own.length > 0 && (
        <section className="border-b border-sand bg-white py-14 md:py-16">
          <div className="mx-auto max-w-6xl px-5">
            <Reveal>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-forest">
                ✦ Memories
              </p>
              <h2 className="mt-2 text-2xl font-bold text-forest-ink md:text-3xl">
                Photos from {event.title}
              </h2>
            </Reveal>
            <EventPhotoGrid items={photos.own} className="mt-8" />
          </div>
        </section>
      )}

      {/* The running order. Written by hand in data/schedule.html, which is
          committed with the code, so it is trusted and placed as written. */}
      <section
        className={`relative overflow-hidden border-b border-sand py-14 md:py-16 ${
          schedule ? "schedule-band" : "bg-cream-dim/40"
        }`}
      >
        {/* The collage of the day and the wash over it. Both are decoration
            and carry no meaning, so they are hidden from a screen reader and
            sit behind everything else. The photograph itself stays sharp:
            the blur is done by the schedule card, which is real glass and
            blurs what shows through it. Styled in globals.css, where the
            reason for each layer is written down. */}
        {schedule && (
          <>
            <div className="schedule-backdrop" aria-hidden="true" />
            <div className="schedule-wash" aria-hidden="true" />
          </>
        )}
        <div className="relative mx-auto max-w-3xl px-5">
          <Reveal>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-forest">
              ✦ The day
            </p>
            <h2 className="mt-2 text-2xl font-bold text-forest-ink md:text-3xl">
              Schedule
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            {schedule ? (
              <div
                className="event-schedule mt-7"
                dangerouslySetInnerHTML={{ __html: schedule }}
              />
            ) : (
              <div className="mt-7 rounded-2xl border border-dashed border-forest/25 bg-white/70 px-6 py-8 text-center">
                <p className="font-heading text-lg font-black text-forest-ink">
                  Coming soon
                </p>
                <p className="mt-1 text-sm text-muted-ink">
                  The running order for the day is being put together. It will
                  appear here before the picnic.
                </p>
              </div>
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
                      Two minutes. You get a code, then pay by Zelle
                      {registration.pricing?.venmo_handle ? " or Venmo" : ""}.
                    </p>
                    {coming.people > 0 && (
                      <dl className="mx-auto mt-6 max-w-xs border-t border-white/15 pt-5">
                        <dd className="font-heading text-3xl font-black text-ivory">{coming.people}</dd>
                        <dt className="text-xs font-semibold uppercase tracking-widest text-mint">people coming</dt>
                      </dl>
                    )}
                  </div>
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
                {venueSecondLine && (
                  <address className="mt-1 not-italic text-sm leading-relaxed text-forest-ink/70">
                    {venueSecondLine}
                  </address>
                )}
                <EventMap
                  query={mapQuery}
                  title={`Map of ${event.venue}`}
                  className="mt-4 h-56"
                />
                {/* Offered for every event now. Without a saved link the
                    button searches for the address, which is what somebody
                    would have typed in by hand anyway. */}
                <a
                  href={mapsUrl(event)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex items-center justify-center gap-2 rounded-full border-2 border-forest px-6 py-3 font-semibold text-forest transition-colors hover:bg-forest hover:text-cream"
                >
                  <Icon name="pin" className="h-4 w-4" />
                  Open in Google Maps
                </a>
                <CopyAddress address={mapQuery} className="mt-3 w-full" />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* No pictures of its own yet, so the community mix closes the page
          instead, under a heading that does not claim they are from here. */}
      {photos.own.length === 0 && photos.general.length > 0 && (
        <section className="overflow-hidden bg-cream py-14">
          <div className="mx-auto max-w-5xl px-5">
            <Reveal>
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-forest">
                ✦ Our community
              </p>
              <h2 className="mt-2 text-2xl font-bold text-forest-ink md:text-3xl">
                From past gatherings.
              </h2>
              <p className="mt-2 text-sm text-forest-ink/60">
                Photos from earlier community events.
              </p>
            </Reveal>
          </div>
          <Reveal delay={0.1}>
            <PhotoMarquee items={photos.general} className="mt-8" />
          </Reveal>
        </section>
      )}
    </div>
  );
}
