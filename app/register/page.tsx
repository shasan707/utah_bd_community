import type { Metadata } from "next";
import SectionHeading from "@/components/SectionHeading";
import Reveal from "@/components/Reveal";
import { REGISTRATION_FORM_URL } from "@/lib/links";

export const metadata: Metadata = {
  title: "Register | Utha USA",
  description:
    "Register for the next BPAU event and pay by Zelle in two minutes.",
};

export default function RegisterPage() {
  return (
    <div className="pt-28">
      <section className="mx-auto max-w-4xl px-5 pb-24">
        <SectionHeading
          bangla="Register &amp; Pay"
          title="Event Registration"
          subtitle="Fill the form, get your payment code, and send the amount by Zelle with the code in the memo. Your receipt arrives by email once we confirm."
        />
        <Reveal delay={0.1}>
          <div className="mt-8 overflow-hidden rounded-3xl border border-sand bg-white shadow-sm">
            <iframe
              src={REGISTRATION_FORM_URL}
              title="BPAU event registration form"
              className="h-[1500px] w-full border-0"
              allow="clipboard-write"
            />
          </div>
          <p className="mt-3 text-center text-xs text-forest-ink/50">
            Trouble seeing the form?{" "}
            <a
              href={REGISTRATION_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-forest underline"
            >
              Open it in a new tab
            </a>
            .
          </p>
        </Reveal>
      </section>
    </div>
  );
}
