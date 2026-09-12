"use client";

import { NetworkSolana } from "@web3icons/react";
import { WbtcMark } from "@/components/brand/WbtcMark";
import { Card } from "@/components/ui/card";
import { displayValue, hasBurnTx, project } from "@/lib/config";
import { explorerTxUrl, explorerUrl, pumpfunTokenUrl } from "@/lib/links";
import { shortenAddress } from "@/lib/format";
import { HouseButton } from "@/components/ui/house-button";
import { CopyButton } from "./CopyButton";

const rows = [
  { label: "Name", value: project.name },
  { label: "Ticker", value: project.ticker },
  { label: "Network", value: project.network, icon: <NetworkSolana variant="branded" size={16} /> },
  { label: "Launchpad", value: project.launchpad },
  { label: "Reward asset", value: project.rewardAsset, icon: <WbtcMark size={16} /> },
  { label: "Contract", value: displayValue(project.mint) },
  { label: "Total supply", value: displayValue(project.totalSupply) },
  { label: "Launch burn", value: `${project.burnPercent}% purchased and burned` },
  { label: "Float after burn", value: `${Math.max(0, 100 - project.burnPercent)}% remains` },
  {
    label: "Burn transaction",
    value: hasBurnTx() ? shortenAddress(project.burnTx, 6) : "Receipt pending",
  },
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
          <HouseButton variant="primary" href="#adopt">
            Adopt $JROCK
          </HouseButton>
          <HouseButton href={pumpfunTokenUrl()} target="_blank">
            pump.fun
          </HouseButton>
          {explorerUrl() ? (
            <HouseButton href={explorerUrl()} target="_blank">
              Solscan
            </HouseButton>
          ) : null}
          {hasBurnTx() ? (
            <HouseButton href={explorerTxUrl(project.burnTx)} target="_blank">
              Burn tx
            </HouseButton>
          ) : (
            <HouseButton href="#burn">Burn receipt</HouseButton>
          )}
        </div>
      </Card>
    </section>
  );
}
