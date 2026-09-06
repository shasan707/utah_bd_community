import type { Metadata } from "next";
import Link from "next/link";
import Alpona from "@/components/Alpona";
import Icon from "@/components/Icon";
import Reveal from "@/components/Reveal";
import RegisterForm from "@/components/RegisterForm";
import ZelleLogo from "@/components/ZelleLogo";
import {
  getRegistrationStatus,
  type RegistrationStatus,
} from "@/lib/payments/settings";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Register | Bangladeshi Association of Utah",
  description:
    "Register for the next BPAU event and pay by Zelle in two minutes.",
};

const steps = [
  {
    n: "1",
    title: "Fill the form",
    text: "Tell us who is coming, plus any food coupons or a donation.",
  },
  {
    n: "2",
    title: "Send with",
    zelle: true,
    text: "Send the exact amount and put your code in the memo.",
  },
  {
    n: "3",
    title: "Get your receipt",
    text: "We match the payment to your code and email the receipt.",
  },
];

function OfflineCard({ status }: { status: RegistrationStatus }) {
  const closed = status.reason === "closed" && status.pricing;
  return (
    <Reveal>
      <div className="mx-auto max-w-xl rounded-3xl border border-sand bg-white p-8 text-center shadow-sm md:p-10">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-cream-dim text-forest">
          <Icon name={closed ? "check" : "clock"} className="h-7 w-7" />
        </div>
        <h2 className="mt-5 text-2xl font-bold text-forest-ink">
          {closed ? "Registration has closed" : "Registration opens soon"}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-muted-ink">
          {closed
            ? `Online registration for ${status.pricing!.event_name} closed on ${status.pricing!.registration_closes}. If you still need a seat, write to us and we will do our best.`
            : "Online registration for the next event has not opened yet. Check back soon, or write to us and we will register you personally."}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link
            href="/contact"
            className="rounded-full bg-forest px-7 py-3 font-semibold text-ivory transition-colors hover:bg-forest-deep"
          >
            Contact us
          </Link>
          <Link
            href="/events"
            className="rounded-full border border-forest/30 px-7 py-3 font-semibold text-forest transition-colors hover:bg-forest hover:text-ivory"
          >
            See upcoming events
          </Link>
        </div>
      </div>
    </Reveal>
  );
}

export default async function RegisterPage() {
  const status = await getRegistrationStatus();
  const pricing = status.pricing;

  return (
    <div>
      {/* Emerald hero, same material as the featured event on the home page */}
      <section className="emerald-panel relative overflow-hidden pb-16 pt-36 text-ivory md:pt-40">
        <Alpona className="floral-soft absolute -right-24 -top-24 h-96 w-96" />
        <Alpona className="floral-soft drift-slow absolute -bottom-28 -left-20 h-80 w-80" />
        <div className="relative mx-auto max-w-6xl px-5">
          <Reveal>
            <span className="text-sm font-bold uppercase tracking-[0.2em] text-mint">
              ✦ Register &amp; Pay
            </span>
            <h1 className="mt-2 text-4xl font-black leading-tight md:text-6xl">
              {pricing?.event_name || "Event Registration"}
            </h1>
            <p className="mt-4 max-w-xl text-lg text-ivory-dim">
              Reserve your seats in two minutes. Fill the form, send a Zelle
              with your code in the memo, and your receipt follows.
            </p>
            {pricing && (
              <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-ivory-dim">
                <span className="flex items-center gap-2">
                  <Icon name="calendar" className="h-4 w-4 text-mint" />
                  {pricing.event_date}
                </span>
                <span className="flex items-center gap-2">
                  <Icon name="clock" className="h-4 w-4 text-mint" />
                  Registration closes {pricing.registration_closes}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ivory">
                    Pay with
                  </span>
                  <ZelleLogo size="sm" pill />
                </span>
              </div>
            )}
          </Reveal>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {steps.map((s, i) => (
              <Reveal key={s.n} delay={0.1 + i * 0.08}>
                <div className="glass-card flex h-full items-start gap-4 p-5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bengal-red font-heading text-sm font-black text-white">
                    {s.n}
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 font-bold text-ivory">
                      {s.title}
                      {"zelle" in s && s.zelle && <ZelleLogo size="sm" pill />}
                    </div>
                    <div className="glass-label mt-1 text-sm leading-relaxed">
                      {s.text}
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14 md:py-16">
        {status.open && pricing ? (
          <RegisterForm pricing={pricing} />
        ) : (
          <OfflineCard status={status} />
        )}
      </section>
    </div>
  );
}
