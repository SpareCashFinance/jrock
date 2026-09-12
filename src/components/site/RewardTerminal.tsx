"use client";

import { WbtcMark } from "@/components/brand/WbtcMark";
import { RewardAnalytics } from "@/components/charts/RewardAnalytics";
import { TapeChart } from "@/components/charts/TapeChart";
import { SlotHeadline } from "@/components/motion/SlotHeadline";
import { BorderBeam } from "@/components/ui/border-beam";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { displayValue, project } from "@/lib/config";
import { formatAmount, formatCount, formatUsd, shortenAddress, timeAgo } from "@/lib/format";
import { explorerUrl } from "@/lib/links";
import type { MarketSnapshot } from "@/lib/market";
import { useMarketSnapshot } from "@/lib/market-client";
import { HouseButton } from "@/components/ui/house-button";
import { CopyButton } from "./CopyButton";

const statusLabel: Record<MarketSnapshot["status"], string> = {
  awaiting_launch: "Awaiting launch",
  awaiting_index: "Waiting on stonk.fun",
  standard_mode: "Standard launch",
  no_distribution: "No verified distribution yet",
  unavailable: "Live data unavailable",
  live: "Live tape",
};

export function RewardTerminal({ market: initial }: { market: MarketSnapshot }) {
  const market = useMarketSnapshot(initial);
  const tax =
    market.transferFeeBps != null ? `${(market.transferFeeBps / 100).toFixed(2)}%` : displayValue(project.transferFee);
  const figures = [
    { label: `Total ${market.totalDistributedSymbol} distributed`, value: formatAmount(market.totalDistributed, 6), hint: market.totalDistributedSymbol },
    { label: "Pending pot", value: formatAmount(market.pendingDistributed, 6), hint: "Accrued, not paid yet" },
    { label: "Eligible holders", value: formatCount(market.holders), hint: "From stonk.fun when live" },
    { label: "Distributions", value: formatCount(market.payoutCount), hint: "Confirmed payouts" },
    { label: "24h volume", value: formatUsd(market.volume24hUsd), hint: "Official market only" },
    { label: "Market cap", value: formatUsd(market.marketCapUsd), hint: "Not a promise" },
    { label: "Liquidity", value: formatUsd(market.liquidityUsd), hint: displayValue(project.liquidityStatus, "To be confirmed") },
    { label: "Transfer tax", value: tax, hint: "Paid to holders on transfers" },
    { label: "Last payout", value: timeAgo(market.lastDistribution?.at) ?? "None yet", hint: market.nextRewardStatus },
  ];

  return (
    <section id="rewards" className="section">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Live reward terminal</p>
          <h2 className="display mt-3 text-6xl text-white sm:text-8xl">
            The rock&apos;s books.
          </h2>
        </div>
        <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] tracking-[0.16em] uppercase">
          <WbtcMark size={14} />
          {statusLabel[market.status]}
        </Badge>
      </div>

      <Card className="relative overflow-hidden border-[rgba(232,210,176,0.14)] bg-[#0c1320]/70 p-5 sm:p-8">
        <BorderBeam colorFrom="#f7931a" colorTo="#d4b46a" size={120} duration={9} />
        <p className="max-w-2xl text-sm leading-6 text-[var(--dim)]">{market.message}</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {figures.map((row) => (
            <div key={row.label} className="rounded-2xl border border-[rgba(232,210,176,0.1)] bg-[#060a12]/50 p-4">
              <p className="kicker">{row.label}</p>
              <p className="mt-2 font-mono text-2xl text-white">
                <SlotHeadline value={row.value ?? "—"} entrance={Boolean(row.value)} />
              </p>
              <p className="mt-1 text-xs text-[var(--dim)]">{row.hint}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div>
            <p className="kicker mb-3">Distribution tape</p>
            <TapeChart history={market.history} />
          </div>
          <div>
            <p className="kicker mb-3">Payout analytics</p>
            <RewardAnalytics history={market.history} />
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3 text-sm text-[var(--dim)]">
          <span>Mint {shortenAddress(project.mint || "pending")}</span>
          <CopyButton value={project.mint} className="px-3 text-[11px]" />
          {explorerUrl() ? (
            <HouseButton className="px-3 text-[11px]" href={explorerUrl()} target="_blank">
              Explorer
            </HouseButton>
          ) : null}
          {explorerUrl(project.rewardMint) ? (
            <HouseButton className="px-3 text-[11px]" href={explorerUrl(project.rewardMint)} target="_blank">
              WBTC mint
            </HouseButton>
          ) : (
            <span>WBTC mint · To be confirmed</span>
          )}
        </div>
      </Card>
    </section>
  );
}
