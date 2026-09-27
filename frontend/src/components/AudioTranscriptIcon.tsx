type Props = {
  size?: number;
  className?: string;
};

/** Compact line-art mark aligned with artifact cover illustrations. */
export function AudioTranscriptIcon({ size = 20, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <rect
        x="2.5"
        y="2"
        width="15"
        height="16"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <rect
        x="4"
        y="4"
        width="4.5"
        height="12"
        rx="0.5"
        fill="currentColor"
        fillOpacity="0.1"
        stroke="currentColor"
        strokeWidth="1.25"
      />
      <path
        d="M5.2 10v3M6.8 8v7M8.4 9.5v4"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
      <path
        d="M10 6h7M10 9h5.5M10 12h6M10 15h4"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
    </svg>
  );
}
