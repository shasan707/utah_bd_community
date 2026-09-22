import Link from "next/link";

/**
 * One line under the navbar on the home page while registration is open:
 * the event, the closing date, and the button. Fed from the same settings
 * as the register page, so it appears and disappears with the switch and
 * the closing date, and nobody has to remember to take it down.
 *
 * Rendered inside the hero (see Hero's `banner` slot) so it sits below the
 * fixed navbar without pushing the page down.
 */
export default function RegisterRibbon({
  eventName,
  closes,
}: {
  eventName: string;
  /** Already formatted, e.g. "Sep 26, 2026". */
  closes: string;
}) {
  return (
    <div className="pointer-events-auto mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-full border border-forest/15 bg-forest px-4 py-2 text-sm text-ivory shadow-lg shadow-forest/20 sm:px-6">
      <span className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
        <span className="font-bold text-mint">✦</span>
        <span className="font-semibold">{eventName}</span>
        <span aria-hidden="true" className="text-ivory/40">·</span>
        <span className="text-ivory-dim">Registration closes {closes}</span>
      </span>
      <Link
        href="/register"
        className="rounded-full bg-bengal-red px-4 py-1.5 text-sm font-bold text-white transition-transform hover:scale-105"
      >
        Register &amp; Pay →
      </Link>
    </div>
  );
}
