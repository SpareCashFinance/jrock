import NumberFlow from "@number-flow/react";

type StatProps = {
  label: string;
  value: string | number | null;
  suffix?: string;
  note?: string;
};

export function Stat({ label, value, suffix, note }: StatProps) {
  const numeric = typeof value === "number";
  return (
    <div className="min-w-0">
      <p className="kicker">{label}</p>
      <p className="mt-2 font-mono text-2xl tracking-tight text-white sm:text-3xl">
        {value == null ? (
          <span className="text-[var(--stone)]">—</span>
        ) : numeric ? (
          <>
            <NumberFlow value={value} />
            {suffix ? <span className="ml-1 text-base text-[var(--cream)]">{suffix}</span> : null}
          </>
        ) : (
          value
        )}
      </p>
      {note ? <p className="mt-1 text-xs text-[var(--muted)]">{note}</p> : null}
    </div>
  );
}
