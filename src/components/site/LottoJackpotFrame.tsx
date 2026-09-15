"use client";

import NumberFlow from "@number-flow/react";
import { HouseButton } from "@/components/ui/house-button";
import { formatCount, shortenAddress } from "@/lib/format";
import { useCountdown, useLottoSnapshot } from "@/lib/lotto-client";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function LottoJackpotFrame() {
  const { tape } = useLottoSnapshot();
  const clock = useCountdown(tape.endsAt);
  const jackpot = tape.split.winnerLamports / 1_000_000_000;
  const live = tape.status === "open" && !clock.done;
  const recent = [...tape.entries].sort((a, b) => b.slot - a.slot).slice(0, 3);

  return (
    <section className="relative z-1 mx-auto w-[min(1120px,calc(100%-1.5rem))] pb-4 pt-2">
      <div className="cardboard overflow-hidden rounded-[28px] p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between px-1 text-[11px] tracking-[0.2em] uppercase">
          <span>Exhibit L · Kennel lotto</span>
          <span className="inline-flex items-center gap-2 text-[var(--ink)]">
            <span className={`size-2 rounded-full ${live ? "animate-pulse bg-[#1a0f04]" : "bg-[#1a0f04]/40"}`} />
            {live ? "Live book" : tape.status.replaceAll("_", " ")}
          </span>
        </div>
        <div className="tape-scanlines relative overflow-hidden rounded-[22px] bg-[#060a12] px-5 py-6 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.35)] sm:px-8 sm:py-7">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_right,rgba(247,147,26,0.18),transparent_46%)]" />
          <div className="relative grid items-center gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <p className="kicker">This draw · round {String(tape.round + 1).padStart(2, "0")}</p>
              <p className="serif mt-3 text-xl text-[var(--cream)] sm:text-2xl">
                Join the lotto now for your chance to win.
              </p>
              <p className="display mt-4 text-[clamp(3.4rem,8vw,6.4rem)] leading-none text-[var(--orange)]">
                <NumberFlow
                  value={Number.isFinite(jackpot) ? jackpot : 0}
                  format={{ minimumFractionDigits: 2, maximumFractionDigits: 4 }}
                />
                <span className="ml-2 text-[0.38em] tracking-wide text-white">SOL</span>
              </p>
              <p className="mt-2 text-sm text-[var(--gold)]">
                Current jackpot · 85% to one wallet · 15% seeds the next rock
              </p>
              <div className="mt-5 flex flex-wrap gap-4 text-[11px] tracking-[0.16em] uppercase text-[var(--stone)]">
                <span>
                  <span className="text-white">{formatCount(tape.totalTickets) ?? "0"}</span> slips sold
                </span>
                <span>
                  Closes {clock.done ? "now" : `${clock.days}d ${pad(clock.hours)}h ${pad(clock.minutes)}m ${pad(clock.seconds)}s`}
                </span>
                <span>{tape.ticketPriceSol} SOL a slip</span>
              </div>
              {recent.length > 0 ? (
                <div className="mt-5 space-y-1.5">
                  {recent.map((row) => (
                    <p key={row.signature} className="font-mono text-xs text-[var(--dim)]">
                      <span className="text-[var(--gold)]">{shortenAddress(row.wallet, 4)}</span>
                      {" filed "}
                      {formatCount(row.tickets)} {row.tickets === 1 ? "slip" : "slips"}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="mt-5 text-sm text-[var(--dim)]">No slips yet. The book is open.</p>
              )}
            </div>
            <div className="flex flex-col items-start gap-3 lg:items-end">
              <HouseButton variant="primary" href="/lotto" className="h-12 px-6 text-sm sm:text-base">
                Join lotto now
              </HouseButton>
              <p className="max-w-xs text-sm leading-6 text-[var(--dim)] lg:text-right">
                Same price every slip. The rock does not pick. A Solana block does.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
