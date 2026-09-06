/** A small United States flag drawn inline, for the phone field's +1 prefix. */
export default function UsFlag({ className = "h-3.5 w-5" }: { className?: string }) {
  const stripes = Array.from({ length: 13 }, (_, i) => i);
  return (
    <svg
      viewBox="0 0 38 20"
      className={`${className} shrink-0 rounded-[2px] shadow-sm`}
      aria-label="United States"
      role="img"
    >
      {stripes.map((i) => (
        <rect
          key={i}
          x="0"
          y={(i * 20) / 13}
          width="38"
          height={20 / 13 + 0.2}
          fill={i % 2 === 0 ? "#B22234" : "#FFFFFF"}
        />
      ))}
      <rect x="0" y="0" width="16" height={(7 * 20) / 13} fill="#3C3B6E" />
      {[2, 6, 10, 14].map((x) =>
        [1.6, 4.4, 7.2].map((y) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="0.75" fill="#FFFFFF" />
        ))
      )}
      {[4, 8, 12].map((x) =>
        [3, 5.8, 8.6].map((y) => (
          <circle key={`b${x}-${y}`} cx={x} cy={y} r="0.75" fill="#FFFFFF" />
        ))
      )}
    </svg>
  );
}
