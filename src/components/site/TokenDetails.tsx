"use client";

import { NetworkSolana, TokenWBTC } from "@web3icons/react";
import { Card } from "@/components/ui/card";
import { displayValue, project } from "@/lib/config";
import { explorerUrl, stonkfunTokenUrl } from "@/lib/links";
import { CopyButton } from "./CopyButton";

const rows = [
  { label: "Name", value: project.name },
  { label: "Ticker", value: project.ticker },
  { label: "Network", value: project.network, icon: <NetworkSolana variant="branded" size={16} /> },
  { label: "Launchpad", value: project.launchpad },
  { label: "Reward asset", value: project.rewardAsset, icon: <TokenWBTC variant="branded" size={16} /> },
  { label: "Contract", value: displayValue(project.mint) },
  { label: "Total supply", value: displayValue(project.totalSupply) },
  { label: "Transfer / trading fee", value: displayValue(project.transferFee) },
  { label: "Holder eligibility", value: displayValue(project.eligibility) },
  { label: "Liquidity", value: displayValue(project.liquidityStatus) },
  { label: "Authority", value: displayValue(project.authorityStatus) },
];

export function TokenDetails() {
  return (
    <section id="rockonomics" className="section">
      <p className="kicker">The Rockonomics</p>
      <h2 className="display mt-3 text-6xl text-white sm:text-8xl">Facts, not folklore.</h2>
      <Card className="mt-8 overflow-hidden border-[rgba(232,210,176,0.14)] bg-[#0c1320]/70">
        <dl className="divide-y divide-[rgba(232,210,176,0.08)]">
          {rows.map((row) => (
            <div key={row.label} className="grid gap-2 px-5 py-4 sm:grid-cols-[200px_1fr] sm:items-center">
              <dt className="text-xs tracking-[0.16em] uppercase text-[var(--gold)]">{row.label}</dt>
              <dd className="flex flex-wrap items-center gap-2 font-mono text-sm text-white sm:text-base">
                {row.icon}
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-3 border-t border-[rgba(232,210,176,0.08)] p-5">
          <CopyButton value={project.mint} />
          <a className="btn btn-primary" href={stonkfunTokenUrl()}>
            Official stonk.fun market
          </a>
          {explorerUrl() ? (
            <a className="btn btn-ghost" href={explorerUrl()}>
              Solana Explorer
            </a>
          ) : null}
        </div>
      </Card>
    </section>
  );
}
