/**
 * A visual map of the venue, embedded from Google Maps. No API key is needed
 * for the q/output=embed form, and the iframe only loads when it scrolls into
 * view so it never slows the page down.
 */
export default function EventMap({
  query,
  title,
  className = "",
}: {
  query: string;
  title: string;
  className?: string;
}) {
  const src = `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
  return (
    <div
      className={`overflow-hidden rounded-3xl border border-sand bg-cream-dim ${className}`}
    >
      <iframe
        src={src}
        title={title}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
        className="h-full min-h-[260px] w-full border-0"
      />
    </div>
  );
}
