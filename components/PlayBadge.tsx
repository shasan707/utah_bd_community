/** The round play button drawn over a video tile. */
export default function PlayBadge({ className = "h-11 w-11" }: { className?: string }) {
  return (
    <span
      className={`flex ${className} items-center justify-center rounded-full bg-white/90 text-forest shadow-lg`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="ml-0.5 h-1/2 w-1/2" fill="currentColor">
        <path d="M8 5.5v13l11-6.5z" />
      </svg>
    </span>
  );
}
