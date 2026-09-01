import type { Metadata } from "next";
import Reveal from "@/components/Reveal";
import EventCard from "@/components/EventCard";
import SectionHeading from "@/components/SectionHeading";
import { getEvents } from "@/lib/content";

export const metadata: Metadata = {
  title: "Events | Utha USA",
  description: "Upcoming Utha USA community events: melas, reunions, national days, and picnics.",
};

export const revalidate = 60;

export default async function EventsPage() {
  const sorted = await getEvents();

  return (
    <div className="pt-28">
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <SectionHeading
          bangla="Calendar"
          title="Community Events"
          subtitle="Every gathering is open-hearted. Come as a guest, leave as family. Dates and venues below are sample placeholders."
        />
        <div className="mt-12 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((e, i) => (
            <Reveal key={e.slug} delay={(i % 3) * 0.1}>
              <EventCard event={e} />
            </Reveal>
          ))}
        </div>
      </section>
    </div>
  );
}
