"use client";

import { formatAmount, formatUsd } from "@/lib/format";
import { useMarketSnapshot } from "@/lib/market-client";
import type { MarketSnapshot } from "@/lib/market";
import { Stat } from "./Stat";

export function LiveRewardStrip({ market: initial }: { market: MarketSnapshot }) {
  const market = useMarketSnapshot(initial);
  return (
    <section className="relative z-1 border-y border-[rgba(232,210,176,0.1)] bg-[#080d16]/80">
      <div className="mx-auto grid w-[min(1120px,calc(100%-1.5rem))] gap-6 py-5 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="WBTC distributed"
          value={formatAmount(market.totalDistributed, 6)}
          note={
            market.totalDistributed == null
              ? market.status === "awaiting_launch" || market.status === "awaiting_index"
                ? "Awaiting launch"
                : "No verified total yet"
              : market.totalDistributedSymbol
          }
        />
        <Stat
          label="Market cap"
          value={formatUsd(market.marketCapUsd)}
          note={market.marketCapUsd == null ? "Live after mint" : "stonk.fun"}
        />
        <Stat
          label="24h volume"
          value={formatUsd(market.volume24hUsd)}
          note={market.volume24hUsd == null ? "No tape yet" : "Last 24 hours"}
        />
        <Stat
          label="Next reward"
          value={market.nextRewardStatus}
          note={market.message}
        />
      </div>
    </section>
  );
}
