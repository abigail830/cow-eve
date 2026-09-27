type Props = {
  size?: number;
  className?: string;
};

/** Waveform + doc — audio transcript artifact mark. */
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
      <rect x="9" y="11" width="14" height="18" rx="2" fill="#F27A2A" opacity="0.15" />
      <path
        d="M12 24V16M15 26V14M18 22V18M21 25V15"
        stroke="#F27A2A"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M26 13H31C31.55 13 32 13.45 32 14V26C32 26.55 31.55 27 31 27H26"
        stroke="#555"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path d="M26 17H30M26 20H29M26 23H30" stroke="#888" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}
