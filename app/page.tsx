import Link from "next/link";
import Hero from "@/components/Hero";
import Reveal from "@/components/Reveal";
import Counter from "@/components/Counter";
import Countdown from "@/components/Countdown";
import Marquee from "@/components/Marquee";
import ParallaxBlock from "@/components/ParallaxBlock";
import ScrollStatement from "@/components/ScrollStatement";
import HorizontalShowcase from "@/components/HorizontalShowcase";
import ScrollZoom from "@/components/ScrollZoom";
import ScaleIn from "@/components/ScaleIn";
import PlaceholderImage from "@/components/PlaceholderImage";
import EventCard from "@/components/EventCard";
import SectionHeading from "@/components/SectionHeading";
import Alpona from "@/components/Alpona";
import Icon from "@/components/Icon";
import Honeycomb from "@/components/Honeycomb";
import Mountains from "@/components/Mountains";
import { nextEvent, upcomingEvents } from "@/data/events";
import { gallery } from "@/data/gallery";
import { formatDate, formatTime } from "@/lib/format";

const stats = [
  { value: 500, suffix: "+", label: "Community families" },
  { value: 12, suffix: "", label: "Events every year" },
  { value: 30, suffix: "+", label: "Volunteers" },
  { value: 1, suffix: "", label: "Family, united as one" },
];

export default function HomePage() {
  const featured = nextEvent();
  const upcoming = upcomingEvents().slice(0, 3);
  const galleryPreview = gallery.slice(0, 6);

  return (
    <>
      <Hero />

      {/* Stats */}
      <section className="relative overflow-hidden border-y border-sand bg-cream-dim">
        <Honeycomb className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 text-forest/10" />
        <Honeycomb className="pointer-events-none absolute -bottom-10 -left-10 h-36 w-36 text-bengal-red/10" />
        <div className="relative mx-auto grid max-w-6xl grid-cols-2 gap-8 px-5 py-14 md:grid-cols-4">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.1} className="text-center">
              <div className="text-4xl font-black text-forest md:text-5xl">
                <Counter to={s.value} suffix={s.suffix} />
              </div>
              <div className="mt-2 text-sm text-forest-ink/60">{s.label}</div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Scroll-driven word-by-word statement */}
      <ScrollStatement />

      {/* Featured next event with countdown */}
      <ScaleIn>
      <section className="relative overflow-hidden bg-forest py-20 text-cream md:mx-6 md:rounded-[2.5rem]">
        <Alpona className="absolute -right-24 -top-24 h-96 w-96 text-cream/10" />
        <Alpona className="drift-slow absolute -bottom-28 -left-20 h-80 w-80 text-cream/5" />
        <div className="relative mx-auto max-w-6xl px-5">
          <Reveal>
            <span className="text-sm font-bold uppercase tracking-[0.2em] text-cream/80">
              ✦ Next Event
            </span>
            <h2 className="mt-2 text-3xl font-bold md:text-5xl">
              Next Up: {featured.title}
            </h2>
          </Reveal>
          <div className="mt-8 grid items-center gap-10 md:grid-cols-2">
            <Reveal delay={0.1}>
              <p className="text-lg text-cream/85">{featured.blurb}</p>
              <div className="mt-5 space-y-2 text-sm text-cream/70">
                <div className="flex items-center gap-2.5">
                  <Icon name="calendar" />
                  <span>{formatDate(featured.date)}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Icon name="clock" />
                  <span>
                    {formatTime(featured.date)}
                    {featured.endTime ? ` to ${featured.endTime}` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Icon name="pin" />
                  <span>
                    {featured.venue}, {featured.city}
                  </span>
                </div>
              </div>
              <Link
                href={`/events/${featured.slug}`}
                className="mt-7 inline-block rounded-full bg-bengal-red px-7 py-3.5 font-semibold text-white transition-transform hover:scale-105"
              >
                Event Details
              </Link>
            </Reveal>
            <Reveal delay={0.2} className="md:justify-self-end">
              <div className="text-xs font-semibold uppercase tracking-widest text-cream/60">
                Counting down
              </div>
              <Countdown target={featured.date} light className="mt-3" />
            </Reveal>
          </div>
        </div>
      </section>
      </ScaleIn>

      <Marquee />

      {/* Pinned horizontal-scroll festival showcase */}
      <HorizontalShowcase />

      {/* Culture parallax sections */}
      <section className="mx-auto max-w-6xl space-y-24 px-5 py-24">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <ParallaxBlock drift={40}>
            <ScrollZoom className="h-80 rounded-3xl md:h-96">
              <PlaceholderImage
                palette="red"
                banglaCaption="Boishakhi Mela"
                caption="Our biggest day of the year"
                className="h-full"
              />
            </ScrollZoom>
          </ParallaxBlock>
          <Reveal>
            <span className="text-sm font-bold uppercase tracking-[0.2em] text-bengal-red">
              ✦ Our Festivals
            </span>
            <h2 className="mt-2 text-3xl font-bold text-forest-ink md:text-4xl">
              Festivals that feel like home
            </h2>
            <p className="mt-4 text-forest-ink/70">
              Pohela Boishakh under an American sky, panta-ilish shared between
              neighbors, kids in red and white running past alpona-painted
              walkways. We recreate the sounds, colors, and tastes of home,
              so no one has to miss Bangladesh alone.
            </p>
          </Reveal>
        </div>

        <div className="grid items-center gap-10 md:grid-cols-2">
          <Reveal className="md:order-1">
            <span className="text-sm font-bold uppercase tracking-[0.2em] text-bengal-red">
              ✦ Next Generation
            </span>
            <h2 className="mt-2 text-3xl font-bold text-forest-ink md:text-4xl">
              Raising the next generation Bangali
            </h2>
            <p className="mt-4 text-forest-ink/70">
              Bangla poetry on Ekushey February, freedom songs on Victory Day,
              first Bangla letters written at our children&apos;s corner. Our
              American-born kids grow up knowing exactly where their story
              began, and proud of it.
            </p>
          </Reveal>
          <ParallaxBlock drift={40} className="md:order-2">
            <ScrollZoom className="h-80 rounded-3xl md:h-96">
              <PlaceholderImage
                palette="green"
                banglaCaption="Ekushey February"
                caption="Language Day"
                className="h-full"
              />
            </ScrollZoom>
          </ParallaxBlock>
        </div>
      </section>

      {/* Bangladesh x Utah, two homes one heart */}
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <SectionHeading
          bangla="Bangladesh × Utah"
          title="Two Homes, One Heart"
          subtitle="Rooted in the delta, growing in the mountains. Utha carries both."
          align="center"
        />
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <Reveal>
            <div className="relative h-full overflow-hidden rounded-3xl bg-forest p-8 text-cream md:p-10">
              <Alpona className="drift absolute -right-12 -top-12 h-52 w-52 text-cream/15" />
              <div className="text-sm font-bold uppercase tracking-[0.2em] text-cream/70">
                Where our story began
              </div>
              <h3 className="mt-2 text-3xl font-black">Bangladesh</h3>
              <p className="mt-4 max-w-sm text-cream/85">
                The rivers, the rain, the songs, the language of 1952. The
                green and red we carry in everything we do. Our festivals keep
                the delta alive in every Utha family.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.12}>
            <div
              className="relative h-full overflow-hidden rounded-3xl p-8 text-white md:p-10"
              style={{
                background:
                  "linear-gradient(135deg, #8a5a10 0%, #c98a1b 55%, #e8b64c 100%)",
              }}
            >
              <Honeycomb className="absolute -right-10 -top-10 h-44 w-44 text-white/25" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 text-white/25">
                <Mountains className="h-24 w-full" />
              </div>
              <div className="text-sm font-bold uppercase tracking-[0.2em] text-white/75">
                Where our story grows
              </div>
              <h3 className="mt-2 text-3xl font-black">Utah</h3>
              <p className="mt-4 max-w-sm text-white/90">
                The Wasatch peaks, the Great Salt Lake, and the Beehive
                State's spirit of building together. Salt Lake City is home
                now, and our children's stories begin here.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Upcoming events preview */}
      <section className="bg-cream-dim py-24">
        <div className="mx-auto max-w-6xl px-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              bangla="What's Coming"
              title="Upcoming Events"
              subtitle="Mark your calendar. The community is gathering."
            />
            <Reveal delay={0.15}>
              <Link
                href="/events"
                className="rounded-full border-2 border-forest px-6 py-3 text-sm font-semibold text-forest transition-colors hover:bg-forest hover:text-cream"
              >
                All Events →
              </Link>
            </Reveal>
          </div>
          <div className="mt-10 grid gap-7 md:grid-cols-3">
            {upcoming.map((e, i) => (
              <Reveal key={e.slug} delay={i * 0.12}>
                <EventCard event={e} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery preview */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading
            bangla="Memories"
            title="Moments We Made"
            subtitle="A glimpse of the colors, faces, and celebrations."
          />
          <Reveal delay={0.15}>
            <Link
              href="/gallery"
              className="rounded-full border-2 border-forest px-6 py-3 text-sm font-semibold text-forest transition-colors hover:bg-forest hover:text-cream"
            >
              Full Gallery →
            </Link>
          </Reveal>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3">
          {galleryPreview.map((g, i) => (
            <Reveal key={g.id} delay={i * 0.08}>
              <PlaceholderImage
                palette={g.palette}
                banglaCaption={g.banglaCaption}
                caption={g.caption}
                className="h-44 rounded-2xl md:h-56"
              />
            </Reveal>
          ))}
        </div>
      </section>

      {/* Join CTA */}
      <section className="relative overflow-hidden bg-bengal-red py-20 text-white">
        <Alpona className="drift absolute -left-16 -top-16 h-64 w-64 text-white/15" />
        <Alpona className="absolute -bottom-20 -right-16 h-72 w-72 text-white/10" />
        <div className="relative mx-auto max-w-4xl px-5 text-center">
          <Reveal>
            <div className="text-sm font-bold uppercase tracking-[0.2em] text-white/85">
              ✦ Join Us
            </div>
            <h2 className="mt-3 text-4xl font-black md:text-5xl">
              Be part of the Utha USA family
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-white/85">
              Membership means free entry to our biggest events, a voice in the
              community, and a family of hundreds who celebrate the way you do.
            </p>
            <Link
              href="/membership"
              className="mt-8 inline-block rounded-full bg-white px-9 py-4 font-bold text-bengal-red shadow-xl transition-transform hover:scale-105"
            >
              Learn About Membership
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}
