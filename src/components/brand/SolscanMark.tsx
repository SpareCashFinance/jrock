export function SolscanMark({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <circle cx="32" cy="32" r="32" fill="#00FFD1" />
      <circle
        cx="32"
        cy="32"
        r="18"
        fill="none"
        stroke="#fff"
        strokeWidth="9"
        strokeLinecap="butt"
        strokeDasharray="94 19.1"
        transform="rotate(42 32 32)"
      />
      <circle cx="32" cy="32" r="8.2" fill="#C15BFF" />
    </svg>
  );
}
