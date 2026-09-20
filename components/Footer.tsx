import Link from "next/link";
import Logo from "@/components/Logo";
import Mountains from "@/components/Mountains";
import FishPattern from "@/components/FishPattern";

export default function Footer() {
  return (
    <footer className="river-panel relative overflow-hidden text-cream">
      {/* The Wasatch ridge across the top of the footer. It is 112px tall on
          a desktop and was drawn at 5% of cream, which against this green is
          not far off invisible -- so the footer opened with a band of dead
          space instead of a picture. The ridge draws its three layers at
          0.35, 0.6 and 1 of currentColor, so the faintest one was landing at
          under 2%. At 12% the silhouette reads and the height it occupies is
          decoration rather than a gap. */}
      <div className="pointer-events-none text-cream/12">
        <Mountains className="h-20 w-full md:h-28" />
      </div>
      <FishPattern
        uid="ft"
        className="pointer-events-none absolute inset-0 h-full w-full text-cream/[0.055]"
      />

      <div className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <div className="flex items-center gap-3">
              <Logo uid="ft" className="h-16 w-16 shrink-0" />
              <div className="font-heading text-2xl font-black leading-tight tracking-tight text-cream">
                Bangladeshi Association of Utah{" "}
                <span className="text-bengal-red">(BAU)</span>
              </div>
            </div>
            <p className="mt-4 max-w-xs text-sm text-cream/70">
              BAU is the Bangladeshi community of Salt Lake City, Utah.
              We rise together, and we celebrate together.
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
                <li><Link href="/blog" className="hover:text-bengal-red">Blog</Link></li>
                <li><Link href="/about" className="hover:text-bengal-red">About Us</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-cream/50">
                Get Involved
              </h3>
              <ul className="space-y-2 text-sm">
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
              Email <span className="text-cream/40">(coming soon)</span>
              <br />
              Salt Lake City, Utah
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-cream/10 pt-6 text-xs text-cream/50 md:flex-row">
          <span>© {new Date().getFullYear()} Bangladeshi Association of Utah. All rights reserved.</span>
          <span>From the Padma to the Great Salt Lake, one family</span>
          <span>
            Powered by{" "}
            <a
              href="https://jotillabs.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-cream/75 underline-offset-4 hover:text-bengal-red hover:underline"
            >
              JotilLabs.com
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
