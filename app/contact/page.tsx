import type { Metadata } from "next";
import Reveal from "@/components/Reveal";
import SectionHeading from "@/components/SectionHeading";
import ContactForm from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Contact — Utha USA",
  description: "Get in touch with the Utha USA community.",
};

const channels = [
  { icon: "📧", label: "Email", value: "hello@uthausa.org (placeholder)" },
  { icon: "📱", label: "WhatsApp", value: "+1 (000) 000-0000 (placeholder)" },
  { icon: "📘", label: "Facebook", value: "facebook.com/uthausa (placeholder)" },
  { icon: "📍", label: "Based in", value: "Salt Lake City, Utah" },
];

export default function ContactPage() {
  return (
    <div className="pt-28">
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <SectionHeading
          bangla="Get in Touch"
          title="Say Hello"
          subtitle="Questions, ideas, volunteering, membership — the door is always open."
        />
        <div className="mt-12 grid gap-10 md:grid-cols-2">
          <Reveal>
            <div className="space-y-4">
              {channels.map((c) => (
                <div
                  key={c.label}
                  className="flex items-center gap-4 rounded-2xl border border-sand bg-white p-5 shadow-sm"
                >
                  <span className="text-2xl">{c.icon}</span>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-widest text-forest-ink/50">
                      {c.label}
                    </div>
                    <div className="font-medium text-forest-ink">{c.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.15}>
            <ContactForm />
          </Reveal>
        </div>

        {/* Location map */}
        <div className="mt-20">
          <SectionHeading
            bangla="Our Location"
            title="Find Us in Salt Lake City"
            subtitle="Utha USA is the Bangladeshi community of Salt Lake City, Utah — events happen in and around the valley."
          />
          <Reveal delay={0.1}>
            <div className="mt-8 overflow-hidden rounded-3xl border border-sand shadow-sm">
              <iframe
                src="https://www.google.com/maps?q=Salt+Lake+City,+Utah&z=11&output=embed"
                className="h-96 w-full border-0 md:h-[28rem]"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
                title="Utha USA — Salt Lake City, Utah"
              />
            </div>
            <p className="mt-3 text-center text-xs text-forest-ink/50">
              📍 Salt Lake City, Utah — exact venue addresses are shared with
              each event announcement.
            </p>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
