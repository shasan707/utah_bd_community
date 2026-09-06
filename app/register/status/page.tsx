import type { Metadata } from "next";
import Link from "next/link";
import Alpona from "@/components/Alpona";
import Reveal from "@/components/Reveal";
import StatusLookup from "@/components/StatusLookup";

export const metadata: Metadata = {
  title: "Track your registration | Bangladeshi Association of Utah",
  description: "See whether your Zelle has arrived and your ticket has been sent.",
  robots: { index: false, follow: false },
};

export default async function StatusPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const initialCode = (code || "").toUpperCase().slice(0, 12);

  return (
    <div>
      <section className="emerald-panel relative overflow-hidden pb-14 pt-36 text-ivory md:pt-40">
        <Alpona className="floral-soft absolute -right-24 -top-24 h-96 w-96" />
        <div className="relative mx-auto max-w-6xl px-5">
          <Reveal>
            <span className="text-sm font-bold uppercase tracking-[0.2em] text-mint">
              ✦ Registration
            </span>
            <h1 className="mt-2 text-4xl font-black md:text-5xl">Track your registration</h1>
            <p className="mt-4 max-w-xl text-lg text-ivory-dim">
              Enter your code and the email you used. You will see whether your Zelle has
              arrived and whether your ticket has gone out.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14 md:py-16">
        <StatusLookup initialCode={initialCode} />
        <p className="mt-8 text-center text-sm text-muted-ink">
          Not registered yet?{" "}
          <Link href="/register" className="font-semibold text-forest underline">
            Register and pay
          </Link>
        </p>
      </section>
    </div>
  );
}
