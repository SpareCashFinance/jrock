import "server-only";

import { Connection, PublicKey } from "@solana/web3.js";
import { serverSolanaRpcUrl } from "@/lib/solana";
import {
  buildProof,
  emptyLottoSnapshot,
  hasLottoPot,
  lottoPot,
  lottoRoundAt,
  lottoTicketLamports,
  makeDrawFromBlock,
  slipsFromEntries,
  sortEntries,
  verifyDraw,
  type LottoDraw,
  type LottoEntry,
  type LottoSnapshot,
} from "@/lib/lotto";

const SIG_PAGE = 100;
const SIG_PAGES = 15;
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
  return new Connection(serverSolanaRpcUrl(), { commitment: "finalized" });
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
    if (info.source === pot) continue;
    const amount = Number(info.lamports ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    lamports += amount;
    from = info.source || from;
  }
  if (!from || from === pot || lamports < lottoTicketLamports()) return null;
  return { from, lamports };
}

async function loadEntries(
  rpc: Connection,
  pot: PublicKey,
  startSec: number,
  endSec: number,
): Promise<LottoEntry[]> {
  const price = lottoTicketLamports();
  const wanted: string[] = [];
  let before: string | undefined;
  for (let page = 0; page < SIG_PAGES; page += 1) {
    const batch = await rpc.getSignaturesForAddress(pot, { limit: SIG_PAGE, before });
    if (batch.length === 0) break;
    let olderThanWindow = false;
    for (const row of batch) {
      if (row.err) continue;
      const at = row.blockTime ?? 0;
      if (at && at < startSec) {
        olderThanWindow = true;
        continue;
      }
      if (at >= startSec && at < endSec) wanted.push(row.signature);
    }
    if (olderThanWindow) break;
    before = batch[batch.length - 1]?.signature;
    if (!before) break;
  }
  if (wanted.length === 0) return [];

  const entries: LottoEntry[] = [];
  for (let i = 0; i < wanted.length; i += 80) {
    const chunk = wanted.slice(i, i + 80);
    const txs = await rpc.getParsedTransactions(chunk, {
      maxSupportedTransactionVersion: 0,
      commitment: "finalized",
    });
    chunk.forEach((signature, index) => {
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
        slot: tx.slot,
        at: new Date((tx.blockTime ?? startSec) * 1000).toISOString(),
      });
    });
  }
  return entries;
}

async function firstFinalizedBlockAfter(rpc: Connection, unixMs: number) {
  const target = Math.floor(unixMs / 1000);
  const current = await rpc.getSlot("finalized");
  const currentTime = await rpc.getBlockTime(current).catch(() => null);
  if (currentTime != null && currentTime < target) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  const estimate = Math.max(1, current - Math.max(0, Math.ceil((nowSec - target) / 0.4)) - 80);
  let found: { slot: number; blockhash: string; blockTime: number } | null = null;
  let cursor = estimate;
  while (cursor <= current) {
    const time = await rpc.getBlockTime(cursor).catch(() => null);
    if (time == null) {
      cursor += 1;
      continue;
    }
    if (time < target) {
      cursor += Math.max(1, Math.floor((target - time) / 0.4) - 1);
      continue;
    }
    const block = await rpc
      .getBlock(cursor, {
        maxSupportedTransactionVersion: 0,
        transactionDetails: "none",
        rewards: false,
        commitment: "finalized",
      })
      .catch(() => null);
    if (!block?.blockhash || block.blockTime == null) {
      cursor += 1;
      continue;
    }
    if (block.blockTime < target) {
      cursor += 1;
      continue;
    }
    found = { slot: cursor, blockhash: block.blockhash, blockTime: block.blockTime };
    break;
  }
  if (!found) return null;

  for (let slot = found.slot - 1; slot >= Math.max(1, found.slot - 48); slot -= 1) {
    const block = await rpc
      .getBlock(slot, {
        maxSupportedTransactionVersion: 0,
        transactionDetails: "none",
        rewards: false,
        commitment: "finalized",
      })
      .catch(() => null);
    if (!block?.blockhash || block.blockTime == null) continue;
    if (block.blockTime < target) break;
    found = { slot, blockhash: block.blockhash, blockTime: block.blockTime };
  }
  return found;
}

export async function getLottoSnapshot(fresh = false): Promise<LottoSnapshot> {
  if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.data;
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
  const startsAt = new Date(current.startsAt).toISOString();
  const endsAt = new Date(current.endsAt).toISOString();
  const entropyAfter = new Date(current.drawAfter).toISOString();

  const [balance, currentEntries, lastEntries] = await Promise.all([
    rpc.getBalance(pot, "finalized"),
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
  let message = "Buy a slip before the clock hits zero. Sixty seconds later a finalized Solana block picks the rock.";

  if (now >= current.drawAfter) {
    const block = await firstFinalizedBlockAfter(rpc, current.drawAfter);
    if (!block) {
      status = slips.length === 0 ? "void" : "awaiting_block";
      message =
        slips.length === 0
          ? "This round had no slips. The rock sat still."
          : "Sales are closed. Waiting on the first finalized Solana block after the lag.";
    } else if (slips.length === 0) {
      status = "void";
      message = "This round had no slips. The rock sat still.";
    } else {
      draw = await makeDrawFromBlock(block, slips);
      if (draw) draw.verified = await verifyDraw(draw, slips);
      status = "drawn";
      message = draw?.verified
        ? "The blockhash hashed and the math checked. The kennel pays that wallet from the pot."
        : "A block landed but the proof did not recompute. The rock will not file a winner.";
    }
  }

  if (lastSlips.length > 0 && now >= previous.drawAfter) {
    const lastBlock = await firstFinalizedBlockAfter(rpc, previous.drawAfter);
    if (lastBlock) {
      last = await makeDrawFromBlock(lastBlock, lastSlips);
      if (last) last.verified = await verifyDraw(last, lastSlips);
    }
  }

  const data: LottoSnapshot = {
    pot: potKey,
    round: current.round,
    startsAt,
    endsAt,
    ticketPriceSol: price / 1_000_000_000,
    ticketLamports: price,
    potLamports: balance,
    potSol: balance / 1_000_000_000,
    roundLamports,
    roundSol: roundLamports / 1_000_000_000,
    entries: sortEntries(currentEntries),
    slips,
    totalTickets: slips.length,
    status,
    draw,
    last,
    proof: await buildProof({
      pot: potKey,
      round: current.round,
      startsAt,
      endsAt,
      entropyAfter,
      ticketLamports: price,
      slips,
      draw,
    }),
    message,
  };
  cache = { at: Date.now(), data };
  return data;
}
