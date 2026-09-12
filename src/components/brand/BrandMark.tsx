export function BrandMark({
  size = 20,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icon"
      alt=""
      width={size}
      height={size}
      className={`inline-block rounded-full align-[-0.2em] ${className}`.trim()}
    />
  );
}
