/**
 * The Zelle mark: purple tile with the Z, and the wordmark. Drawn inline in
 * Zelle's brand purple so it needs no image file and scales cleanly. Zelle is
 * a registered trademark of Early Warning Services; it is shown here only to
 * identify the payment method.
 */

const PURPLE = "#6D1ED4";

export function ZelleIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <rect width="40" height="40" rx="9" fill={PURPLE} />
      <path
        d="M11 11h18v4.2L17.6 25H29v4H11v-4.2L22.4 15H11z"
        fill="#ffffff"
      />
      <path d="M18.4 7h4v6h-4zM18.4 27h4v6h-4z" fill="#ffffff" />
    </svg>
  );
}

/**
 * Icon plus wordmark. `onDark` puts the wordmark in white for emerald
 * surfaces; otherwise it is purple. `pill` wraps it in a white pill so it
 * reads as a payment badge on any background. `glass` is the pill for the
 * emerald panels: translucent, thin light edge, ivory wordmark, so the
 * badge sits in the green rather than on it.
 */
export default function ZelleLogo({
  size = "md",
  onDark = false,
  pill = false,
  glass = false,
  className = "",
}: {
  size?: "sm" | "md" | "lg";
  onDark?: boolean;
  pill?: boolean;
  glass?: boolean;
  className?: string;
}) {
  const icon = size === "lg" ? "h-7 w-7" : size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const text =
    size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-base";
  const word = glass || (onDark && !pill) ? "text-ivory" : "text-[#6D1ED4]";
  const shell = glass
    ? "rounded-full border border-white/20 bg-white/10 px-2.5 py-1 backdrop-blur-sm"
    : pill
      ? "rounded-full bg-white px-2.5 py-1 shadow-sm"
      : "";
  return (
    <span className={`inline-flex items-center gap-1.5 align-middle ${shell} ${className}`}>
      <ZelleIcon className={icon} />
      <span className={`font-heading font-black leading-none tracking-tight ${text} ${word}`}>
        Zelle
        <sup className="ml-px text-[0.5em] font-semibold align-super">&reg;</sup>
      </span>
    </span>
  );
}
