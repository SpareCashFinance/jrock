"use client";

import { useMemo, useState } from "react";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { Dices, Trophy, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HouseButton } from "@/components/ui/house-button";
import { project } from "@/lib/config";
import { formatAmount, formatCount, shortenAddress } from "@/lib/format";
import { explorerAccountUrl, explorerTxUrl, links } from "@/lib/links";
import {
  DRAW_LAG_SECONDS,
  MEMO_PROGRAM_ID,
  hasLottoPot,
  lottoMemo,
  slipFeeLamports,
  slipPotLamports,
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
import { useCountdown, useLottoSnapshot, type RefreshLottoOpts } from "@/lib/lotto-client";

const PRESETS = [1, 2, 5, 10];
const PURCHASE_PAGE_SIZE = 20;

type SlipReceipt = {
  slips: number;
  paidSol: number;
  signature: string;
};

function ixDataFromText(value: string) {
  return new TextEncoder().encode(value) as unknown as Buffer;
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
  const { tape, reload } = useLottoSnapshot();
  const [count, setCount] = useState(1);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<SlipReceipt | null>(null);
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
            ? "Buy a slip in SOL. One price. 1% of that price is the kennel fee. The rest goes in the pot. The winner takes 85%. Fifteen percent stays to seed the next rock."
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
              ? buyWithProgram(solana, tape, count, setPhase, setError, reload, setReceipt)
              : buyWithWallet(solana, tape, count, setPhase, setError, reload, setReceipt))
          }
        />
      </div>
      <SlipReceiptDialog receipt={receipt} onClose={() => setReceipt(null)} />

      {tape.engine === "program" ? (
        <CrankBar
          tape={tape}
          salesEnded={clock.done}
          solana={solana}
          phase={phase}
          setPhase={setPhase}
          setError={setError}
          reload={reload}
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

function SlipReceiptDialog({
  receipt,
  onClose,
}: {
  receipt: SlipReceipt | null;
  onClose: () => void;
}) {
  const slips = receipt?.slips ?? 0;
  return (
    <Dialog open={Boolean(receipt)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        showCloseButton
        className="glass-panel max-w-md gap-4 border border-[rgba(232,210,176,0.16)] bg-[#0c1320] p-6 text-[var(--cream)] sm:max-w-md sm:p-8"
      >
        <DialogHeader className="gap-3">
          <p className="kicker">Slip filed</p>
          <DialogTitle className="display text-4xl leading-none text-white sm:text-5xl">Congratulations.</DialogTitle>
          <DialogDescription className="serif text-lg text-[var(--cream)] sm:text-xl">
            Your purchase is confirmed for {formatCount(slips)} {slips === 1 ? "slip" : "slips"}.
          </DialogDescription>
        </DialogHeader>
        {receipt ? (
          <p className="display text-3xl text-[var(--gold)]">{formatAmount(receipt.paidSol, 4)} SOL</p>
        ) : null}
        {receipt?.signature ? (
          <a
            href={explorerTxUrl(receipt.signature)}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-[var(--gold)] hover:text-[var(--orange)]"
          >
            See the filing on Solscan · {shortenAddress(receipt.signature, 4)}
          </a>
        ) : null}
        <HouseButton variant="primary" className="w-full" onClick={onClose}>
          Back to the kennel
        </HouseButton>
      </DialogContent>
    </Dialog>
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
  const [local, setLocal] = useState("");
  const [server, setServer] = useState("");
  const program = tape.engine === "program";
  const slipPrice = formatAmount(tape.ticketPriceSol, 3) ?? "0.05";
  const steps = program
    ? [
        `Buy 1 to 20 slips at a time. You pay ${slipPrice} SOL each. 1% is a kennel fee. The rest goes in the pot.`,
        "A buy only counts while this round is still open.",
        "Every slip gets a number, in the order it was bought. Buy again and your numbers continue.",
        "When time is up, Solana locks a future block. Nobody can swap that pick after the fact.",
        "That block is hashed. The leftover number picks one slip. That wallet wins.",
        "Winner takes 85% of the pot. 15% stays to seed the next round. Anyone can press the finish buttons.",
      ]
    : [
        "Send the slip price to the pot. 1% is a kennel fee. The rest is your ticket.",
        "Only buys during this round count.",
        "Slips are numbered in the order they land on Solana.",
        `When the clock hits zero we wait ${DRAW_LAG_SECONDS} seconds, then the next Solana block is the draw.`,
        "That block is hashed. The leftover number picks one slip. That wallet wins.",
        "The pick is public. The kennel still has to send the pot.",
      ];

  async function checkHere() {
    if (!tape.draw) {
      setLocal(
        program
          ? "No winner yet. Sales have to close, then someone hits Settle after Solana posts the draw block."
          : "No winner yet. The clock has to finish, then we wait one extra minute for a Solana block.",
      );
      return;
    }
    if (program) {
      const math = await winnerIndexFromSlotHash(tape.draw.blockhash, tape.round, tape.slips.length);
      const ok = await verifyProgramDraw(tape.draw, tape.slips, tape.round);
      setLocal(
        ok
          ? `It checks. Slip ${math.index} is the winner.`
          : `It does not match. This page got slip ${math.index}. The tape says ${tape.draw.winnerIndex}. Do not trust this draw.`,
      );
      return;
    }
    const math = await winnerIndexFromBlockhash(tape.draw.blockhash, tape.slips.length);
    const ok = await verifyDraw(tape.draw, tape.slips);
    setLocal(
      ok
        ? `It checks. Slip ${math.index} is the winner.`
        : `It does not match. This page got slip ${math.index}. The tape says ${tape.draw.winnerIndex}. Do not trust this draw.`,
    );
  }

  async function checkServer() {
    const res = await fetch("/api/lotto/verify", { cache: "no-store" });
    const next = (await res.json()) as { ok?: boolean; error?: string };
    setServer(next.ok ? "Solana agrees with this page." : next.error || "Solana did not match this page.");
  }

  return (
    <div className="glass-panel rounded-[28px] p-5 sm:p-7">
      <p className="kicker">Fair draw · the rock does not pick</p>
      <h2 className="display mt-2 text-4xl text-white sm:text-5xl">How a winner happens.</h2>
      <ol className="serif mt-5 space-y-3 text-lg text-[var(--cream)]">
        {steps.map((step, index) => (
          <li key={step}>
            <span className="mr-2 font-sans text-sm tracking-[0.14em] uppercase text-[var(--gold)]">
              {String(index + 1).padStart(2, "0")}
            </span>
            {step}
          </li>
        ))}
      </ol>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[rgba(232,210,176,0.12)] bg-[#080d16] px-4 py-3">
          <p className="text-[10px] tracking-[0.16em] uppercase text-[var(--gold)]">You pay</p>
          <p className="display mt-1 text-2xl text-white">{slipPrice} SOL</p>
          <p className="mt-1 text-xs text-[var(--dim)]">1% kennel fee is inside that price</p>
        </div>
        <div className="rounded-2xl border border-[rgba(232,210,176,0.12)] bg-[#080d16] px-4 py-3">
          <p className="text-[10px] tracking-[0.16em] uppercase text-[var(--gold)]">Winner</p>
          <p className="display mt-1 text-2xl text-white">85%</p>
          <p className="mt-1 text-xs text-[var(--dim)]">Paid on-chain to one slip</p>
        </div>
        <div className="rounded-2xl border border-[rgba(232,210,176,0.12)] bg-[#080d16] px-4 py-3">
          <p className="text-[10px] tracking-[0.16em] uppercase text-[var(--gold)]">Next round</p>
          <p className="display mt-1 text-2xl text-white">15%</p>
          <p className="mt-1 text-xs text-[var(--dim)]">Stays in the pot as seed</p>
        </div>
      </div>
      <p className="mt-5 text-sm leading-6 text-[var(--dim)]">
        You can check the pot and the math yourself. If the posted winner is not the slip the block picks, the tape is
        lying. {project.ticker} is entertainment and can go to zero.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <HouseButton onClick={() => void checkHere()}>Check this draw</HouseButton>
        <HouseButton onClick={() => void checkServer()}>Ask Solana again</HouseButton>
        {tape.pot ? (
          <HouseButton href={explorerAccountUrl(tape.pot)} target="_blank">
            See the pot
          </HouseButton>
        ) : null}
        {tape.proof.slot ? (
          <HouseButton href={`https://solscan.io/block/${tape.proof.slot}`} target="_blank">
            See the draw block
          </HouseButton>
        ) : null}
      </div>
      {local ? <p className="mt-3 text-sm text-[var(--gold)]">{local}</p> : null}
      {server ? <p className="mt-2 text-sm text-[var(--gold)]">{server}</p> : null}
      <details className="mt-5">
        <summary className="cursor-pointer text-[11px] tracking-[0.16em] uppercase text-[var(--stone)] hover:text-[var(--gold)]">
          Nerd receipts
        </summary>
        <div className="mt-3 space-y-2 text-xs leading-6 text-[var(--dim)]">
          <p>
            {program
              ? "On-chain program draw. The round account holds the pot. After settle, hash the slot hash with the round id and slip count."
              : "Wallet-pot draw. Match every slip on Solscan, then hash the draw block."}
          </p>
          <p className="break-all font-mono text-[11px] text-[var(--stone)]">
            {tape.proof.version} · book {tape.proof.bookHash || "empty"} · slips {tape.proof.ticketCount} · entropy{" "}
            {tape.proof.entropyAfter}
          </p>
          {tape.programId ? (
            <HouseButton href={explorerAccountUrl(tape.programId)} target="_blank" className="mt-2 px-3 text-xs">
              Open the program
            </HouseButton>
          ) : null}
        </div>
      </details>
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
      <p className="mt-1 text-xs tracking-[0.14em] uppercase text-[var(--dim)]">per slip · 1% kennel fee inside the price</p>
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
        {formatAmount((subtotalLamports - feeLamports) / 1_000_000_000, 4)} SOL in the pot · 1% fee{" "}
        {formatAmount(feeLamports / 1_000_000_000, 4)} SOL · you pay {formatAmount(totalLamports / 1_000_000_000, 4)} SOL
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
  const [page, setPage] = useState(0);
  const newestFirst = useMemo(() => {
    const chronological = [...tape.entries].sort((a, b) => a.slot - b.slot || a.signature.localeCompare(b.signature));
    const running = new Map<string, number>();
    const totals = new Map<string, number>();
    for (const row of chronological) {
      const next = (running.get(row.wallet) ?? 0) + row.tickets;
      running.set(row.wallet, next);
      totals.set(row.signature, next);
    }
    return chronological
      .slice()
      .reverse()
      .map((row) => ({ row, walletTotal: totals.get(row.signature) ?? row.tickets }));
  }, [tape.entries]);

  if (tape.entries.length === 0) {
    return (
      <div className="glass-panel mt-8 rounded-[28px] p-6">
        <p className="kicker">Every purchase</p>
        <p className="serif mt-3 text-xl text-[var(--dim)]">No slips this round. The rock is patient.</p>
      </div>
    );
  }

  const pages = Math.max(1, Math.ceil(newestFirst.length / PURCHASE_PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const visible = newestFirst.slice(current * PURCHASE_PAGE_SIZE, current * PURCHASE_PAGE_SIZE + PURCHASE_PAGE_SIZE);
  const from = current * PURCHASE_PAGE_SIZE + 1;
  const to = current * PURCHASE_PAGE_SIZE + visible.length;

  return (
    <div className="glass-panel mt-8 overflow-hidden rounded-[28px]">
      <div className="border-b border-[rgba(232,210,176,0.1)] px-5 py-4">
        <p className="kicker">
          Latest buys · {from}–{to} of {formatCount(tape.entries.length)}
        </p>
      </div>
      <div className="hidden border-b border-[rgba(232,210,176,0.08)] px-5 py-2 text-[10px] tracking-[0.16em] uppercase text-[var(--stone)] sm:grid sm:grid-cols-[0.7fr_minmax(0,1.3fr)_0.7fr_0.7fr_0.7fr] sm:gap-3">
        <span>Slips</span>
        <span>Wallet</span>
        <span>This buy</span>
        <span>SOL</span>
        <span>Wallet total</span>
      </div>
      <div className="divide-y divide-[rgba(232,210,176,0.08)]">
        {visible.map(({ row, walletTotal }) => {
          const inner = (
            <>
              <span className="font-mono text-[var(--gold)]">{slipRange(row.slot, row.tickets)}</span>
              <span className="font-mono">{shortenAddress(row.wallet, 6)}</span>
              <span>
                {formatCount(row.tickets)} {row.tickets === 1 ? "slip" : "slips"}
              </span>
              <span>{formatAmount(row.lamports / 1_000_000_000, 4)} SOL</span>
              <span>
                {formatCount(walletTotal)} total
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
      {pages > 1 ? (
        <div className="flex items-center justify-between gap-3 border-t border-[rgba(232,210,176,0.1)] px-5 py-3">
          <HouseButton
            className="px-3 text-xs disabled:opacity-40"
            disabled={current <= 0}
            onClick={() => setPage(Math.max(0, current - 1))}
          >
            Newer
          </HouseButton>
          <p className="text-[11px] tracking-[0.16em] uppercase text-[var(--gold)]">
            Page {current + 1} / {pages}
          </p>
          <HouseButton
            className="px-3 text-xs disabled:opacity-40"
            disabled={current >= pages - 1}
            onClick={() => setPage(Math.min(pages - 1, current + 1))}
          >
            Older
          </HouseButton>
        </div>
      ) : null}
    </div>
  );
}

async function buyWithWallet(
  solana: ReturnType<typeof useSolanaWallet>,
  tape: LottoSnapshot,
  count: number,
  setPhase: (value: string) => void,
  setError: (value: string) => void,
  reload: (opts?: RefreshLottoOpts) => Promise<unknown>,
  onConfirmed: (receipt: SlipReceipt) => void,
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
        lamports: slipPotLamports(tape.ticketLamports, count),
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
    setError("");
    const signature = await solana.signAndSendBase64(encoded);
    setPhase("");
    onConfirmed({
      slips: count,
      paidSol: slipTotalLamports(tape.ticketLamports, count) / 1_000_000_000,
      signature,
    });
    await reload({ fresh: true, minTickets: tape.totalTickets + count });
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
  reload: (opts?: RefreshLottoOpts) => Promise<unknown>,
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
    await reload({ fresh: true });
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
  reload: (opts?: RefreshLottoOpts) => Promise<unknown>,
  onConfirmed: (receipt: SlipReceipt) => void,
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
  const owner = solana.requireWallet();
  if (!owner) return;
  try {
    setPhase("Ask the wallet…");
    setError("");
    const from = new PublicKey(owner);
    const { blockhash, lastValidBlockHeight } = await solana.connection.getLatestBlockhash("confirmed");
    const tx = new Transaction({ feePayer: from, blockhash, lastValidBlockHeight });
    tx.add(buyIxForRound(from, tape.currentRound, tickets, new PublicKey(tape.feeWallet)));
    const encoded = (await import("@/lib/tx")).encodeTx(tx);
    setPhase("Filing on Solana…");
    const signature = await solana.signAndSendBase64(encoded);
    setPhase("");
    onConfirmed({
      slips: tickets,
      paidSol: slipTotalLamports(tape.ticketLamports, tickets) / 1_000_000_000,
      signature,
    });
    await reload({ fresh: true, minTickets: tape.totalTickets + tickets });
  } catch (error) {
    setPhase("");
    setError(error instanceof Error ? error.message : "The rock refused the slip.");
  }
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
  reload: (opts?: RefreshLottoOpts) => Promise<unknown>;
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
