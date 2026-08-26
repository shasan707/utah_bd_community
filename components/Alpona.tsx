type AlponaProps = {
  className?: string;
};

/** Decorative alpona (আলপনা) motif — a traditional Bengali floor-art flower. */
export default function Alpona({ className = "" }: AlponaProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="1.5" fill="none">
        <circle cx="100" cy="100" r="14" />
        <circle cx="100" cy="100" r="6" fill="currentColor" stroke="none" />
        {Array.from({ length: 8 }).map((_, i) => {
          const angle = (i * 45 * Math.PI) / 180;
          const x1 = 100 + Math.cos(angle) * 22;
          const y1 = 100 + Math.sin(angle) * 22;
          const x2 = 100 + Math.cos(angle) * 58;
          const y2 = 100 + Math.sin(angle) * 58;
          const perp = angle + Math.PI / 2;
          const cx1 = (x1 + x2) / 2 + Math.cos(perp) * 16;
          const cy1 = (y1 + y2) / 2 + Math.sin(perp) * 16;
          const cx2 = (x1 + x2) / 2 - Math.cos(perp) * 16;
          const cy2 = (y1 + y2) / 2 - Math.sin(perp) * 16;
          return (
            <g key={i}>
              <path d={`M ${x1} ${y1} Q ${cx1} ${cy1} ${x2} ${y2} Q ${cx2} ${cy2} ${x1} ${y1}`} />
              <circle
                cx={100 + Math.cos(angle) * 70}
                cy={100 + Math.sin(angle) * 70}
                r="3"
                fill="currentColor"
                stroke="none"
              />
            </g>
          );
        })}
        <circle cx="100" cy="100" r="82" strokeDasharray="2 7" />
        {Array.from({ length: 16 }).map((_, i) => {
          const angle = ((i * 22.5 + 11.25) * Math.PI) / 180;
          return (
            <circle
              key={`dot-${i}`}
              cx={100 + Math.cos(angle) * 92}
              cy={100 + Math.sin(angle) * 92}
              r="1.8"
              fill="currentColor"
              stroke="none"
            />
          );
        })}
      </g>
    </svg>
  );
}
