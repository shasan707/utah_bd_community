import type { Metadata } from "next";
import Link from "next/link";
import Alpona from "@/components/Alpona";
import Reveal from "@/components/Reveal";
import RegisterForm from "@/components/RegisterForm";
import {
  getRegistrationStatus,
  type RegistrationStatus,
} from "@/lib/payments/settings";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Register | Utha USA",
  description:
    "Register for the next BPAU event and pay by Zelle in two minutes.",
};

const steps = [
  {
    n: "1",
    title: "Fill the form",
    text: "Tell us who is coming, plus any coupons or donation.",
  },
  {
    n: "2",
    title: "Send the Zelle",
    text: "Send the exact amount and put your code in the memo.",
  },
  {
    n: "3",
    title: "Get your receipt",
    text: "We confirm the payment and email your receipt.",
  },
];

function OfflineCard({ status }: { status: RegistrationStatus }) {
  const closed = status.reason === "closed" && status.pricing;
  return (
    <div className="mx-auto max-w-xl rounded-3xl border border-sand bg-white p-8 text-center">
      <h2 className="text-xl font-bold text-forest-ink">
        {closed ? "Registration has closed" : "Registration is not open yet"}
      </h2>
      <p className="mt-2 text-forest-ink/70">
        {closed
          ? `Online registration for ${status.pricing!.event_name} closed on ${status.pricing!.registration_closes}. If you still need a seat, reach us through the contact page.`
          : "Online registration for the next event has not opened. Check back soon, or reach us through the contact page and we will register you personally."}
      </p>
      <Link
        href="/contact"
        className="mt-5 inline-block rounded-full bg-forest px-7 py-2.5 font-semibold text-cream transition-transform hover:scale-105"
      >
        Contact us
      </Link>
    </div>
  );
}

export default async function RegisterPage() {
  const status = await getRegistrationStatus();

  return (
    <div>
      {/* Hero band, same language as the event pages */}
      <section className="relative overflow-hidden bg-forest pb-14 pt-36 text-cream">
        <Alpona className="absolute -right-20 -top-20 h-72 w-72 text-cream/10" />
        <Alpona className="drift-slow absolute -bottom-24 -left-16 h-64 w-64 text-cream/5" />
        <div className="relative mx-auto max-w-5xl px-5">
          <Reveal>
            <span className="text-sm font-bold uppercase tracking-[0.2em] text-cream/70">
              ✦ Register &amp; Pay
            </span>
            <h1 className="mt-2 text-4xl font-black md:text-5xl">
              {status.pricing?.event_name || "Event Registration"}
            </h1>
            <p className="mt-3 max-w-xl text-cream/80">
              Two minutes, three steps, and your seat is reserved.
            </p>
          </Reveal>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {steps.map((s, i) => (
              <Reveal key={s.n} delay={0.1 + i * 0.08}>
                <div className="flex h-full items-start gap-3 rounded-2xl bg-cream/10 p-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bengal-red font-heading text-sm font-black text-white">
                    {s.n}
                  </span>
                  <div>
                    <div className="font-bold">{s.title}</div>
                    <div className="mt-0.5 text-sm text-cream/75">{s.text}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* The form, native to the site */}
      <section className="mx-auto max-w-5xl px-5 py-14">
        {status.open && status.pricing ? (
          <RegisterForm pricing={status.pricing} />
        ) : (
          <OfflineCard status={status} />
        )}
      </section>
    </div>
  );
}
