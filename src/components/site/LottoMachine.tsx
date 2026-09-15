"use client";

import { LottoClip } from "@/components/site/LottoClip";

export function LottoMachine() {
  return (
    <div className="cardboard overflow-hidden rounded-[22px] p-2.5 sm:p-3">
      <div className="mb-2 flex items-center justify-between px-1 text-[11px] tracking-[0.2em] uppercase">
        <span>Exhibit L · The machine</span>
        <span>Hit SOL</span>
      </div>
      <div className="tape-scanlines relative aspect-[640/426] overflow-hidden rounded-[16px] bg-black shadow-[inset_0_0_0_1px_rgba(0,0,0,0.35)]">
        <LottoClip eager className="absolute inset-0" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(6,10,18,0.08),transparent_35%,rgba(6,10,18,0.55))]" />
        <p className="pointer-events-none absolute bottom-3 left-3 right-3 display text-2xl leading-none text-white sm:text-3xl">
          The rock is already at the machine.
        </p>
      </div>
    </div>
  );
}
