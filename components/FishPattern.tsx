type FishPatternProps = {
  className?: string;
  /** Unique suffix so the pattern id stays valid if it is used more than once. */
  uid?: string;
};

/** One outlined fish, drawn around (0,0) facing right. */
function Fish() {
  return (
    <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      {/* body */}
      <path d="M-52 0 C -34 -17, 12 -17, 34 0 C 12 17, -34 17, -52 0 Z" />
      {/* tail */}
      <path d="M34 0 L 56 -13 L 50 0 L 56 13 Z" />
      {/* gill */}
      <path d="M-30 -12 C -22 -4, -22 4, -30 12" />
      {/* scale line */}
      <path
        d="M-18 -11 C -10 -3, -10 3, -18 11"
        strokeDasharray="3 4"
        strokeWidth="1.1"
      />
      <path
        d="M-4 -9 C 4 -2, 4 2, -4 9"
        strokeDasharray="3 4"
        strokeWidth="1.1"
      />
      {/* eye */}
      <circle cx="-42" cy="-2" r="1.8" />
    </g>
  );
}

/**
 * A shoal of faint outlined fish, tiled. Rows alternate their horizontal
 * offset so the grid reads as a scatter rather than a lattice.
 */
export default function FishPattern({
  className = "",
  uid = "a",
}: FishPatternProps) {
  const patternId = `fish-${uid}`;

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
          width="320"
          height="200"
        >
          <g transform="translate(80 50)">
            <Fish />
          </g>
          <g transform="translate(240 150)">
            <Fish />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
