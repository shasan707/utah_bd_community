import Link from "next/link";
import Alpona from "@/components/Alpona";
import Logo from "@/components/Logo";
import Mountains from "@/components/Mountains";

export default function Footer() {
  return (
    <footer className="relative overflow-hidden bg-forest-ink text-cream">
      <div className="pointer-events-none text-cream/5">
        <Mountains className="h-20 w-full md:h-28" />
      </div>
      <Alpona className="absolute -right-20 -top-20 h-72 w-72 text-cream/5" />
      <Alpona className="absolute -bottom-24 -left-24 h-80 w-80 text-cream/5" />

      <div className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-3">
              <Logo uid="ft" className="h-16 w-16 shrink-0" />
              <div className="font-heading text-2xl font-black leading-tight tracking-tight text-cream">
                Bangladesh Association Utah{" "}
                <span className="text-bengal-red">(BAU)</span>
              </div>
            </div>
            <p className="mt-4 max-w-xs text-sm text-cream/70">
              Utha USA is the Bangladeshi community of Salt Lake City, Utah.
              Utha means to rise. We rise together, and we celebrate together.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-cream/50">
                Explore
              </h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/events" className="hover:text-bengal-red">Events</Link></li>
                <li><Link href="/gallery" className="hover:text-bengal-red">Gallery</Link></li>
                <li><Link href="/about" className="hover:text-bengal-red">About Us</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-cream/50">
                Get Involved
              </h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/membership" className="hover:text-bengal-red">Membership</Link></li>
                <li><Link href="/contact" className="hover:text-bengal-red">Volunteer</Link></li>
                <li><Link href="/contact" className="hover:text-bengal-red">Contact</Link></li>
              </ul>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-cream/50">
              Stay Connected
            </h3>
            <p className="text-sm text-cream/70">
              Facebook · WhatsApp · YouTube
              <br />
              hello@uthausa.org <span className="text-cream/40">(placeholder)</span>
              <br />
              Salt Lake City, Utah
            </p>
          </div>
        </div>

        <p className="mt-12 text-xs text-cream/50">
          Utha is a community initiative of Bangladesh Association Utah (BAU).
        </p>

        <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t border-cream/10 pt-6 text-xs text-cream/50 md:flex-row">
          <span>© {new Date().getFullYear()} Utha USA. All rights reserved.</span>
          <span>From the Padma to the Great Salt Lake, one family</span>
        </div>
      </div>
    </footer>
  );
}
