import type { Metadata } from "next";
import Link from "next/link";
import Reveal from "@/components/Reveal";
import EventCard from "@/components/EventCard";
import EventHero from "@/components/EventHero";
import SectionHeading from "@/components/SectionHeading";
import Icon from "@/components/Icon";
import { getEvents, next, past, upcoming } from "@/lib/content";
import type { CommunityEvent } from "@/data/events";

export const metadata: Metadata = {
  title: "Events | Bangladeshi Association of Utah",
  description:
    "Upcoming Bangladeshi Association of Utah community events: melas, reunions, national days, and picnics.",
};

export const revalidate = 60;

function openness(event: CommunityEvent): "Open to all" | "Members" {
  return event.membersOnly ? "Members" : "Open to all";
}

export default async function EventsPage() {
  const all = await getEvents();
  // The hero always follows the calendar: soonest upcoming event, never pinned.
  const featured = next(all);
  const comingUp = upcoming(all).slice(1, 4);
  const previous = past(all);

  return (
    <div>
      {/* Section 1 - next event hero */}
      <EventHero event={featured} />

      {/* Section 2 - upcoming */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-6xl px-5">
          <SectionHeading
            bangla="What's Coming"
            title="Upcoming Events"
            subtitle="Mark your calendar. The community is gathering."
          />
          {comingUp.length > 0 ? (
            <div className="mt-12 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
              {comingUp.map((e, i) => (
                <Reveal key={e.slug} delay={(i % 3) * 0.1}>
                  <EventCard event={e} openness={openness(e)} />
                </Reveal>
              ))}
            </div>
          ) : (
            <Reveal delay={0.1}>
              <p className="mt-10 text-lg text-muted-ink">
                Nothing else on the calendar just yet — the event above is our
                next gathering.
              </p>
            </Reveal>
          )}
        </div>
      </section>

      {/* Section 3 - past */}
      <section className="bg-warm-sand py-24">
        <div className="mx-auto max-w-6xl px-5">
          <SectionHeading
            bangla="Memories"
            title="Past Events"
            subtitle="The gatherings that brought us here."
          />
          {previous.length > 0 ? (
            <div className="mt-12 grid gap-7 opacity-90 sm:grid-cols-2 lg:grid-cols-3">
              {previous.map((e, i) => (
                <Reveal key={e.slug} delay={(i % 3) * 0.1}>
                  <EventCard event={e} />
                </Reveal>
              ))}
            </div>
          ) : (
            <Reveal delay={0.1}>
              <div className="mt-10 flex flex-wrap items-center gap-5">
                <p className="max-w-xl text-lg text-muted-ink">
                  Our first gatherings are still ahead — check back after
                  October, and the memories will collect here.
                </p>
                <Link
                  href="/gallery"
                  className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-brand-green px-6 py-3 text-sm font-semibold text-deep-green transition-colors hover:bg-brand-green hover:text-ivory"
                >
                  <Icon name="heart" className="h-4 w-4" />
                  Visit the Gallery
                </Link>
              </div>
            </Reveal>
          )}
        </div>
      </section>
    </div>
  );
}
