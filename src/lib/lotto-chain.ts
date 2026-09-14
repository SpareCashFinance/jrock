import "server-only";

import { Connection, PublicKey } from "@solana/web3.js";
import { serverSolanaRpcUrl } from "@/lib/solana";
import {
  emptyLottoSnapshot,
  hasLottoPot,
  lottoPot,
  lottoRoundAt,
  lottoTicketLamports,
  randomFromBlockhash,
  slipsFromEntries,
  winnerIndexFromBlockhash,
  type LottoDraw,
  type LottoEntry,
  type LottoSlip,
  type LottoSnapshot,
} from "@/lib/lotto";

const SIG_LIMIT = 120;
const CACHE_MS = 12_000;

let cache: { at: number; data: LottoSnapshot } | null = null;

type ParsedIx = {
  program?: string;
  parsed?: {
    type?: string;
    info?: {
      source?: string;
      destination?: string;
      lamports?: number | string;
    };
  };
};

function connection() {
  return new Connection(serverSolanaRpcUrl(), "confirmed");
}

function looksLikePot(value: string) {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

function asParsedIx(value: unknown): ParsedIx | null {
  if (!value || typeof value !== "object") return null;
  return value as ParsedIx;
}

function transferIntoPot(tx: { meta?: unknown; transaction?: unknown }, pot: string) {
  const message = (tx.transaction as { message?: { instructions?: unknown[] } } | undefined)?.message;
  const outer = (message?.instructions ?? []).map(asParsedIx).filter((ix): ix is ParsedIx => Boolean(ix));
  const innerGroups =
    (tx.meta as { innerInstructions?: { instructions?: unknown[] }[] } | null | undefined)?.innerInstructions ?? [];
  const inner = innerGroups
    .flatMap((group) => group.instructions ?? [])
    .map(asParsedIx)
    .filter((ix): ix is ParsedIx => Boolean(ix));
  let lamports = 0;
  let from = "";
  for (const ix of [...outer, ...inner]) {
    if (ix.program !== "system" || ix.parsed?.type !== "transfer") continue;
    const info = ix.parsed.info;
    if (info?.destination !== pot) continue;
    const amount = Number(info.lamports ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    lamports += amount;
    from = info.source || from;
  }
  if (!from || lamports < lottoTicketLamports()) return null;
  return { from, lamports };
}

async function loadEntries(
  rpc: Connection,
  pot: PublicKey,
  startSec: number,
  endSec: number,
): Promise<LottoEntry[]> {
  const price = lottoTicketLamports();
  const sigs = await rpc.getSignaturesForAddress(pot, { limit: SIG_LIMIT });
  const wanted = sigs
    .filter((row) => {
      if (row.err) return false;
      const at = row.blockTime ?? 0;
      return at >= startSec && at < endSec;
    })
    .map((row) => row.signature);
  if (wanted.length === 0) return [];

  const txs = await rpc.getParsedTransactions(wanted, {
    maxSupportedTransactionVersion: 0,
  });
  const entries: LottoEntry[] = [];
  wanted.forEach((signature, index) => {
    const tx = txs[index];
    if (!tx) return;
    const paid = transferIntoPot(tx, pot.toBase58());
    if (!paid) return;
    const tickets = Math.floor(paid.lamports / price);
    if (tickets <= 0) return;
    entries.push({
      wallet: paid.from,
      tickets,
      lamports: tickets * price,
      signature,
      at: new Date((tx.blockTime ?? startSec) * 1000).toISOString(),
    });
  });
  return entries.reverse();
}

async function firstFinalizedBlockAfter(rpc: Connection, unixMs: number) {
  const target = Math.floor(unixMs / 1000);
  const current = await rpc.getSlot("finalized");
  const nowSec = Math.floor(Date.now() / 1000);
  const guess = Math.max(1, current - Math.max(0, Math.ceil((nowSec - target) / 0.4)) - 32);
  let lo = guess;
  let hi = current;
  for (let i = 0; i < 18 && lo < hi; i += 1) {
    const mid = Math.floor((lo + hi) / 2);
    const time = await rpc.getBlockTime(mid).catch(() => null);
    if (time == null) {
      lo = mid + 1;
      continue;
    }
    if (time < target) lo = mid + 1;
    else hi = mid;
  }
  for (let slot = lo; slot <= current; slot += 1) {
    const block = await rpc
      .getBlock(slot, {
        maxSupportedTransactionVersion: 0,
        transactionDetails: "none",
        rewards: false,
      })
      .catch(() => null);
    if (!block?.blockhash || block.blockTime == null) continue;
    if (block.blockTime < target) continue;
    return { slot, blockhash: block.blockhash, blockTime: block.blockTime };
  }
  return null;
}

function makeDraw(
  block: { slot: number; blockhash: string; blockTime: number },
  slips: LottoSlip[],
): LottoDraw | null {
  if (slips.length === 0) return null;
  const winnerIndex = winnerIndexFromBlockhash(block.blockhash, slips.length);
  const slip = slips[winnerIndex];
  if (!slip) return null;
  return {
    slot: block.slot,
    blockTime: block.blockTime,
    blockhash: block.blockhash,
    random: randomFromBlockhash(block.blockhash).toString(16),
    winnerIndex,
    winner: slip.wallet,
    winningSignature: slip.signature,
  };
}

export async function getLottoSnapshot(): Promise<LottoSnapshot> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  const potKey = lottoPot();
  if (!hasLottoPot() || !looksLikePot(potKey)) {
    const empty = emptyLottoSnapshot(
      "The pot wallet is not posted yet. File NEXT_PUBLIC_LOTTO_POT, then the rock can take slips.",
    );
    cache = { at: Date.now(), data: empty };
    return empty;
  }

  const rpc = connection();
  const pot = new PublicKey(potKey);
  const now = Date.now();
  const current = lottoRoundAt(now);
  const previous = lottoRoundAt(current.startsAt - 1);
  const price = lottoTicketLamports();

  const [balance, currentEntries, lastEntries] = await Promise.all([
    rpc.getBalance(pot, "confirmed"),
    loadEntries(rpc, pot, Math.floor(current.startsAt / 1000), Math.floor(current.endsAt / 1000)),
    current.round > 0
      ? loadEntries(rpc, pot, Math.floor(previous.startsAt / 1000), Math.floor(previous.endsAt / 1000))
      : Promise.resolve([] as LottoEntry[]),
  ]);

  const slips = slipsFromEntries(currentEntries);
  const lastSlips = slipsFromEntries(lastEntries);
  const roundLamports = slips.length * price;
  let status: LottoSnapshot["status"] = "open";
  let draw: LottoDraw | null = null;
  let last: LottoDraw | null = null;
  let message = "Buy a slip. When the clock hits zero the next Solana block picks the rock.";

  if (now >= current.drawAfter) {
    const block = await firstFinalizedBlockAfter(rpc, current.drawAfter);
    if (!block) {
      status = slips.length === 0 ? "void" : "awaiting_block";
      message =
        slips.length === 0
          ? "This round had no slips. The rock sat still."
          : "The clock is done. Waiting on the next finalized Solana block.";
    } else if (slips.length === 0) {
      status = "void";
      message = "This round had no slips. The rock sat still.";
    } else {
      draw = makeDraw(block, slips);
      status = "drawn";
      message = draw
        ? "The blockhash picked a slip. The kennel pays that wallet from the pot."
        : "The block landed. The rock could not map a winner.";
    }
  }

  if (lastSlips.length > 0 && now >= previous.drawAfter) {
    const lastBlock = await firstFinalizedBlockAfter(rpc, previous.drawAfter);
    if (lastBlock) last = makeDraw(lastBlock, lastSlips);
  }

  const data: LottoSnapshot = {
    pot: potKey,
    round: current.round,
    startsAt: new Date(current.startsAt).toISOString(),
    endsAt: new Date(current.endsAt).toISOString(),
    ticketPriceSol: price / 1_000_000_000,
    ticketLamports: price,
    potLamports: balance,
    potSol: balance / 1_000_000_000,
    roundLamports,
    roundSol: roundLamports / 1_000_000_000,
    entries: currentEntries,
    slips,
    totalTickets: slips.length,
    status,
    draw,
    last,
    message,
  };
  cache = { at: Date.now(), data };
  return data;
}
