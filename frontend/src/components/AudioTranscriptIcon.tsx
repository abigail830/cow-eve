type Props = {
  size?: number;
  className?: string;
};

/** Compact mark — matches @fde/artifact-ui audio transcript cover. */
export function AudioTranscriptIcon({ size = 40, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect width="40" height="40" rx="10" fill="#FFF5EE" />
      <rect x="6" y="11" width="14" height="18" rx="4" fill="#F27A2A" fillOpacity="0.18" />
      <path
        d="M9 22V18M12 24V16M15 21V19M18 23V17"
        stroke="#E86A1A"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M12 26c0 2.2 1.4 3.6 3 3.6s3-1.4 3-3.6"
        stroke="#E86A1A"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M12 26v2" stroke="#E86A1A" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M22 10H34V30H22Z"
        stroke="#555"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <rect x="24" y="14" width="8" height="3" rx="0.5" fill="#F27A2A" fillOpacity="0.35" />
      <path d="M24 20H31M24 24H28M24 27H30" stroke="#888" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="28" cy="15.5" r="1.25" fill="#F27A2A" />
    </svg>
  );
}
