type MountainsProps = {
  className?: string;
};

/** Wasatch-style layered mountain silhouette — the Utah half of the brand. */
export default function Mountains({ className = "" }: MountainsProps) {
  return (
    <svg
      viewBox="0 0 1440 240"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M0 200 L110 130 L200 175 L330 95 L440 165 L560 115 L680 175 L800 100 L920 165 L1040 125 L1160 180 L1280 115 L1380 160 L1440 140 V240 H0 Z"
        fill="currentColor"
        opacity="0.35"
      />
      <path
        d="M0 215 L150 150 L280 205 L430 130 L570 195 L720 145 L870 205 L1010 150 L1150 200 L1300 155 L1440 195 V240 H0 Z"
        fill="currentColor"
        opacity="0.6"
      />
      <path
        d="M0 240 L90 205 L230 232 L400 195 L560 230 L740 200 L900 232 L1080 205 L1250 234 L1440 210 V240 H0 Z"
        fill="currentColor"
      />
    </svg>
  );
}
