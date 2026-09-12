import { hasBurnTx, project } from "@/lib/config";
import { explorerTxUrl } from "@/lib/links";
import { HouseButton } from "@/components/ui/house-button";
import type { BurnSnapshot } from "@/lib/burn";
import { CopyButton } from "./CopyButton";
import { BurnIncinerator } from "./BurnFlame";

const remaining = Math.max(0, 100 - project.burnPercent);

export function BurnReceipt({ burn }: { burn: BurnSnapshot }) {
  const filed = hasBurnTx();

  return (
    <section id="burn" className="section">
      <p className="kicker">Exhibit C · Incinerator</p>
      <h2 className="display mt-3 max-w-4xl text-6xl text-white sm:text-8xl">
        Buy {project.burnPercent}. Burn {project.burnPercent}.
        <span className="block text-[var(--orange)]">Leave more rock per holder.</span>
      </h2>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--dim)]">
        At launch we buy {project.burnPercent}% of {project.ticker} supply and send it to the
        burn. Holder Rewards stay separate: a 3% trading fee is meant to pay eligible
        holders in WBTC. Smaller float. Variable Bitcoin. Not a promise.
      </p>

      <div className="mt-8">
        <BurnIncinerator initial={burn} />
      </div>

      <div className="cardboard mt-8 rounded-[32px] p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-2 text-[11px] tracking-[0.2em] uppercase">
          <span>Burn receipt · Solana transaction</span>
          <span>{filed ? "Filed on-chain" : "Slot open"}</span>
        </div>

        <div className="relative overflow-hidden rounded-[22px] bg-[#070b12] p-5 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.35)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 opacity-[0.14] [background-image:linear-gradient(rgba(247,147,26,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(247,147,26,0.14)_1px,transparent_1px)] [background-size:28px_28px]" />
          <div className="relative">
            <div className="flex flex-wrap gap-2">
              <span className="chip">{project.burnPercent}% launch burn</span>
              <span className="chip">3% to holders in WBTC</span>
              <span className="chip">{remaining}% remains after launch</span>
            </div>

            {filed ? (
              <>
                <p className="kicker mt-6">Transaction</p>
                <p className="mt-3 break-all font-mono text-sm leading-7 text-white sm:text-lg">
                  {project.burnTx}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <CopyButton value={project.burnTx} label="Copy burn tx" emptyLabel="Receipt pending" />
                  <HouseButton href={explorerTxUrl(project.burnTx)} target="_blank">
                    View on Solscan
                  </HouseButton>
                </div>
              </>
            ) : (
              <>
                <p className="kicker mt-6">Transaction</p>
                <p className="display mt-3 text-4xl text-white sm:text-6xl">Receipt pending.</p>
                <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--dim)]">
                  This slot holds the burn transaction once {project.burnPercent}% of supply is
                  purchased and destroyed. The signature lands here the moment it is on-chain.
                </p>
                <div
                  className="mt-6 flex min-h-16 items-center rounded-xl border border-dashed border-[rgba(232,210,176,0.22)] bg-black/40 px-4 font-mono text-xs tracking-[0.18em] text-[var(--stone)] sm:text-sm"
                  aria-hidden
                >
                  0000…slot reserved for burn tx
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
