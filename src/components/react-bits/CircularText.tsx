type CircularTextProps = {
  text: string;
  pathId: string;
  className?: string;
};

export function CircularText({ text, pathId, className = "" }: CircularTextProps) {
  const phrase = `${text} • `;
  return (
    <svg
      viewBox="0 0 200 200"
      className={`circular-text ${className}`.trim()}
      aria-hidden
    >
      <defs>
        <path
          id={pathId}
          d="M100,100 m-88,0 a88,88 0 1,1 176,0 a88,88 0 1,1 -176,0"
        />
      </defs>
      <text fill="currentColor" fontSize="11.5" letterSpacing="2.4">
        <textPath href={`#${pathId}`}>{phrase.repeat(2)}</textPath>
      </text>
    </svg>
  );
}
