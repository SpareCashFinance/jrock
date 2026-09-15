"use client";

import NumberFlow from "@number-flow/react";
import { HouseButton } from "@/components/ui/house-button";
import { LottoClip } from "@/components/site/LottoClip";
import { formatCount } from "@/lib/format";
import { useCountdown, useLottoSnapshot } from "@/lib/lotto-client";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function LottoJackpotFrame() {
  const { tape } = useLottoSnapshot();
  const clock = useCountdown(tape.endsAt);
  const jackpot = tape.split.winnerLamports / 1_000_000_000;
  const live = tape.status === "open" && !clock.done;

  return (
    <section className="relative z-1 mx-auto w-[min(1120px,calc(100%-1.5rem))] pb-8 pt-1">
      <div className="cardboard overflow-hidden rounded-[22px] p-2 sm:p-2.5">
        <div className="relative flex items-center gap-3 overflow-hidden rounded-[16px] bg-[#060a12] px-3 py-2.5 sm:gap-4 sm:px-4">
          <div className="pointer-events-none absolute inset-0 rounded-[16px] bg-[radial-gradient(circle_at_right,rgba(247,147,26,0.14),transparent_42%)]" />
          <a
            href="/lotto"
            aria-label="Watch the kennel lotto and join this draw"
            className="relative block h-20 w-[7.5rem] shrink-0 overflow-hidden rounded-xl border border-[rgba(247,147,26,0.35)] bg-black sm:h-[5.5rem] sm:w-[8.25rem]"
          >
            <LottoClip />
            <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_55%,rgba(6,10,18,0.45))]" />
          </a>
          <div className="relative flex min-w-0 flex-1 flex-wrap items-center gap-x-5 gap-y-2">
            <div>
              <p className="kicker">
                Exhibit L · {live ? "Live jackpot" : tape.status.replaceAll("_", " ")}
              </p>
              <p className="display mt-0.5 text-[clamp(1.8rem,4vw,2.6rem)] leading-none text-[var(--orange)]">
                <NumberFlow
                  value={Number.isFinite(jackpot) ? jackpot : 0}
                  format={{ minimumFractionDigits: 2, maximumFractionDigits: 4 }}
                />
                <span className="ml-1.5 text-[0.42em] tracking-wide text-white">SOL</span>
              </p>
            </div>
            <p className="hidden max-w-xs text-sm text-[var(--dim)] md:block">
              Join the kennel lotto for a chance at 85% of the pot.
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] tracking-[0.14em] uppercase text-[var(--stone)]">
              <span>
                <span className="text-white">{formatCount(tape.totalTickets) ?? "0"}</span> slips
              </span>
              <span>
                {clock.done ? "closed" : `${clock.days}d ${pad(clock.hours)}h ${pad(clock.minutes)}m`}
              </span>
              <span>{tape.ticketPriceSol} SOL a slip</span>
            </div>
          </div>
          <HouseButton variant="primary" href="/lotto" className="relative h-10 shrink-0 px-4 text-sm">
            Join lotto
          </HouseButton>
        </div>
      </div>
    </section>
  );
}
