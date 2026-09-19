/**
 * The Venmo mark: blue tile with the V, and the wordmark. Drawn inline in
 * Venmo's brand blue so it needs no image file and scales cleanly, and built
 * to the same props as ZelleLogo so the two sit side by side anywhere. Venmo
 * is a registered trademark of PayPal, Inc.; it is shown here only to
 * identify the payment method.
 */

const BLUE = "#008CFF";

export function VenmoIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="9" fill={BLUE} />
      {/* The V: a tall stroke that widens to the right, as the wordmark's. */}
      <path
        d="M27.6 8c1.1 1.8 1.6 3.7 1.6 6 0 7.4-6.3 17-11.4 23.7H6.1L1.4 9.6l10.2-1 2.5 20c2.3-3.8 5.2-9.8 5.2-13.9 0-2.2-.4-3.8-1-5L27.6 8z"
        fill="#ffffff"
        transform="translate(6 1) scale(0.95)"
      />
    </svg>
  );
}

/**
 * Icon plus wordmark. `onDark` puts the wordmark in white for emerald
 * surfaces; otherwise it is blue. `pill` wraps it in a white pill so it
 * reads as a payment badge on any background.
 */
export default function VenmoLogo({
  size = "md",
  onDark = false,
  pill = false,
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  onDark?: boolean;
  pill?: boolean;
  className?: string;
}) {
  const icon = size === "lg" ? "h-7 w-7" : size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const text =
    size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-base";
  const word = pill || !onDark ? "text-[#008CFF]" : "text-ivory";
  return (
    <span
      className={`inline-flex items-center gap-1.5 align-middle ${
        pill ? "rounded-full bg-white px-2.5 py-1 shadow-sm" : ""
      } ${className}`}
    >
      <VenmoIcon className={icon} />
      <span className={`font-heading font-black leading-none tracking-tight ${text} ${word}`}>
        Venmo
      </span>
    </span>
  );
}
