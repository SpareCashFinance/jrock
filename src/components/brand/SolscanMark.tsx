export function SolscanMark({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <rect width="32" height="32" rx="8" fill="#142C54" />
      <path
        d="M8.4 17.8c0-4.3 3.4-7.7 8-7.7 3.2 0 5.9 1.6 7.2 4.1l-3.1 1.5c-.8-1.5-2.3-2.5-4.1-2.5-2.6 0-4.6 2-4.6 4.6s2 4.6 4.6 4.6c1.8 0 3.3-1 4.1-2.5l3.1 1.5c-1.3 2.5-4 4.1-7.2 4.1-4.6 0-8-3.4-8-7.7Z"
        fill="#66F9ED"
      />
    </svg>
  );
}
