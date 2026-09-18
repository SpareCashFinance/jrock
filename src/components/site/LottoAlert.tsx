"use client";

import { useEffect } from "react";

export function LottoAlert({
  text,
  onDismiss,
}: {
  text: string;
  onDismiss: () => void;
}) {
  const cancelled = /cancelled/i.test(text);
  useEffect(() => {
    const id = window.setTimeout(onDismiss, cancelled ? 4500 : 10000);
    return () => window.clearTimeout(id);
  }, [cancelled, onDismiss, text]);

  return (
    <div
      role="status"
      className={`mt-3 flex items-start gap-3 rounded-2xl border px-3 py-3 text-sm leading-5 ${
        cancelled
          ? "border-[rgba(232,210,176,0.22)] bg-[#14110c] text-[var(--cream)]"
          : "border-[rgba(255,138,106,0.35)] bg-[#2a1210] text-[#ffc4b4]"
      }`}
    >
      <p className="min-w-0 flex-1">{text}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 text-[11px] tracking-[0.16em] uppercase text-[var(--gold)] hover:text-white"
      >
        Dismiss
      </button>
    </div>
  );
}
