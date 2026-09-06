type VineProps = {
  className?: string;
  /** Unique suffix so the pattern id stays valid if the vine appears more than once. */
  uid?: string;
};

const FLOWERS: [number, number][] = [
  [100, 34],
  [300, 86],
];

const LEAVES: [number, number, number][] = [
  [42, 47, -28],
  [158, 47, 28],
  [242, 73, -28],
  [358, 73, 28],
];

/**
 * A faint kantha-style vine: a running stem with five-petal flowers and small
 * leaves. Drawn as a tiling pattern so it repeats across any width without
 * stretching the motifs.
 */
export default function Vine({ className = "", uid = "a" }: VineProps) {
  const patternId = `vine-${uid}`;

  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id={patternId}
          patternUnits="userSpaceOnUse"
          width="400"
          height="120"
        >
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          >
            {/* running stem */}
            <path d="M0 60 C 50 25 150 25 200 60 C 250 95 350 95 400 60" />

            {FLOWERS.map(([cx, cy]) => (
              <g key={`${cx}-${cy}`}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <ellipse
                    key={i}
                    cx={cx}
                    cy={cy - 9}
                    rx="4.5"
                    ry="7.5"
                    transform={`rotate(${i * 72} ${cx} ${cy})`}
                  />
                ))}
                <circle cx={cx} cy={cy} r="2" />
              </g>
            ))}

            {LEAVES.map(([cx, cy, angle]) => (
              <ellipse
                key={`${cx}-${cy}`}
                cx={cx}
                cy={cy}
                rx="9"
                ry="4"
                transform={`rotate(${angle} ${cx} ${cy})`}
              />
            ))}
          </g>
        </pattern>
      </defs>

      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
