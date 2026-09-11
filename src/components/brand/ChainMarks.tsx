"use client";

import { NetworkSolana, TokenBTC, TokenWBTC } from "@web3icons/react";
import { cn } from "@/lib/utils";

export function ChainMarks({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-[var(--dim)]", className)}>
      <span className="inline-flex items-center gap-1.5">
        <NetworkSolana variant="branded" size={16} />
        Solana
      </span>
      <span className="text-[var(--gold)]">/</span>
      <span className="inline-flex items-center gap-1.5">
        <TokenWBTC variant="branded" size={16} />
        WBTC
      </span>
      <span className="text-[var(--gold)]">/</span>
      <span className="inline-flex items-center gap-1.5">
        <TokenBTC variant="branded" size={16} />
        Bitcoin
      </span>
    </div>
  );
}
