type CircularTextProps = {
  text: string;
  className?: string;
};

export function CircularText({ text, className = "" }: CircularTextProps) {
  const phrase = `${text} • `;
  return (
    <svg
      viewBox="0 0 200 200"
      className={`circular-text ${className}`.trim()}
      aria-hidden
    >
      <defs>
        <path
          id="jrock-circle"
          d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0"
        />
      </defs>
      <text fill="currentColor" fontSize="11.5" letterSpacing="2.4">
        <textPath href="#jrock-circle">{phrase.repeat(2)}</textPath>
      </text>
    </svg>
  );
}
