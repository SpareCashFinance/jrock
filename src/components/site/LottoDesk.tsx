"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  hasLottoPot,
  lottoMemo,
  slipFeeLamports,
  slipPotLamports,
  slipTotalLamports,
  verifyDraw,
  winnerIndexFromBlockhash,
  slipRange,
  type LottoPostedWin,
  type LottoSnapshot,
} from "@/lib/lotto";
import { buyIxForRound, claimIx, closeSalesIx, isLottoV2, openRoundIx, settleIx } from "@/lib/lotto-program";
import {
  buyIxV2,
  claimIxV2,
  closeSalesIxV2,
  fulfillRandomnessIxV2,
  openRoundIxV2,
  oraoNetworkStatePda,
  oraoRequestPda,
  oraoTreasuryFromNetworkState,
  refundOneIxV2,
  requestRandomnessIxV2,
  settleIxV2,
} from "@/lib/lotto-program-v2";
import { vrfSeedBytes } from "@/lib/lotto-vrf";
import { useSolanaWallet } from "@/components/solana/SolanaWalletProvider";
import { TelegramMark, XMark } from "@/components/brand/SocialMarks";
import { LottoMachine } from "@/components/site/LottoMachine";
import { useCountdown, useLottoSnapshot, type RefreshLottoOpts } from "@/lib/lotto-client";
import { drawPhaseLabel, nextCrankStep, salesHaveEnded } from "@/lib/lotto-crank-plan";

const PRESETS = [1, 2, 5, 10, 20];
const PURCHASE_PAGE_SIZE = 20;

type SlipReceipt = {
  slips: number;
  paidSol: number;
  signature: string;
};

function ixDataFromText(value: string) {
  return new TextEncoder().encode(value) as unknown as Buffer;
}

function ClockBox({ label, value, ready }: { label: string; value: number; ready: boolean }) {
  return (
    <div className="glass-panel min-w-[4.5rem] rounded-2xl px-3 py-3 text-center">
      <p className="display text-4xl text-white sm:text-5xl" suppressHydrationWarning>
        {ready ? String(value).padStart(2, "0") : "—"}
      </p>
      <p className="mt-1 text-[10px] tracking-[0.16em] uppercase text-[var(--gold)]">{label}</p>
    </div>
  );
}

export function LottoDesk({ initial }: { initial?: LottoSnapshot }) {
  const solana = useSolanaWallet();
  const { tape, reload } = useLottoSnapshot(initial);
  const [count, setCount] = useState(1);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<SlipReceipt | null>(null);
  const clock = useCountdown(tape.endsAt);
  const ended = clock.done || salesHaveEnded(tape);
  const potReady = tape.pot.length >= 32 && (tape.engine === "program" || hasLottoPot());
  const canBuy = potReady && tape.status === "open" && !ended;
  const [slot, setSlot] = useState<number | null>(null);
  const autoKey = useRef("");
  const crankStep = nextCrankStep(tape, { nowMs: Date.now(), slot });
  const phaseTitle = drawPhaseLabel(tape, ended);
  const yours = useMemo(
    () =>
      solana.address
        ? tape.entries.filter((row) => row.wallet === solana.address).reduce((sum, row) => sum + row.tickets, 0)
        : 0,
    [solana.address, tape.entries],
  );
  const solePlayer = tape.wallets.length === 1 ? tape.wallets[0] : null;

  useEffect(() => {
    if (tape.engine !== "program") return;
    let live = true;
    const tick = async () => {
      try {
        const next = await solana.connection.getSlot("confirmed");
        if (live) setSlot(next);
      } catch {
        /* tape still works without a live slot */
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 4_000);
    return () => {
      live = false;
      window.clearInterval(id);
    };
  }, [solana.connection, tape.engine, tape.status]);

  useEffect(() => {
    if (tape.engine !== "program" || !solana.connected || phase || !ended) return;
    if (crankStep.kind === "idle" || crankStep.kind === "wait") return;
    if (crankStep.kind === "request_vrf" || crankStep.kind === "store_vrf") return;
    const key = `${tape.round}:${tape.status}:${crankStep.kind}`;
    if (autoKey.current === key) return;
    autoKey.current = key;
    const v2 = isLottoV2(tape.programId);
    const round = tape.currentRound;
    if (crankStep.kind === "close") {
      void sendProgramIx(solana, () => (v2 ? closeSalesIxV2(round) : closeSalesIx(round)), setPhase, setError, reload, "Closing sales…", "Sales closed");
      return;
    }
    if (crankStep.kind === "settle") {
      if (v2 && !tape.vrfRequest) return;
      void sendProgramIx(
        solana,
        () => (v2 ? settleIxV2(round, new PublicKey(tape.vrfRequest || "")) : settleIx(round)),
        setPhase,
        setError,
        reload,
        "Settling…",
        "Draw settled",
      );
      return;
    }
    if (crankStep.kind === "claim") {
      void sendProgramIx(
        solana,
        (payer) =>
          v2
            ? claimIxV2(round, new PublicKey(crankStep.winner || payer.toBase58()))
            : claimIx(round, new PublicKey(crankStep.winner || payer.toBase58())),
        setPhase,
        setError,
        reload,
        "Paying winner…",
        "Pot claimed",
      );
      return;
    }
    if (crankStep.kind === "open") {
      void sendProgramIx(
        solana,
        (payer) => (v2 ? openRoundIxV2(payer, round) : openRoundIx(payer, round)),
        setPhase,
        setError,
        reload,
        "Opening round…",
        "Round open",
      );
    }
  }, [crankStep, ended, phase, reload, solana, tape.currentRound, tape.engine, tape.programId, tape.round, tape.status, tape.vrfRequest]);

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
                <h2 className="display mt-2 text-5xl text-white">{phaseTitle}</h2>
              </div>
              <p className="text-xs tracking-[0.16em] uppercase text-[var(--gold)]">
                {ended && tape.status === "open" ? "sales ended" : tape.status.replaceAll("_", " ")}
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <ClockBox label="Days" value={clock.days} ready={clock.ready} />
              <ClockBox label="Hours" value={clock.hours} ready={clock.ready} />
              <ClockBox label="Minutes" value={clock.minutes} ready={clock.ready} />
              <ClockBox label="Seconds" value={clock.seconds} ready={clock.ready} />
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Prize pool"
                value={`${formatAmount((tape.engine === "program" ? tape.split.claimableLamports : tape.roundLamports) / 1_000_000_000, 4) ?? "0"} SOL`}
              />
              <Stat label="Winner 85%" value={`${formatAmount(tape.split.winnerLamports / 1_000_000_000, 4) ?? "0"} SOL`} />
              <Stat label="Next seed 15%" value={`${formatAmount(tape.split.carryLamports / 1_000_000_000, 4) ?? "0"} SOL`} />
              <Stat label="Your slips" value={formatCount(yours) ?? "0"} />
            </div>
            <p className="mt-3 text-xs tracking-[0.14em] uppercase text-[var(--gold)]">
              {formatCount(tape.totalTickets) ?? "0"} slips sold
              {tape.split.rentLamports > 0
                ? ` · account holds ${formatAmount(tape.potSol, 4)} SOL including ${formatAmount(tape.split.rentLamports / 1_000_000_000, 4)} SOL rent, which is not prize money`
                : ""}
              {tape.split.seedLamports > 0
                ? ` · ${formatAmount(tape.split.seedLamports / 1_000_000_000, 4)} SOL rolled in from last round`
                : ""}
            </p>
            <p className="serif mt-5 text-lg text-[var(--cream)]">{tape.message}</p>
          </div>

          {tape.draw ? (
            <WinnerCard title="This rock picked" draw={tape.draw} jackpotLamports={tape.split.winnerLamports} />
          ) : null}
          {tape.last && !tape.draw ? (
            <WinnerCard title="Last rock picked" draw={tape.last} jackpotLamports={tape.split.winnerLamports} />
          ) : null}
          {!tape.draw && !tape.last && solePlayer && ended ? (
            <SolePlayerCard player={solePlayer} jackpotLamports={tape.split.winnerLamports} />
          ) : null}
          <ChainStatusCard tape={tape} />
          <ProofCard tape={tape} />
        </div>

        <div className="space-y-5">
          <BuyCard
            tape={tape}
            count={count}
            setCount={setCount}
            canBuy={canBuy}
            potReady={potReady}
            phase={phase}
            error={error}
            crankLabel={crankStep.kind === "idle" || crankStep.kind === "wait" ? "" : crankStep.label}
            crankHint={ended || tape.status !== "open" ? crankStep.reason : ""}
            onBuy={() =>
              void (tape.engine === "program"
                ? buyWithProgram(solana, tape, count, setPhase, setError, reload, setReceipt)
                : buyWithWallet(solana, tape, count, setPhase, setError, reload, setReceipt))
            }
            onFinish={
              tape.engine === "program" && crankStep.kind !== "idle" && crankStep.kind !== "wait"
                ? () => {
                    const v2 = isLottoV2(tape.programId);
                    const round = tape.currentRound;
                    if (crankStep.kind === "close") {
                      void sendProgramIx(solana, () => (v2 ? closeSalesIxV2(round) : closeSalesIx(round)), setPhase, setError, reload, "Closing sales…", "Sales closed");
                    } else if (crankStep.kind === "settle") {
                      void sendProgramIx(solana, () => settleIx(round), setPhase, setError, reload, "Settling…", "Draw settled");
                    } else if (crankStep.kind === "claim") {
                      void sendProgramIx(
                        solana,
                        (payer) =>
                          v2
                            ? claimIxV2(round, new PublicKey(crankStep.winner || payer.toBase58()))
                            : claimIx(round, new PublicKey(crankStep.winner || payer.toBase58())),
                        setPhase,
                        setError,
                        reload,
                        "Paying winner…",
                        "Pot claimed",
                      );
                    } else if (crankStep.kind === "open") {
                      void sendProgramIx(
                        solana,
                        (payer) => (v2 ? openRoundIxV2(payer, round) : openRoundIx(payer, round)),
                        setPhase,
                        setError,
                        reload,
                        "Opening round…",
                        "Round open",
                      );
                    }
                  }
                : undefined
            }
          />
          <LottoMachine />
        </div>
      </div>
      <SlipReceiptDialog receipt={receipt} onClose={() => setReceipt(null)} />

      {tape.engine === "program" ? (
        <CrankBar
          tape={tape}
          salesEnded={ended}
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
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!receipt || !mounted) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [receipt, mounted, onClose]);

  if (!mounted || !receipt) return null;
  const slips = receipt.slips;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        id="lotto-slip-receipt"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lotto-slip-receipt-title"
        className="relative w-full max-w-md rounded-[28px] border border-[rgba(232,210,176,0.16)] bg-[#0c1320] p-6 text-[var(--cream)] shadow-[0_24px_80px_rgba(0,0,0,0.55)] sm:p-8"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="kicker">Slip filed</p>
        <h2 id="lotto-slip-receipt-title" className="display mt-2 text-4xl leading-none text-white sm:text-5xl">
          Congratulations.
        </h2>
        <p className="serif mt-3 text-lg text-[var(--cream)] sm:text-xl">
          Your purchase is confirmed for {formatCount(slips)} {slips === 1 ? "slip" : "slips"}.
        </p>
        <p className="display mt-4 text-3xl text-[var(--gold)]">{formatAmount(receipt.paidSol, 4)} SOL</p>
        {receipt.signature ? (
          <a
            href={explorerTxUrl(receipt.signature)}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-sm text-[var(--gold)] hover:text-[var(--orange)]"
          >
            See the filing on Solscan · {shortenAddress(receipt.signature, 4)}
          </a>
        ) : null}
        <HouseButton variant="primary" className="mt-6 w-full" onClick={onClose}>
          Back to the kennel
        </HouseButton>
      </div>
    </div>,
    document.body,
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

function ChainStatusCard({ tape }: { tape: LottoSnapshot }) {
  const program = tape.engine === "program" && tape.programId;
  const v2 = isLottoV2(tape.programId);
  const rows = [
    ["Network", "Solana mainnet-beta"],
    ["Program", tape.programId || "Not posted"],
    ["This round", tape.pot || "Not open"],
    ["Build", tape.verifiedBuild ? "Explorer-verified." : "Source is public. Explorer verification is not filed yet."],
    ["Upgrade", tape.upgradeable === false ? "Immutable." : "Upgradeable. Authority is a single kennel wallet."],
    ["Randomness", v2 ? "ORAO VRF Classic. One bound request after close. Rejection sampling." : "Solana SlotHashes after close. Interim. Not a VRF."],
    ...(v2
      ? ([
          ["VRF provider", tape.randomnessProvider || "ORAO VRF Classic"],
          ["VRF request", tape.vrfRequest || "Not requested yet"],
        ] as const)
      : []),
  ] as const;
  return (
    <div className="glass-panel rounded-[28px] p-5 sm:p-7">
      <p className="kicker">On-chain status</p>
      <h2 className="display mt-2 text-4xl text-white sm:text-5xl">What is actually live.</h2>
      <dl className="mt-5 space-y-3 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:items-baseline">
            <dt className="text-[10px] tracking-[0.16em] uppercase text-[var(--gold)]">{label}</dt>
            <dd className="break-all font-mono text-[12px] text-[var(--cream)]">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        {program ? (
          <HouseButton href={explorerAccountUrl(tape.programId)} target="_blank">
            Program
          </HouseButton>
        ) : null}
        {tape.pot ? (
          <HouseButton href={explorerAccountUrl(tape.pot)} target="_blank">
            Round account
          </HouseButton>
        ) : null}
        {tape.configPda ? (
          <HouseButton href={explorerAccountUrl(tape.configPda)} target="_blank">
            Config
          </HouseButton>
        ) : null}
        <HouseButton href="/lotto/verify" className="px-3 text-xs">
          Independent check
        </HouseButton>
      </div>
    </div>
  );
}

function SolePlayerCard({
  player,
  jackpotLamports,
}: {
  player: LottoSnapshot["wallets"][number];
  jackpotLamports: number;
}) {
  return (
    <div className="glass-panel rounded-[28px] p-5 sm:p-7">
      <p className="kicker">Only player in the book</p>
      <p className="display mt-2 text-4xl text-[var(--orange)]">{shortenAddress(player.wallet, 6)}</p>
      {jackpotLamports > 0 ? (
        <p className="display mt-2 text-3xl text-white">{formatAmount(jackpotLamports / 1_000_000_000, 4)} SOL</p>
      ) : null}
      <p className="mt-2 text-sm leading-6 text-[var(--dim)]">
        This wallet bought every slip ({formatCount(player.tickets)}). The official winner is written on-chain after
        settle. Connect a wallet to finish close → settle → pay → open the next round.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <HouseButton href={explorerAccountUrl(player.wallet)} target="_blank">
          Player
        </HouseButton>
      </div>
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
        Slip {draw.winnerIndex}
        {draw.slot ? ` · slot ${formatCount(draw.slot)}` : ""} · {draw.verified ? "proof checks" : "proof failed"}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <HouseButton href={explorerAccountUrl(draw.winner)} target="_blank">
          Winner
        </HouseButton>
        {draw.slot ? (
          <HouseButton href={`https://solscan.io/block/${draw.slot}`} target="_blank">
            Block {draw.slot}
          </HouseButton>
        ) : null}
        {draw.winningSignature ? (
          <HouseButton href={explorerTxUrl(draw.winningSignature)} target="_blank">
            Winning slip
          </HouseButton>
        ) : null}
      </div>
      <p className="mt-4 break-all font-mono text-[11px] text-[var(--stone)]">
        {draw.slot ? "slot hash" : draw.blockhash.length === 64 ? "VRF output" : "blockhash"} {draw.blockhash}
      </p>
      <p className="mt-1 break-all font-mono text-[11px] text-[var(--stone)]">sha256 {draw.hash}</p>
    </div>
  );
}

function ProofCard({ tape }: { tape: LottoSnapshot }) {
  const [local, setLocal] = useState("");
  const program = tape.engine === "program";
  const v2 = isLottoV2(tape.programId);
  const slipPrice = formatAmount(tape.ticketPriceSol, 3) ?? "0.05";
  const steps = program
    ? v2
      ? [
          `Buy 1 to 20 slips at a time. You pay ${slipPrice} SOL each. 1% is a kennel fee. The rest goes in the pot.`,
          "A buy only counts while this round is still open.",
          "Every slip gets a number, in the order it was bought, from 0 up. Buy again and your numbers continue.",
          "When time is up, anyone can close sales, then request one ORAO VRF job seeded with this program, this round, and the slip count. A second request is rejected.",
          "Settle maps the stored 256-bit VRF output into 0..tickets-1 with rejection sampling. If ORAO does not fulfill before the timeout, anyone can refund 99% per slip.",
          "Winner takes 85% of the prize pool after rent. 15% stays to seed the next round. Anyone can press the finish buttons.",
        ]
      : [
          `Buy 1 to 20 slips at a time. You pay ${slipPrice} SOL each. 1% is a kennel fee. The rest goes in the pot.`,
          "A buy only counts while this round is still open.",
          "Every slip gets a number, in the order it was bought, from 0 up. Buy again and your numbers continue.",
          "When time is up, anyone can close sales. The program then locks one future Solana slot (clock.slot + lag). That pick cannot be swapped for a different slot later.",
          "Settle hashes that SlotHashes entry with the round id and slip count, then takes the remainder into 0..tickets-1. This is not a VRF. If SlotHashes expires, settle can fail until a later upgrade.",
          "Winner takes 85% of the prize pool after rent. 15% stays to seed the next round. Anyone can press the finish buttons.",
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
    if (program) {
      try {
        const params = new URLSearchParams();
        if (tape.currentRound != null) params.set("round", String(tape.currentRound));
        if (tape.pot) params.set("pda", tape.pot);
        const response = await fetch(`/api/lotto/independent?${params}`, { cache: "no-store" });
        const independent = (await response.json()) as Awaited<
          ReturnType<(typeof import("@/lib/lotto-verify"))["verifyRoundIndependent"]>
        > & { error?: string };
        if (!response.ok) throw new Error(independent.error || "Public Solana RPC did not answer.");
        if (independent.matches == null) {
          setLocal(
            `Solana shows round ${independent.roundId} ${independent.status}, ${independent.totalTickets} slips, prize pool ${independent.ledger.distributablePotLamports / 1_000_000_000} SOL. No settled winner to recompute yet.`,
          );
          return;
        }
        setLocal(
          independent.matches
            ? `Independent RPC check: slip ${independent.computedWinnerIndex} matches the round account.`
            : `Independent RPC check failed. Chain has slip ${independent.storedWinnerIndex}. This page recomputed ${independent.computedWinnerIndex}. Do not trust this draw.`,
        );
      } catch (err) {
        setLocal(err instanceof Error ? err.message : "Public Solana RPC did not answer.");
      }
      return;
    }
    if (!tape.draw) {
      setLocal("No winner yet. The clock has to finish, then we wait one extra minute for a Solana block.");
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

  return (
    <div className="glass-panel rounded-[28px] p-5 sm:p-7">
      <p className="kicker">Disclosed draw · the rock does not pick</p>
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
        <HouseButton href="/lotto/verify">Independent page</HouseButton>
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
      <details className="mt-5">
        <summary className="cursor-pointer text-[11px] tracking-[0.16em] uppercase text-[var(--stone)] hover:text-[var(--gold)]">
          Nerd receipts
        </summary>
        <div className="mt-3 space-y-2 text-xs leading-6 text-[var(--dim)]">
          <p>
            {program
              ? v2
                ? "On-chain program draw. ORAO VRF Classic, one bound request after close, rejection sampling into 0..tickets-1. Timeout refunds 99% per slip."
                : "On-chain program draw. INTERIM SlotHashes after close, not a VRF. After settle, hash the slot hash with the round id and slip count. Range is 0..tickets-1."
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
  onFinish,
  crankLabel,
  crankHint,
}: {
  tape: LottoSnapshot;
  count: number;
  setCount: (n: number) => void;
  canBuy: boolean;
  potReady: boolean;
  phase: string;
  error: string;
  onBuy: () => void;
  onFinish?: () => void;
  crankLabel?: string;
  crankHint?: string;
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
          canBuy ? (
            <HouseButton variant="primary" className="w-full" disabled={Boolean(phase)} onClick={onBuy}>
              {phase || `File ${count} ${count === 1 ? "slip" : "slips"}`}
            </HouseButton>
          ) : onFinish && crankLabel ? (
            <HouseButton variant="primary" className="w-full" disabled={Boolean(phase)} onClick={onFinish}>
              {phase || crankLabel}
            </HouseButton>
          ) : (
            <HouseButton variant="primary" className="w-full" disabled>
              {phase || "Sales closed"}
            </HouseButton>
          )
        ) : (
          <HouseButton variant="primary" className="w-full" onClick={solana.openModal}>
            {onFinish && crankLabel ? "Connect to finish this draw" : "Connect wallet"}
          </HouseButton>
        )}
      </div>
      {crankHint && !canBuy ? <p className="mt-3 text-sm text-[var(--gold)]">{crankHint}</p> : null}
      {!potReady ? (
        <p className="mt-3 text-sm text-[var(--gold)]">Pot wallet is not posted. Slips stay closed.</p>
      ) : tape.status === "awaiting_round" || tape.status === "refunded" ? (
        <p className="mt-3 text-sm text-[var(--gold)]">Open the next round to start selling slips.</p>
      ) : tape.status === "refunding" ? (
        <p className="mt-3 text-sm text-[var(--gold)]">VRF timed out. Refund unpaid buyers, then open the next round.</p>
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
  const rows = tape.posted.filter(
    (row) => row.status === "settled" || row.status === "claimed" || row.status === "refunded",
  );
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
            Round {String(tape.round + 1).padStart(2, "0")} has not settled on-chain. Finish close → settle → pay, and
            the wallet, slip, 85% jackpot, and leftover seed land here.
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
  build: (payer: PublicKey) => TransactionInstruction | Promise<TransactionInstruction>,
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
    tx.add(await build(from));
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
    tx.add(
      isLottoV2(tape.programId)
        ? buyIxV2(from, tape.currentRound, tickets, new PublicKey(tape.feeWallet))
        : buyIxForRound(from, tape.currentRound, tickets, new PublicKey(tape.feeWallet)),
    );
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
  const v2 = isLottoV2(tape.programId);
  const timeoutPassed = Boolean(tape.vrfTimeoutAt) && Date.now() >= Date.parse(tape.vrfTimeoutAt ?? "");
  const canClose = tape.status === "open" && salesEnded;
  const canRequest = v2 && tape.status === "awaiting_vrf_request";
  const canFulfill = v2 && (tape.status === "awaiting_vrf" || tape.status === "awaiting_settle");
  const canSettle = v2
    ? tape.status === "awaiting_vrf" || tape.status === "awaiting_settle"
    : tape.status === "awaiting_block";
  const canClaim = tape.status === "drawn" && Boolean(tape.draw?.winner);
  const canRefund =
    v2 &&
    (tape.status === "refunding" ||
      (timeoutPassed &&
        (tape.status === "awaiting_vrf_request" || tape.status === "awaiting_vrf" || tape.status === "awaiting_settle")));
  const canOpen =
    tape.status === "awaiting_round" || tape.status === "claimed" || tape.status === "void" || tape.status === "refunded";
  const run = (
    build: (payer: PublicKey) => TransactionInstruction | Promise<TransactionInstruction>,
    asking: string,
    done: string,
  ) => void sendProgramIx(solana, build, setPhase, setError, reload, asking, done);

  async function vrfRequestIx(payer: PublicKey) {
    const program = new PublicKey(tape.programId);
    const round = new PublicKey(tape.pot);
    const seed = await vrfSeedBytes(program.toBytes(), round.toBytes(), tape.round, tape.totalTickets);
    const [request] = oraoRequestPda(seed);
    const [network] = oraoNetworkStatePda();
    const info = await solana.connection.getAccountInfo(network, "confirmed");
    if (!info?.data) throw new Error("ORAO network state is missing on this RPC.");
    const treasury = oraoTreasuryFromNetworkState(info.data);
    if (!treasury) throw new Error("ORAO treasury did not decode.");
    return requestRandomnessIxV2(payer, tape.currentRound, request, treasury);
  }

  function vrfAccount() {
    if (!tape.vrfRequest) throw new Error("No VRF request is stored on this round yet.");
    return new PublicKey(tape.vrfRequest);
  }

  const refundRow = tape.entries.find((row) => !row.refunded);

  return (
    <div className="glass-panel mt-8 rounded-[28px] p-5 sm:p-6">
      <p className="kicker">Crank the program</p>
      <p className="mt-2 text-sm leading-6 text-[var(--dim)]">
        {v2
          ? "Anyone with a wallet can run these. After close, request one ORAO job, wait for fulfill, then settle. If the timeout hits, refund unpaid buyers."
          : "Anyone with a wallet can run these. Settle has a few minutes after the entropy slot before SlotHashes drops it."}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <HouseButton
          disabled={!canClose || busy}
          onClick={() =>
            run(() => (v2 ? closeSalesIxV2(tape.currentRound) : closeSalesIx(tape.currentRound)), "Closing sales…", "Sales closed")
          }
        >
          Close sales
        </HouseButton>
        {v2 ? (
          <HouseButton disabled={!canRequest || busy} onClick={() => run(vrfRequestIx, "Requesting VRF…", "VRF requested")}>
            Request randomness
          </HouseButton>
        ) : null}
        {v2 ? (
          <HouseButton
            disabled={!canFulfill || busy}
            onClick={() => run(() => fulfillRandomnessIxV2(tape.currentRound, vrfAccount()), "Reading ORAO…", "VRF stored")}
          >
            Store VRF
          </HouseButton>
        ) : null}
        <HouseButton
          disabled={!canSettle || busy}
          onClick={() =>
            run(
              () => (v2 ? settleIxV2(tape.currentRound, vrfAccount()) : settleIx(tape.currentRound)),
              "Settling…",
              "Draw settled",
            )
          }
        >
          Settle draw
        </HouseButton>
        <HouseButton
          disabled={!canClaim || busy}
          onClick={() =>
            run(
              (payer) =>
                v2
                  ? claimIxV2(tape.currentRound, new PublicKey(tape.draw?.winner || payer.toBase58()))
                  : claimIx(tape.currentRound, new PublicKey(tape.draw?.winner || payer.toBase58())),
              "Paying winner…",
              "Pot claimed",
            )
          }
        >
          Pay 85%
        </HouseButton>
        {v2 ? (
          <HouseButton
            disabled={!canRefund || busy || !refundRow}
            onClick={() => {
              const index = tape.entries.findIndex((row) => !row.refunded);
              const row = tape.entries[index];
              if (!row) return;
              run(() => refundOneIxV2(tape.currentRound, new PublicKey(row.wallet), index), "Refunding…", "Buyer refunded");
            }}
          >
            Refund a buyer
          </HouseButton>
        ) : null}
        <HouseButton
          disabled={!canOpen || busy}
          onClick={() =>
            run(
              (payer) => (v2 ? openRoundIxV2(payer, tape.currentRound) : openRoundIx(payer, tape.currentRound)),
              "Opening round…",
              "Round open",
            )
          }
        >
          Open next round
        </HouseButton>
      </div>
    </div>
  );
}
