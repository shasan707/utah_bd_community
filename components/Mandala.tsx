type MandalaProps = {
  className?: string;
};

const R_OUTER = 190;
const R_DASH_A = 168;
const R_SPOKE_IN = 96;
const R_SPOKE_OUT = 162;
const R_DASH_B = 88;
const SCALLOPS = 44;
const SPOKES = 72;

/** Points on a circle, used for both the scalloped rim and the spokes. */
function pointOn(r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [200 + r * Math.cos(a), 200 + r * Math.sin(a)];
}

/** Scalloped rim: a chain of small arcs around the outer circle. */
function scallopPath(): string {
  const step = 360 / SCALLOPS;
  const bump = (Math.PI * R_OUTER) / SCALLOPS;
  let d = "";
  for (let i = 0; i < SCALLOPS; i++) {
    const [x1, y1] = pointOn(R_OUTER, i * step);
    const [x2, y2] = pointOn(R_OUTER, (i + 1) * step);
    if (i === 0) d += `M ${x1.toFixed(1)} ${y1.toFixed(1)} `;
    d += `A ${bump.toFixed(1)} ${bump.toFixed(1)} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)} `;
  }
  return `${d}Z`;
}

/**
 * Large alpona-style mandala: a scalloped rim over dashed rings and a fan of
 * fine radial spokes. Meant to sit in a corner at very low contrast.
 */
export default function Mandala({ className = "" }: MandalaProps) {
  return (
    <svg
      viewBox="0 0 400 400"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <g fill="none" stroke="currentColor" strokeLinecap="round">
        <path d={scallopPath()} strokeWidth="1.6" />
        <circle
          cx="200"
          cy="200"
          r={R_DASH_A}
          strokeWidth="1.4"
          strokeDasharray="5 7"
        />
        {Array.from({ length: SPOKES }).map((_, i) => {
          const deg = (360 / SPOKES) * i;
          const [x1, y1] = pointOn(R_SPOKE_IN, deg);
          const [x2, y2] = pointOn(R_SPOKE_OUT, deg);
          return (
            <line
              key={i}
              x1={x1.toFixed(1)}
              y1={y1.toFixed(1)}
              x2={x2.toFixed(1)}
              y2={y2.toFixed(1)}
              strokeWidth="0.9"
            />
          );
        })}
        <circle
          cx="200"
          cy="200"
          r={R_DASH_B}
          strokeWidth="1.4"
          strokeDasharray="4 8"
        />
        <circle cx="200" cy="200" r="54" strokeWidth="1.2" />
      </g>
    </svg>
  );
}
