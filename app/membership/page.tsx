import type { Metadata } from "next";
import Link from "next/link";
import Reveal from "@/components/Reveal";
import SectionHeading from "@/components/SectionHeading";
import Alpona from "@/components/Alpona";
import Icon from "@/components/Icon";
import { REGISTRATION_FORM_URL } from "@/lib/links";

export const metadata: Metadata = {
  title: "Membership | Utha USA",
  description: "Join the Utha USA community. Membership tiers and benefits.",
};

const tiers = [
  {
    name: "Individual",
    bangla: "For one person",
    price: "$20",
    period: "per year",
    highlight: false,
    perks: ["Entry to member events", "Community WhatsApp circle", "A voice in community decisions"],
  },
  {
    name: "Family",
    bangla: "For the whole family",
    price: "$40",
    period: "per year",
    highlight: true,
    perks: ["Everything in Individual", "Covers spouse & children", "Free entry to flagship events", "Kids' programs included"],
  },
  {
    name: "Lifetime",
    bangla: "Pay once, member forever",
    price: "$200",
    period: "one time",
    highlight: false,
    perks: ["Everything in Family", "Never renew again", "Founding-member recognition"],
  },
];

const benefits: { icon: "ticket" | "check" | "users" | "heart"; text: string }[] = [
  { icon: "ticket", text: "Free or discounted entry to the year's biggest events" },
  { icon: "check", text: "A real voice. Members shape what Utha USA becomes" },
  { icon: "users", text: "A family of hundreds when you need help, advice, or adda" },
  { icon: "heart", text: "Bangla culture programs for children born in America" },
];

export default function MembershipPage() {
  return (
    <div className="pt-28">
      <section className="mx-auto max-w-6xl px-5">
        <SectionHeading
          bangla="Join Us"
          title="Become a Member"
          subtitle="Sample tiers and prices. Final membership details will be announced by the committee."
        />

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {tiers.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.12}>
              <div
                className={`relative flex h-full flex-col rounded-3xl border p-8 shadow-sm transition-shadow hover:shadow-xl ${
                  t.highlight
                    ? "border-forest bg-forest text-cream"
                    : "border-sand bg-white text-forest-ink"
                }`}
              >
                {t.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-bengal-red px-4 py-1 text-xs font-bold uppercase tracking-wider text-white">
                    Most Popular
                  </span>
                )}
                <div
                  className={`text-sm ${
                    t.highlight ? "text-cream/70" : "text-forest-ink/50"
                  }`}
                >
                  {t.bangla}
                </div>
                <h3 className="text-2xl font-bold">{t.name}</h3>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-5xl font-black">{t.price}</span>
                  <span
                    className={
                      t.highlight ? "text-cream/70" : "text-forest-ink/50"
                    }
                  >
                    {t.period}
                  </span>
                </div>
                <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                  {t.perks.map((p) => (
                    <li key={p} className="flex gap-2">
                      <span
                        className={
                          t.highlight ? "text-bengal-red" : "text-forest"
                        }
                      >
                        ✦
                      </span>
                      <span
                        className={
                          t.highlight ? "text-cream/90" : "text-forest-ink/75"
                        }
                      >
                        {p}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/contact"
                  className={`mt-8 rounded-full py-3.5 text-center font-semibold transition-transform hover:scale-105 ${
                    t.highlight
                      ? "bg-bengal-red text-white"
                      : "bg-forest text-cream"
                  }`}
                >
                  Contact to Join
                </Link>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.2}>
          {REGISTRATION_FORM_URL ? (
            <div className="mt-8 rounded-2xl border border-forest bg-forest p-6 text-center text-cream">
              <div className="text-lg font-bold">
                Event registration is open
              </div>
              <p className="mt-1 text-sm text-cream/80">
                Register for the next event and pay by Zelle in two minutes.
              </p>
              <Link
                href="/register"
                className="mt-4 inline-block rounded-full bg-bengal-red px-8 py-3.5 font-semibold text-white transition-transform hover:scale-105"
              >
                Register &amp; Pay
              </Link>
            </div>
          ) : (
            <div className="mt-8 rounded-2xl border border-sand bg-cream-dim p-5 text-center text-sm text-forest-ink/70">
              Online membership payment with automatic confirmation is coming
              in the next version of this website. For now, joining works
              through the contact page.
            </div>
          )}
        </Reveal>
      </section>

      <section className="relative mt-20 overflow-hidden bg-forest py-20 text-cream">
        <Alpona className="absolute -right-20 -top-20 h-72 w-72 text-cream/10" />
        <div className="relative mx-auto max-w-5xl px-5">
          <Reveal>
            <h2 className="text-center text-3xl font-bold md:text-4xl">
              Why families join
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {benefits.map((b, i) => (
              <Reveal key={b.text} delay={i * 0.1}>
                <div className="flex items-start gap-4 rounded-2xl bg-cream/10 p-5">
                  <Icon name={b.icon} className="mt-0.5 h-7 w-7 shrink-0 text-bengal-red" />
                  <p className="text-cream/90">{b.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
