import type { Metadata } from "next";
import Reveal from "@/components/Reveal";
import SectionHeading from "@/components/SectionHeading";
import Alpona from "@/components/Alpona";

export const metadata: Metadata = {
  title: "About | Bangladeshi Association of Utah",
  description: "The story, mission, and people of Bangladeshi Association of Utah.",
};

export const revalidate = 60;

const values = [
  {
    bangla: "01",
    title: "Culture",
    text: "Keeping Bangla language, festivals, food, and music alive in America, for us and for our children.",
  },
  {
    bangla: "02",
    title: "Togetherness",
    text: "Nobody celebrates alone. Every family that joins us finds hundreds of relatives they didn't know they had.",
  },
  {
    bangla: "03",
    title: "Service",
    text: "Standing beside community members in hard times, and beside Bangladesh whenever home needs us.",
  },
];

export default async function AboutPage() {
  return (
    <div className="pt-28">
      <section className="mx-auto max-w-6xl px-5">
        <SectionHeading
          bangla="Our Story"
          title="Who We Are"
          subtitle="Utah means to rise, a name we share with our home state, Utah."
        />
        <div className="mt-8 grid gap-10 md:grid-cols-2">
          <Reveal>
            <p className="leading-relaxed text-forest-ink/75">
              Bangladeshi Association of Utah is the community organization of Bangladeshi families
              living in Salt Lake City, Utah. We came to this country carrying
              two treasures: our dreams, and our culture. BAU exists so that
              the second one never fades while we chase the first.
            </p>
            <p className="mt-4 leading-relaxed text-forest-ink/75">
              Through the year we gather for the moments that define us:
              Pohela Boishakh, Ekushey February, Victory Day, Eid reunions,
              pitha festivals, and the great summer picnic. (This paragraph is
              placeholder text. Replace it with BAU&apos;s real story.)
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="relative overflow-hidden rounded-3xl bg-forest p-8 text-cream">
              <Alpona className="absolute -right-14 -top-14 h-56 w-56 text-cream/10" />
              <div className="text-sm font-bold uppercase tracking-[0.2em] text-cream/80">
                ✦ Our Mission
              </div>
              <h3 className="mt-1 text-2xl font-bold">What We Stand For</h3>
              <p className="mt-4 text-cream/85">
                To unite the Bangladeshi families of Salt Lake City and Utah
                in one open, welcoming community: celebrating our heritage, raising our
                children with pride in their roots, and helping one another
                the way a family does.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Values */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid gap-6 md:grid-cols-3">
          {values.map((v, i) => (
            <Reveal key={v.title} delay={i * 0.12}>
              <div className="h-full rounded-3xl border border-sand bg-white p-7 shadow-sm">
                <div className="text-xl font-black text-bengal-red">
                  {v.bangla}
                </div>
                <h3 className="mt-1 text-xl font-bold text-forest-ink">
                  {v.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-forest-ink/65">
                  {v.text}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

    </div>
  );
}
