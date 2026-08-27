type HoneycombProps = {
  className?: string;
};

function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 })
    .map((_, i) => {
      const angle = ((60 * i - 30) * Math.PI) / 180;
      return `${(cx + r * Math.cos(angle)).toFixed(1)},${(
        cy + r * Math.sin(angle)
      ).toFixed(1)}`;
    })
    .join(" ");
}

const R = 22;
const W = R * Math.sqrt(3);
const centers: [number, number][] = [
  [80, 80],
  [80 + W, 80],
  [80 - W, 80],
  [80 + W / 2, 80 - R * 1.5],
  [80 - W / 2, 80 - R * 1.5],
  [80 + W / 2, 80 + R * 1.5],
  [80 - W / 2, 80 + R * 1.5],
];

/** Honeycomb cluster, a nod to Utah, the Beehive State. */
export default function Honeycomb({ className = "" }: HoneycombProps) {
  return (
    <svg
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {centers.map((c, i) => (
        <polygon
          key={i}
          points={hexPoints(c[0], c[1], R - 2)}
          stroke="currentColor"
          strokeWidth="1.5"
          fill={i === 0 ? "currentColor" : "none"}
          fillOpacity={i === 0 ? 0.25 : 0}
        />
      ))}
    </svg>
  );
}
