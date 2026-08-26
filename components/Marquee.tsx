const items = [
  "Pohela Boishakh",
  "Eid Reunion",
  "Victory Day",
  "Pitha Utshob",
  "Ekushey February",
  "Grand Picnic",
  "Cultural Night",
  "Independence Day",
];

/** Infinite ribbon of festival names gliding across the screen. */
export default function Marquee() {
  const row = [...items, ...items];
  return (
    <div className="overflow-hidden border-y border-sand bg-forest-ink py-5">
      <div className="marquee-track flex w-max items-center gap-10">
        {row.map((item, i) => (
          <span key={i} className="flex items-center gap-10 whitespace-nowrap">
            <span className="text-2xl font-bold text-cream md:text-3xl">
              {item}
            </span>
            <span className="text-bengal-red text-xl">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
