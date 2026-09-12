type CircularTextProps = {
  text: string;
  pathId: string;
  className?: string;
};

const RING_RADIUS = 88;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

export function CircularText({ text, pathId, className = "" }: CircularTextProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      className={`circular-text ${className}`.trim()}
      aria-hidden
    >
      <defs>
        <path
          id={pathId}
          d={`M100,100 m-${RING_RADIUS},0 a${RING_RADIUS},${RING_RADIUS} 0 1,1 ${RING_RADIUS * 2},0 a${RING_RADIUS},${RING_RADIUS} 0 1,1 -${RING_RADIUS * 2},0`}
        />
      </defs>
      <text fill="currentColor" fontSize="10.5" letterSpacing="1.6">
        <textPath href={`#${pathId}`} textLength={RING_LENGTH} lengthAdjust="spacing">
          {`${text} • `}
        </textPath>
      </text>
    </svg>
  );
}
