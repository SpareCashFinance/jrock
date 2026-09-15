"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { Dices, Trophy, Users } from "lucide-react";
import { HouseButton } from "@/components/ui/house-button";
import { project } from "@/lib/config";
import { formatAmount, formatCount, shortenAddress } from "@/lib/format";
import { explorerAccountUrl, explorerTxUrl, links } from "@/lib/links";
import {
  DRAW_LAG_SECONDS,
  MEMO_PROGRAM_ID,
  emptyLottoSnapshot,
  hasLottoPot,
  lottoMemo,
  slipFeeLamports,
  slipTotalLamports,
  verifyDraw,
  verifyProgramDraw,
  winnerIndexFromBlockhash,
  winnerIndexFromSlotHash,
  slipRange,
  type LottoPostedWin,
  type LottoSnapshot,
} from "@/lib/lotto";
import { buyIxForRound, claimIx, closeSalesIx, openRoundIx, settleIx } from "@/lib/lotto-program";
import { useSolanaWallet } from "@/components/solana/SolanaWalletProvider";
import { TelegramMark, XMark } from "@/components/brand/SocialMarks";

const PRESETS = [1, 2, 5, 10];

function ixDataFromText(value: string) {
  return new TextEncoder().encode(value) as unknown as Buffer;
}

function useCountdown(iso: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const end = Date.parse(iso);
  const left = Math.max(0, end - now);
  const total = Math.floor(left / 1000);
  return {
    done: left <= 0,
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

function ClockBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass-panel min-w-[4.5rem] rounded-2xl px-3 py-3 text-center">
      <p className="display text-4xl text-white sm:text-5xl">{String(value).padStart(2, "0")}</p>
      <p className="mt-1 text-[10px] tracking-[0.16em] uppercase text-[var(--gold)]">{label}</p>
    </div>
  );
}

export function LottoDesk() {
  const solana = useSolanaWallet();
  const [tape, setTape] = useState<LottoSnapshot>(emptyLottoSnapshot("Loading the kennel pot."));
  const [count, setCount] = useState(1);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState("");
  const clock = useCountdown(tape.endsAt);
  const potReady = tape.pot.length >= 32 && (tape.engine === "program" || hasLottoPot());
  const canBuy = potReady && tape.status === "open" && !clock.done;
  const yours = useMemo(
    () =>
      solana.address
        ? tape.entries.filter((row) => row.wallet === solana.address).reduce((sum, row) => sum + row.tickets, 0)
        : 0,
    [solana.address, tape.entries],
  );

  const load = useCallback(async () => {
    const res = await fetch("/api/lotto", { cache: "no-store" });
    const next = (await res.json()) as LottoSnapshot & { error?: string };
    if (!res.ok) throw new Error(next.error || "The lotto tape refused");
    setTape(next);
  }, []);

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "The lotto tape refused");
    });
    const id = window.setInterval(() => {
      void load().catch(() => undefined);
    }, 20_000);
    return () => window.clearInterval(id);
  }, [load]);

  return (
    <section className="section pb-16 pt-8">
      <div className="mb-8 max-w-3xl">
        <p className="kicker">Exhibit L · The rock picks one</p>
        <h1 className="display mt-3 text-6xl text-white sm:text-8xl">
          The kennel
          <span className="block text-[var(--orange)]">lotto.</span>
        </h1>
        <p className="serif mt-5 max-w-xl text-xl text-[var(--cream)] sm:text-2xl">
          {tape.engine === "program"
            ? "Buy a slip in SOL. Ticket money goes in the pot. A 1% kennel fee is paid on every slip. The winner takes 85%. Fifteen percent stays to seed the next rock."
            : `Buy a slip in SOL. Sales die with the clock. ${DRAW_LAG_SECONDS} seconds later a finalized Solana blockhash is hashed. That number modulo the book is the winner. The rock does not pick.`}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,400px)]">
        <div className="space-y-5">
          <div className="glass-panel rounded-[28px] p-5 sm:p-7">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="kicker">Round {String(tape.round + 1).padStart(2, "0")}</p>
                <h2 className="display mt-2 text-5xl text-white">This draw</h2>
              </div>
              <p className="text-xs tracking-[0.16em] uppercase text-[var(--gold)]">
                {tape.status.replaceAll("_", " ")}
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <ClockBox label="Days" value={clock.days} />
              <ClockBox label="Hours" value={clock.hours} />
              <ClockBox label="Minutes" value={clock.minutes} />
              <ClockBox label="Seconds" value={clock.seconds} />
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="In the pot" value={`${formatAmount(tape.engine === "program" ? tape.potSol : tape.roundSol, 4) ?? "0"} SOL`} />
              <Stat label="Winner 85%" value={`${formatAmount(tape.split.winnerLamports / 1_000_000_000, 4) ?? "0"} SOL`} />
              <Stat label="Next seed 15%" value={`${formatAmount(tape.split.carryLamports / 1_000_000_000, 4) ?? "0"} SOL`} />
              <Stat label="Your slips" value={formatCount(yours) ?? "0"} />
            </div>
            <p className="mt-3 text-xs tracking-[0.14em] uppercase text-[var(--gold)]">
              {formatCount(tape.totalTickets) ?? "0"} slips sold
              {tape.split.seedLamports > 0
                ? ` · ${formatAmount(tape.split.seedLamports / 1_000_000_000, 4)} SOL rolled in from last round`
                : ""}
            </p>
            <p className="serif mt-5 text-lg text-[var(--cream)]">{tape.message}</p>
          </div>

          {tape.draw ? (
            <WinnerCard title="This block picked" draw={tape.draw} jackpotLamports={tape.split.winnerLamports} />
          ) : null}
          {tape.last && !tape.draw ? <WinnerCard title="Last rock picked" draw={tape.last} /> : null}
          <ProofCard tape={tape} />
        </div>

        <BuyCard
          tape={tape}
          count={count}
          setCount={setCount}
          canBuy={canBuy}
          potReady={potReady}
          phase={phase}
          error={error}
          onBuy={() =>
            void (tape.engine === "program"
              ? buyWithProgram(solana, tape, count, setPhase, setError, load)
              : buyWithWallet(solana, tape, count, setPhase, setError, load))
          }
        />
      </div>

      {tape.engine === "program" ? (
        <CrankBar
          tape={tape}
          salesEnded={clock.done}
          solana={solana}
          phase={phase}
          setPhase={setPhase}
          setError={setError}
          reload={load}
        />
      ) : null}

      <PostedWinners tape={tape} />
      <WalletBook tape={tape} you={solana.address} />
      <PurchaseLog tape={tape} you={solana.address} />

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <HouseButton variant="primary" href={links.telegram} target="_blank">
          <TelegramMark size={15} />
          Post the winner in the kennel
        </HouseButton>
        <HouseButton href={links.twitter} target="_blank">
          <XMark size={14} />
          Follow the rock
        </HouseButton>
        <HouseButton href="/#adopt">Adopt the rock</HouseButton>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[rgba(232,210,176,0.12)] bg-[#080d16] px-4 py-3">
      <p className="text-[10px] tracking-[0.16em] uppercase text-[var(--gold)]">{label}</p>
      <p className="display mt-1 text-3xl text-white">{value}</p>
    </div>
  );
}

function WinnerCard({
  title,
  draw,
  jackpotLamports = 0,
}: {
  title: string;
  draw: NonNullable<LottoSnapshot["draw"]>;
  jackpotLamports?: number;
}) {
  return (
    <div className="glass-panel rounded-[28px] p-5 sm:p-7">
      <p className="kicker">{title}</p>
      <p className="display mt-2 text-4xl text-[var(--orange)]">{shortenAddress(draw.winner, 6)}</p>
      {jackpotLamports > 0 ? (
        <p className="display mt-2 text-3xl text-white">{formatAmount(jackpotLamports / 1_000_000_000, 4)} SOL</p>
      ) : null}
      <p className="mt-2 text-sm text-[var(--dim)]">
        Slip {draw.winnerIndex} · slot {formatCount(draw.slot)} · {draw.verified ? "proof checks" : "proof failed"}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <HouseButton href={explorerAccountUrl(draw.winner)} target="_blank">
          Winner
        </HouseButton>
        <HouseButton href={`https://solscan.io/block/${draw.slot}`} target="_blank">
          Block {draw.slot}
        </HouseButton>
        {draw.winningSignature ? (
          <HouseButton href={explorerTxUrl(draw.winningSignature)} target="_blank">
            Winning slip
          </HouseButton>
        ) : null}
      </div>
      <p className="mt-4 break-all font-mono text-[11px] text-[var(--stone)]">
        {draw.blockhash.length === 64 ? "slot hash" : "blockhash"} {draw.blockhash}
      </p>
      <p className="mt-1 break-all font-mono text-[11px] text-[var(--stone)]">sha256 {draw.hash}</p>
    </div>
  );
}

function ProofCard({ tape }: { tape: LottoSnapshot }) {
  const [local, setLocal] = useState<string>("");
  const [server, setServer] = useState<string>("");

  async function checkHere() {
    if (!tape.draw) {
      setLocal(
        tape.engine === "program"
          ? "No draw yet. Close sales, wait for the entropy slot, then crank Settle."
          : "No draw yet. The clock and the 60-second lag have to finish first.",
      );
      return;
    }
    if (tape.engine === "program") {
      const math = await winnerIndexFromSlotHash(tape.draw.blockhash, tape.round, tape.slips.length);
      const ok = await verifyProgramDraw(tape.draw, tape.slips, tape.round);
      setLocal(
        ok
          ? `Local math matches. sha256(slot hash || round ${tape.round} || ${tape.slips.length} slips) % ${tape.slips.length} = slip ${math.index}.`
          : `Local math disagrees. Got slip ${math.index}, tape says ${tape.draw.winnerIndex}. Do not trust this draw.`,
      );
      return;
    }
    const math = await winnerIndexFromBlockhash(tape.draw.blockhash, tape.slips.length);
    const ok = await verifyDraw(tape.draw, tape.slips);
    setLocal(
      ok
        ? `Local math matches. sha256(blockhash) % ${tape.slips.length} = slip ${math.index}.`
        : `Local math disagrees. Got slip ${math.index}, tape says ${tape.draw.winnerIndex}. Do not trust this draw.`,
    );
  }

  async function checkServer() {
    const res = await fetch("/api/lotto/verify", { cache: "no-store" });
    const next = (await res.json()) as { ok?: boolean; error?: string };
    setServer(next.ok ? "Fresh chain read agrees with the posted proof." : next.error || "The proof did not recompute.");
  }

  return (
    <div className="glass-panel rounded-[28px] p-5 sm:p-7">
      <p className="kicker">Provable random · {tape.proof.version}</p>
      <ol className="serif mt-4 space-y-3 text-lg text-[var(--cream)]">
        <li>01 · {tape.proof.rules.ticket}</li>
        <li>02 · {tape.proof.rules.window}</li>
        <li>03 · {tape.proof.rules.order}</li>
        <li>04 · {tape.proof.rules.entropy}</li>
        <li>05 · {tape.proof.rules.formula}</li>
        <li>06 · {tape.proof.rules.payout}</li>
      </ol>
      <p className="mt-4 text-sm leading-6 text-[var(--dim)]">
        {tape.engine === "program"
          ? "The round account is the pot. Winner takes 85%. Fifteen percent rolls into the next round. Each slip also pays a 1% kennel fee. Open the pot on Solscan. Match the buyers. After settle, hash the slot hash with the round id and slip count. If that is not the posted winner, the tape is lying."
          : "Open the pot on Solscan and match every slip. Open the slot and match the blockhash. Hash it. Modulo the book. If that is not the posted winner, the tape is lying. The kennel still has to send the pot — randomness is public, payout is a transfer."}{" "}
        {project.ticker} is entertainment and can go to zero.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <HouseButton onClick={() => void checkHere()}>Check the math here</HouseButton>
        <HouseButton onClick={() => void checkServer()}>Re-read the chain</HouseButton>
        {tape.pot ? (
          <HouseButton href={explorerAccountUrl(tape.pot)} target="_blank">
            Pot on Solscan
          </HouseButton>
        ) : null}
        {tape.programId ? (
          <HouseButton href={explorerAccountUrl(tape.programId)} target="_blank">
            Program
          </HouseButton>
        ) : null}
        {tape.proof.slot ? (
          <HouseButton href={`https://solscan.io/block/${tape.proof.slot}`} target="_blank">
            Entropy block
          </HouseButton>
        ) : null}
      </div>
      {local ? <p className="mt-3 text-sm text-[var(--gold)]">{local}</p> : null}
      {server ? <p className="mt-2 text-sm text-[var(--gold)]">{server}</p> : null}
      <p className="mt-4 font-mono text-[11px] text-[var(--stone)]">
        book {tape.proof.bookHash || "empty"} · slips {tape.proof.ticketCount} · entropy after {tape.proof.entropyAfter}
      </p>
    </div>
  );
}

function BuyCard({
  tape,
  count,
  setCount,
  canBuy,
  potReady,
  phase,
  error,
  onBuy,
}: {
  tape: LottoSnapshot;
  count: number;
  setCount: (n: number) => void;
  canBuy: boolean;
  potReady: boolean;
  phase: string;
  error: string;
  onBuy: () => void;
}) {
  const solana = useSolanaWallet();
  const subtotalLamports = count * tape.ticketLamports;
  const feeLamports = slipFeeLamports(tape.ticketLamports, count);
  const totalLamports = slipTotalLamports(tape.ticketLamports, count);
  return (
    <div className="glass-panel rounded-[28px] p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Dices size={18} className="text-[var(--orange)]" />
        <p className="kicker">Buy a slip</p>
      </div>
      <p className="display mt-3 text-5xl text-white">
        {formatAmount(tape.ticketPriceSol, 3)} <span className="text-2xl text-[var(--gold)]">SOL</span>
      </p>
      <p className="mt-1 text-xs tracking-[0.14em] uppercase text-[var(--dim)]">per slip · plus 1% kennel fee</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {PRESETS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setCount(n)}
            className={`chip ${count === n ? "border-[var(--orange)] text-white" : ""}`}
          >
            {n} {n === 1 ? "slip" : "slips"}
          </button>
        ))}
      </div>
      <p className="serif mt-5 text-xl text-[var(--cream)]">
        {count} × {formatAmount(tape.ticketPriceSol, 3)} = {formatAmount(subtotalLamports / 1_000_000_000, 4)} SOL
      </p>
      <p className="mt-1 text-sm text-[var(--gold)]">
        + 1% fee {formatAmount(feeLamports / 1_000_000_000, 4)} SOL · total {formatAmount(totalLamports / 1_000_000_000, 4)} SOL
      </p>
      {tape.split.winnerLamports > 0 ? (
        <p className="mt-2 text-sm text-[var(--gold)]">
          If the clock died now the winner takes {formatAmount(tape.split.winnerLamports / 1_000_000_000, 4)} SOL.{" "}
          {formatAmount(tape.split.carryLamports / 1_000_000_000, 4)} SOL stays for the next rock.
        </p>
      ) : null}
      <div className="mt-5">
        {solana.connected ? (
          <HouseButton variant="primary" className="w-full" disabled={!canBuy || Boolean(phase)} onClick={onBuy}>
            {phase || (canBuy ? `File ${count} ${count === 1 ? "slip" : "slips"}` : "Sales closed")}
          </HouseButton>
        ) : (
          <HouseButton variant="primary" className="w-full" onClick={solana.openModal}>
            Connect wallet
          </HouseButton>
        )}
      </div>
      {!potReady ? (
        <p className="mt-3 text-sm text-[var(--gold)]">Pot wallet is not posted. Slips stay closed.</p>
      ) : tape.status === "awaiting_round" ? (
        <p className="mt-3 text-sm text-[var(--gold)]">Open the next round to start selling slips.</p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-[#ff8a6a]">{error}</p> : null}
      {tape.pot ? (
        <a
          href={explorerAccountUrl(tape.pot)}
          target="_blank"
          rel="noreferrer"
          className="mt-4 block text-[11px] tracking-[0.14em] uppercase text-[var(--stone)] hover:text-[var(--orange)]"
        >
          Pot · {shortenAddress(tape.pot, 6)}
        </a>
      ) : null}
    </div>
  );
}

function PostedWinners({ tape }: { tape: LottoSnapshot }) {
  const rows = tape.posted.filter((row) => row.status === "settled" || row.status === "claimed");
  return (
    <div className="glass-panel mt-8 overflow-hidden rounded-[28px]">
      <div className="border-b border-[rgba(232,210,176,0.1)] px-5 py-5 sm:px-7">
        <div className="flex items-center gap-2">
          <Trophy size={18} className="text-[var(--orange)]" />
          <p className="kicker">Posted winners</p>
        </div>
        <p className="serif mt-2 text-lg text-[var(--cream)]">
          Every settled rock, the jackpot they took, and the 15% that stayed in the pot.
        </p>
      </div>
      {rows.length === 0 ? (
        <div className="px-5 py-8 sm:px-7">
          <p className="display text-4xl text-white">No winner posted yet.</p>
          <p className="mt-3 text-sm leading-6 text-[var(--dim)]">
            Round {String(tape.round + 1).padStart(2, "0")} is live. When it settles, the wallet, slip, 85% jackpot, and
            leftover seed land here. Anyone can re-check the math.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[rgba(232,210,176,0.08)]">
          {rows.map((row) => (
            <PostedWinRow key={row.round} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function PostedWinRow({ row }: { row: LottoPostedWin }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
      <div>
        <p className="text-[10px] tracking-[0.16em] uppercase text-[var(--gold)]">
          Round {String(row.round + 1).padStart(2, "0")} · {row.status}
          {row.verified ? " · proof checks" : ""}
        </p>
        {row.winner ? (
          <a
            href={explorerAccountUrl(row.winner)}
            target="_blank"
            rel="noreferrer"
            className="display mt-1 block text-3xl text-[var(--orange)] hover:text-white"
          >
            {shortenAddress(row.winner, 6)}
          </a>
        ) : (
          <p className="display mt-1 text-3xl text-[var(--dim)]">No winner</p>
        )}
        <p className="mt-1 text-sm text-[var(--dim)]">
          Slip {row.winnerIndex ?? "—"} · {formatCount(row.tickets)} slips
          {row.entropySlot ? ` · slot ${formatCount(row.entropySlot)}` : ""}
        </p>
      </div>
      <div className="text-left sm:text-right">
        <p className="display text-4xl text-white">{formatAmount(row.jackpotLamports / 1_000_000_000, 4)} SOL</p>
        <p className="mt-1 text-xs tracking-[0.14em] uppercase text-[var(--gold)]">
          jackpot 85%{row.payoutKnown ? "" : " · tickets only"}
        </p>
        <p className="mt-1 text-xs tracking-[0.14em] uppercase text-[var(--stone)]">
          seed left {formatAmount(row.carryLamports / 1_000_000_000, 4)} SOL
        </p>
        <a
          href={explorerAccountUrl(row.pot)}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-[11px] tracking-[0.14em] uppercase text-[var(--stone)] hover:text-[var(--orange)]"
        >
          Round account
        </a>
      </div>
    </div>
  );
}

function WalletBook({ tape, you }: { tape: LottoSnapshot; you: string }) {
  if (tape.wallets.length === 0) {
    return (
      <div className="glass-panel mt-8 rounded-[28px] p-6">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-[var(--orange)]" />
          <p className="kicker">Wallets this round</p>
        </div>
        <p className="serif mt-3 text-xl text-[var(--dim)]">No wallets have filed a slip yet.</p>
      </div>
    );
  }
  return (
    <div className="glass-panel mt-8 overflow-hidden rounded-[28px]">
      <div className="border-b border-[rgba(232,210,176,0.1)] px-5 py-4">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-[var(--orange)]" />
          <p className="kicker">
            Wallets this round · {formatCount(tape.wallets.length)} · {formatCount(tape.totalTickets)} slips
          </p>
        </div>
      </div>
      <div className="hidden border-b border-[rgba(232,210,176,0.08)] px-5 py-2 text-[10px] tracking-[0.16em] uppercase text-[var(--stone)] sm:grid sm:grid-cols-[minmax(0,1.4fr)_0.6fr_0.7fr_0.7fr_0.6fr] sm:gap-3">
        <span>Wallet</span>
        <span>Buys</span>
        <span>Slips</span>
        <span>SOL in</span>
        <span>Odds</span>
      </div>
      <div className="divide-y divide-[rgba(232,210,176,0.08)]">
        {tape.wallets.map((row) => (
          <a
            key={row.wallet}
            href={explorerAccountUrl(row.wallet)}
            target="_blank"
            rel="noreferrer"
            className={`grid gap-1 px-5 py-3 text-sm hover:bg-white/5 sm:grid-cols-[minmax(0,1.4fr)_0.6fr_0.7fr_0.7fr_0.6fr] sm:items-center sm:gap-3 ${
              you && row.wallet === you ? "text-[var(--orange)]" : "text-[var(--cream)]"
            }`}
          >
            <span className="font-mono">{shortenAddress(row.wallet, 6)}</span>
            <span className="text-xs tracking-[0.14em] uppercase text-[var(--gold)] sm:text-[var(--cream)]">
              {formatCount(row.buys)} {row.buys === 1 ? "buy" : "buys"}
            </span>
            <span>
              {formatCount(row.tickets)} · slips {row.ranges}
            </span>
            <span>{formatAmount(row.lamports / 1_000_000_000, 4)} SOL</span>
            <span>{(row.chance * 100).toFixed(2)}%</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function PurchaseLog({ tape, you }: { tape: LottoSnapshot; you: string }) {
  if (tape.entries.length === 0) {
    return (
      <div className="glass-panel mt-8 rounded-[28px] p-6">
        <p className="kicker">Every purchase</p>
        <p className="serif mt-3 text-xl text-[var(--dim)]">No slips this round. The rock is patient.</p>
      </div>
    );
  }
  const ordered = [...tape.entries].sort((a, b) => a.slot - b.slot);
  const totals = new Map<string, number>();
  return (
    <div className="glass-panel mt-8 overflow-hidden rounded-[28px]">
      <div className="border-b border-[rgba(232,210,176,0.1)] px-5 py-4">
        <p className="kicker">Every purchase · {formatCount(tape.entries.length)} buys on the book</p>
      </div>
      <div className="hidden border-b border-[rgba(232,210,176,0.08)] px-5 py-2 text-[10px] tracking-[0.16em] uppercase text-[var(--stone)] sm:grid sm:grid-cols-[0.7fr_minmax(0,1.3fr)_0.7fr_0.7fr_0.7fr] sm:gap-3">
        <span>Slips</span>
        <span>Wallet</span>
        <span>This buy</span>
        <span>SOL</span>
        <span>Wallet total</span>
      </div>
      <div className="divide-y divide-[rgba(232,210,176,0.08)]">
        {ordered.map((row) => {
          const running = (totals.get(row.wallet) ?? 0) + row.tickets;
          totals.set(row.wallet, running);
          const inner = (
            <>
              <span className="font-mono text-[var(--gold)]">{slipRange(row.slot, row.tickets)}</span>
              <span className="font-mono">{shortenAddress(row.wallet, 6)}</span>
              <span>
                {formatCount(row.tickets)} {row.tickets === 1 ? "slip" : "slips"}
              </span>
              <span>{formatAmount(row.lamports / 1_000_000_000, 4)} SOL</span>
              <span>
                {formatCount(running)} total
              </span>
            </>
          );
          const className = `grid grid-cols-1 gap-1 px-5 py-3 text-sm sm:grid-cols-[0.7fr_minmax(0,1.3fr)_0.7fr_0.7fr_0.7fr] sm:items-center sm:gap-3 ${
            you && row.wallet === you ? "text-[var(--orange)]" : "text-[var(--cream)]"
          }`;
          if (tape.engine === "program") {
            return (
              <div key={row.signature} className={className}>
                {inner}
              </div>
            );
          }
          return (
            <a key={row.signature} href={explorerTxUrl(row.signature)} target="_blank" rel="noreferrer" className={`${className} hover:bg-white/5`}>
              {inner}
            </a>
          );
        })}
      </div>
    </div>
  );
}

async function buyWithWallet(
  solana: ReturnType<typeof useSolanaWallet>,
  tape: LottoSnapshot,
  count: number,
  setPhase: (value: string) => void,
  setError: (value: string) => void,
  reload: () => Promise<void>,
) {
  const owner = solana.requireWallet();
  if (!owner) return;
  if (tape.status !== "open") {
    setError("Sales are closed for this round.");
    return;
  }
  try {
    setPhase("Ask the wallet…");
    const from = new PublicKey(owner);
    const pot = new PublicKey(tape.pot);
    const { blockhash, lastValidBlockHeight } = await solana.connection.getLatestBlockhash("confirmed");
    const fee = slipFeeLamports(tape.ticketLamports, count);
    const tx = new Transaction({ feePayer: from, blockhash, lastValidBlockHeight });
    tx.add(
      SystemProgram.transfer({
        fromPubkey: from,
        toPubkey: pot,
        lamports: count * tape.ticketLamports,
      }),
      new TransactionInstruction({
        keys: [{ pubkey: from, isSigner: true, isWritable: false }],
        programId: new PublicKey(MEMO_PROGRAM_ID),
        data: ixDataFromText(lottoMemo(tape.round, count)),
      }),
    );
    if (tape.feeWallet && fee > 0) {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: from,
          toPubkey: new PublicKey(tape.feeWallet),
          lamports: fee,
        }),
      );
    }
    const encoded = (await import("@/lib/tx")).encodeTx(tx);
    setPhase("Filing on Solana…");
    await solana.signAndSendBase64(encoded);
    setPhase("Slip filed");
    await reload();
    window.setTimeout(() => setPhase(""), 1600);
  } catch (error) {
    setPhase("");
    setError(error instanceof Error ? error.message : "The rock refused the slip.");
  }
}

async function sendProgramIx(
  solana: ReturnType<typeof useSolanaWallet>,
  build: (payer: PublicKey) => TransactionInstruction,
  setPhase: (value: string) => void,
  setError: (value: string) => void,
  reload: () => Promise<void>,
  asking: string,
  done: string,
) {
  const owner = solana.requireWallet();
  if (!owner) return;
  try {
    setPhase(asking);
    const from = new PublicKey(owner);
    const { blockhash, lastValidBlockHeight } = await solana.connection.getLatestBlockhash("confirmed");
    const tx = new Transaction({ feePayer: from, blockhash, lastValidBlockHeight });
    tx.add(build(from));
    const encoded = (await import("@/lib/tx")).encodeTx(tx);
    setPhase("Filing on Solana…");
    await solana.signAndSendBase64(encoded);
    setPhase(done);
    await reload();
    window.setTimeout(() => setPhase(""), 1600);
  } catch (error) {
    setPhase("");
    setError(error instanceof Error ? error.message : "The rock refused.");
  }
}

async function buyWithProgram(
  solana: ReturnType<typeof useSolanaWallet>,
  tape: LottoSnapshot,
  count: number,
  setPhase: (value: string) => void,
  setError: (value: string) => void,
  reload: () => Promise<void>,
) {
  if (tape.status !== "open") {
    setError("Sales are closed for this round.");
    return;
  }
  const tickets = Math.min(20, Math.max(1, count));
  if (!tape.feeWallet) {
    setError("Kennel fee wallet is not posted.");
    return;
  }
  await sendProgramIx(
    solana,
    (payer) => buyIxForRound(payer, tape.currentRound, tickets, new PublicKey(tape.feeWallet)),
    setPhase,
    setError,
    reload,
    "Ask the wallet…",
    "Slip filed",
  );
}

function CrankBar({
  tape,
  salesEnded,
  solana,
  phase,
  setPhase,
  setError,
  reload,
}: {
  tape: LottoSnapshot;
  salesEnded: boolean;
  solana: ReturnType<typeof useSolanaWallet>;
  phase: string;
  setPhase: (value: string) => void;
  setError: (value: string) => void;
  reload: () => Promise<void>;
}) {
  const busy = Boolean(phase);
  const canClose = tape.status === "open" && salesEnded;
  const canSettle = tape.status === "awaiting_block";
  const canClaim = tape.status === "drawn" && Boolean(tape.draw?.winner);
  const canOpen = tape.status === "awaiting_round" || tape.status === "claimed" || tape.status === "void";
  const run = (
    build: (payer: PublicKey) => TransactionInstruction,
    asking: string,
    done: string,
  ) => void sendProgramIx(solana, build, setPhase, setError, reload, asking, done);

  return (
    <div className="glass-panel mt-8 rounded-[28px] p-5 sm:p-6">
      <p className="kicker">Crank the program</p>
      <p className="mt-2 text-sm leading-6 text-[var(--dim)]">
        Anyone with a wallet can run these. Settle has a few minutes after the entropy slot before SlotHashes drops it.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <HouseButton disabled={!canClose || busy} onClick={() => run(() => closeSalesIx(tape.currentRound), "Closing sales…", "Sales closed")}>
          Close sales
        </HouseButton>
        <HouseButton disabled={!canSettle || busy} onClick={() => run(() => settleIx(tape.currentRound), "Settling…", "Draw settled")}>
          Settle draw
        </HouseButton>
        <HouseButton
          disabled={!canClaim || busy}
          onClick={() =>
            run((payer) => claimIx(tape.currentRound, new PublicKey(tape.draw?.winner || payer.toBase58())), "Paying winner…", "Pot claimed")
          }
        >
          Pay 85%
        </HouseButton>
        <HouseButton disabled={!canOpen || busy} onClick={() => run((payer) => openRoundIx(payer, tape.currentRound), "Opening round…", "Round open")}>
          Open next round
        </HouseButton>
      </div>
    </div>
  );
}
