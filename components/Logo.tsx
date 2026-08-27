type LogoProps = {
  className?: string;
  /** Unique suffix so the clip-path id stays valid when the logo appears more than once per page. */
  uid?: string;
};

/** Utha USA mark: the red sun rising behind the Wasatch peaks over the Great Salt Lake. */
export default function Logo({ className = "", uid = "a" }: LogoProps) {
  const clipId = `logo-above-${uid}`;
  return (
    <svg
      viewBox="0 0 160 160"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Utha USA logo"
      role="img"
    >
      <defs>
        <clipPath id={clipId}>
          <path d="M0,0 H160 V96 L132,96 L104,44 L80,75 L62,54 L28,96 L0,96 Z" />
        </clipPath>
      </defs>
      <circle
        cx="80"
        cy="80"
        r="76"
        fill="none"
        stroke="#054C38"
        strokeWidth="3"
        strokeDasharray="2 13"
        strokeLinecap="round"
      />
      <circle cx="83" cy="49" r="21.7" fill="#F42A41" clipPath={`url(#${clipId})`} />
      <path
        d="M28,96 L62,54 L80,75 L104,44 L132,96"
        fill="none"
        stroke="#054C38"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M63,109 H103" stroke="#F42A41" strokeWidth="5" strokeLinecap="round" />
      <path d="M68,118 H98" stroke="#F42A41" strokeWidth="4.7" strokeLinecap="round" opacity="0.8" />
      <path d="M73,127 H93" stroke="#F5806E" strokeWidth="4.4" strokeLinecap="round" />
    </svg>
  );
}
