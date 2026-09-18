import "server-only";

import { Connection, PublicKey } from "@solana/web3.js";
import { configPda, decodeConfig, decodeRound, hasLottoProgram, isLottoV2, JROCK_LOTTO_PROGRAM_ID, roundPda } from "@/lib/lotto-program";
import { serverSolanaRpcUrl } from "@/lib/solana";
import {
  LOTTO_PROGRAM_PROOF_VERSION,
  LOTTO_PROGRAM_V2_PROOF_VERSION,
  PROGRAM_LOTTO_RULES,
  PROGRAM_LOTTO_RULES_V2,
  buildProof,
  emptyLottoSnapshot,
  hasLottoPot,
  lottoFeeWallet,
  lottoPot,
  lottoRoundAt,
  lottoTicketLamports,
  makeDrawFromBlock,
  slipPotLamports,
  slipsFromEntries,
  sortEntries,
  splitClaimable,
  verifyDraw,
  walletsFromEntries,
  winnerIndexFromSlotHash,
  type LottoDraw,
  type LottoEntry,
  type LottoPostedWin,
  type LottoSnapshot,
  type LottoSplit,
} from "@/lib/lotto";
import { lottoProgramId, type OnchainConfig, type OnchainRound } from "@/lib/lotto-program";
import { decodeConfigV2, decodeRoundV2, type OnchainRoundV2 } from "@/lib/lotto-program-v2";
import { buildLedger } from "@/lib/lotto-ledger";
import { hexToBytes, winnerFromVrfEntropy } from "@/lib/lotto-vrf";

const SIG_PAGE = 100;
const SIG_PAGES = 15;
const CACHE_MS = 2_000;

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
  return new Connection(serverSolanaRpcUrl(), { commitment: "confirmed" });
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
  if (!from || from === pot || lamports < slipPotLamports(lottoTicketLamports(), 1)) return null;
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
      commitment: "confirmed",
    });
    chunk.forEach((signature, index) => {
      const tx = txs[index];
      if (!tx) return;
      const paid = transferIntoPot(tx, pot.toBase58());
      if (!paid) return;
      const unit = slipPotLamports(price, 1) || price;
      const tickets = Math.floor(paid.lamports / unit);
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

const rentCache = new Map<number, number>();

async function rentExemptLamports(rpc: Connection, dataLen: number) {
  const hit = rentCache.get(dataLen);
  if (hit != null) return hit;
  const rent = await rpc.getMinimumBalanceForRentExemption(dataLen, "confirmed").catch(() => (dataLen + 128) * 5080);
  rentCache.set(dataLen, rent);
  return rent;
}

function rentEstimate(dataLen: number) {
  return rentCache.get(dataLen) ?? (dataLen + 128) * 5080;
}

function splitFromAccount(lamports: number, dataLen: number, ticketLamportsSold: number, ticketCount = 0, ticketPrice = 0, roundId = 0): LottoSplit {
  const rent = rentEstimate(dataLen);
  const ledger = buildLedger({
    accountBalanceLamports: lamports,
    rentExemptReserveLamports: rent,
    ticketCount,
    ticketPriceLamports: ticketPrice,
    currentRound: roundId,
  });
  return {
    rentLamports: ledger.rentExemptReserveLamports,
    claimableLamports: ledger.distributablePotLamports,
    ticketLamports: ticketLamportsSold,
    seedLamports: ledger.priorRoundSeedLamports + ledger.donationsOrUnexpectedDepositsLamports,
    winnerLamports: ledger.winnerPayoutLamports,
    carryLamports: ledger.nextRoundSeedLamports,
  };
}

function postedFromRound(
  round: {
    roundId: number;
    startTs: number;
    endTs: number;
    ticketCount: number;
    winner: string;
    winnerIndex: number;
    status: LottoPostedWin["status"];
    entropySlot?: number;
    entropyHash?: string;
  },
  pot: string,
  lamports: number,
  dataLen: number,
  ticketPrice: number,
  payoutKnown: boolean,
  verified: boolean,
): LottoPostedWin {
  const sold = slipPotLamports(ticketPrice, round.ticketCount);
  let split = splitFromAccount(lamports, dataLen, sold, round.ticketCount, ticketPrice, round.roundId);
  if (round.status === "claimed") {
    const leftover = Math.max(0, lamports - rentEstimate(dataLen));
    if (leftover > 1_000) {
      const claimable = Math.floor((leftover * 100) / 15);
      split = splitClaimable(claimable, sold);
      split.rentLamports = rentEstimate(dataLen);
    } else {
      split = splitClaimable(sold, sold);
      split.rentLamports = rentEstimate(dataLen);
      payoutKnown = false;
    }
  } else if (round.status === "void") {
    split = splitFromAccount(lamports, dataLen, 0, 0, ticketPrice, round.roundId);
  }
  const settled = round.status === "settled" || round.status === "claimed";
  return {
    round: round.roundId,
    pot,
    status: round.status,
    startsAt: new Date(round.startTs * 1000).toISOString(),
    endsAt: new Date(round.endTs * 1000).toISOString(),
    tickets: round.ticketCount,
    winner: settled ? round.winner : null,
    winnerIndex: settled ? round.winnerIndex : null,
    jackpotLamports: split.winnerLamports,
    carryLamports: split.carryLamports,
    ticketLamports: sold,
    seedLamports: split.seedLamports,
    payoutKnown,
    verified,
    entropySlot: round.entropySlot || null,
    entropyHash: round.entropyHash && round.entropyHash !== "0".repeat(64) ? round.entropyHash : null,
  };
}

async function loadPostedRounds(
  rpc: Connection,
  currentRound: number,
  ticketPrice: number,
): Promise<LottoPostedWin[]> {
  const max = Math.min(currentRound, 48);
  if (max < 0) return [];
  const keys = [];
  for (let id = 0; id <= max; id += 1) keys.push(roundPda(id)[0]);
  const infos = await rpc.getMultipleAccountsInfo(keys, "confirmed");
  if (infos[0]?.data) await rentExemptLamports(rpc, infos[0].data.length);
  const posted: LottoPostedWin[] = [];
  for (let i = 0; i < infos.length; i += 1) {
    const info = infos[i];
    if (!info?.data) continue;
    const round = decodeRound(info.data);
    if (!round) continue;
    if (round.status === "open" || round.status === "closed") continue;
    const draw = await drawFromRound(round, ticketPrice);
    posted.push(
      postedFromRound(
        round,
        keys[i].toBase58(),
        info.lamports,
        info.data.length,
        ticketPrice,
        round.status === "settled" || (round.status === "claimed" && info.lamports - rentEstimate(info.data.length) > 1_000),
        draw?.verified ?? false,
      ),
    );
  }
  return posted.sort((a, b) => b.round - a.round);
}

function entriesFromRound(round: OnchainRound, ticketLamports: number): LottoEntry[] {
  return round.buyers.map((row) => ({
    wallet: row.wallet,
    tickets: row.tickets,
    lamports: row.tickets * ticketLamports,
    signature: `${row.fromIndex}:${row.wallet}`,
    slot: row.fromIndex,
    at: new Date(round.startTs * 1000).toISOString(),
  }));
}

async function drawFromRound(round: OnchainRound, ticketLamports: number): Promise<LottoDraw | null> {
  if (round.status !== "settled" && round.status !== "claimed") return null;
  const slips = slipsFromEntries(entriesFromRound(round, ticketLamports));
  const slip = slips[round.winnerIndex];
  const entropy = await winnerIndexFromSlotHash(round.entropyHash, round.roundId, slips.length);
  const draw: LottoDraw = {
    slot: round.entropySlot,
    blockTime: 0,
    blockhash: round.entropyHash,
    hash: entropy.hash,
    random: entropy.random,
    winnerIndex: round.winnerIndex,
    winner: round.winner,
    winningSignature: slip?.signature ?? "",
    verified: entropy.index === round.winnerIndex && slip?.wallet === round.winner,
  };
  return draw;
}

function v2TapeStatus(status: OnchainRoundV2["status"]): LottoSnapshot["status"] {
  if (status === "open") return "open";
  if (status === "closed") return "awaiting_vrf_request";
  if (status === "randomness_requested") return "awaiting_vrf";
  if (status === "fulfilled") return "awaiting_settle";
  if (status === "settled") return "drawn";
  if (status === "claimed") return "claimed";
  if (status === "void") return "void";
  if (status === "refunding") return "refunding";
  if (status === "refunded") return "refunded";
  return "awaiting_round";
}

function entriesFromRoundV2(round: OnchainRoundV2, ticketLamports: number): LottoEntry[] {
  return round.buyers.map((row) => ({
    wallet: row.wallet,
    tickets: row.tickets,
    lamports: row.tickets * ticketLamports,
    signature: `${row.fromIndex}:${row.wallet}`,
    slot: row.fromIndex,
    at: new Date(round.startTs * 1000).toISOString(),
    refunded: row.refunded,
  }));
}

async function drawFromRoundV2(round: OnchainRoundV2, ticketLamports: number): Promise<LottoDraw | null> {
  if (round.status !== "settled" && round.status !== "claimed") return null;
  const slips = slipsFromEntries(entriesFromRoundV2(round, ticketLamports));
  const slip = slips[round.winnerIndex];
  const zero = "0".repeat(64);
  if (!round.vrfRandomness || round.vrfRandomness === zero) return null;
  const entropy = await winnerFromVrfEntropy(hexToBytes(round.vrfRandomness), slips.length || round.ticketCount);
  return {
    slot: 0,
    blockTime: round.closeTs,
    blockhash: round.vrfRandomness,
    hash: entropy.hash,
    random: String(entropy.index),
    winnerIndex: round.winnerIndex,
    winner: round.winner,
    winningSignature: slip?.signature ?? "",
    verified: entropy.index === round.winnerIndex && slip?.wallet === round.winner,
  };
}

async function loadPostedRoundsV2(
  rpc: Connection,
  currentRound: number,
  ticketPrice: number,
): Promise<LottoPostedWin[]> {
  const max = Math.min(currentRound, 48);
  if (max < 0) return [];
  const keys = [];
  for (let id = 0; id <= max; id += 1) keys.push(roundPda(id)[0]);
  const infos = await rpc.getMultipleAccountsInfo(keys, "confirmed");
  if (infos[0]?.data) await rentExemptLamports(rpc, infos[0].data.length);
  const posted: LottoPostedWin[] = [];
  const skip = new Set(["open", "closed", "randomness_requested", "fulfilled", "refunding"]);
  for (let i = 0; i < infos.length; i += 1) {
    const info = infos[i];
    if (!info?.data) continue;
    const round = decodeRoundV2(info.data);
    if (!round || skip.has(round.status)) continue;
    const draw = await drawFromRoundV2(round, ticketPrice);
    posted.push(
      postedFromRound(
        {
          roundId: round.roundId,
          startTs: round.startTs,
          endTs: round.endTs,
          ticketCount: round.ticketCount,
          winner: round.winner,
          winnerIndex: round.winnerIndex,
          status: round.status,
          entropyHash: round.vrfRandomness,
        },
        keys[i].toBase58(),
        info.lamports,
        info.data.length,
        ticketPrice,
        round.status === "settled" || round.status === "claimed" || round.status === "refunded",
        draw?.verified ?? false,
      ),
    );
  }
  return posted.sort((a, b) => b.round - a.round);
}

async function historicalV1RoundZero(rpc: Connection, ticketPrice: number): Promise<LottoPostedWin[]> {
  const v1 = new PublicKey(JROCK_LOTTO_PROGRAM_ID);
  const [pda] = roundPda(0, v1);
  const info = await rpc.getAccountInfo(pda, "confirmed");
  if (!info?.data) return [];
  const round = decodeRound(info.data);
  if (!round) return [];
  if (round.status === "open" || round.status === "closed") return [];
  const draw = await drawFromRound(round, ticketPrice);
  return [
    postedFromRound(
      round,
      pda.toBase58(),
      info.lamports,
      info.data.length,
      ticketPrice,
      round.status === "settled" || round.status === "claimed",
      draw?.verified ?? false,
    ),
  ];
}

function v2ProofInput(round: OnchainRoundV2, pot: string, slips: ReturnType<typeof slipsFromEntries>, draw: LottoDraw | null, ticketLamports: number) {
  return buildProof({
    pot,
    round: round.roundId,
    startsAt: new Date(round.startTs * 1000).toISOString(),
    endsAt: new Date(round.endTs * 1000).toISOString(),
    entropyAfter: round.vrfRequest && round.vrfRequest !== "11111111111111111111111111111111" ? `ORAO ${round.vrfRequest}` : "ORAO VRF pending",
    ticketLamports,
    slips,
    draw,
    version: LOTTO_PROGRAM_V2_PROOF_VERSION,
    rules: PROGRAM_LOTTO_RULES_V2,
  });
}

async function getPreviousRoundV2(rpc: Connection, currentRound: number) {
  if (currentRound <= 0) return null;
  const [prevPk] = roundPda(currentRound - 1);
  const info = await rpc.getAccountInfo(prevPk, "confirmed");
  if (!info?.data) return null;
  const round = decodeRoundV2(info.data);
  if (!round) return null;
  return { round, lamports: info.lamports, pot: prevPk.toBase58(), dataLen: info.data.length };
}

async function getV2ProgramSnapshot(rpc: Connection): Promise<LottoSnapshot | null> {
  if (!hasLottoProgram()) return null;
  const [configPk] = configPda();
  const configInfo = await rpc.getAccountInfo(configPk, "confirmed");
  if (!configInfo?.data) return null;
  const config = decodeConfigV2(configInfo.data);
  if (!config) return null;
  const [roundPk] = roundPda(config.currentRound);
  const roundInfo = await rpc.getAccountInfo(roundPk, "confirmed");
  const empty = emptyLottoSnapshot("The on-chain round is not open yet. Anyone can crank Open next round.");
  empty.engine = "program";
  empty.currentRound = config.currentRound;
  empty.ticketLamports = config.ticketLamports;
  empty.ticketPriceSol = config.ticketLamports / 1_000_000_000;
  empty.pot = roundPk.toBase58();
  empty.programId = lottoProgramId();
  empty.configPda = configPk.toBase58();
  empty.feeWallet = lottoFeeWallet();
  empty.randomnessProvider = "ORAO VRF Classic";
  empty.verifiedBuild = false;
  empty.upgradeable = true;
  empty.roundSecs = config.roundSecs;
  empty.authority = config.authority;
  const previous = await getPreviousRoundV2(rpc, config.currentRound);
  const last = previous ? await drawFromRoundV2(previous.round, config.ticketLamports) : null;
  const posted = [
    ...(await loadPostedRoundsV2(rpc, config.currentRound, config.ticketLamports)),
    ...(await historicalV1RoundZero(rpc, 50_000_000)),
  ];
  empty.posted = posted;
  if (!roundInfo?.data) {
    empty.status = "awaiting_round";
    empty.last = last;
    empty.potLamports = previous?.lamports ?? 0;
    empty.potSol = (previous?.lamports ?? 0) / 1_000_000_000;
    empty.split = previous
      ? splitFromAccount(previous.lamports, previous.dataLen, 0, 0, config.ticketLamports, previous.round.roundId)
      : splitClaimable(0, 0);
    empty.proof.version = LOTTO_PROGRAM_V2_PROOF_VERSION;
    empty.proof.rules = PROGRAM_LOTTO_RULES_V2;
    empty.proof.pot = roundPk.toBase58();
    empty.message =
      previous?.round.status === "claimed"
        ? "Last winner took 85%. Fifteen percent is waiting to seed the next round. Crank Open next round."
        : previous?.round.status === "void"
          ? "Last round had no slips. Leftover seed still rolls forward. Crank Open next round."
          : previous?.round.status === "refunded"
            ? "Last round refunded after the VRF timeout. Leftover seed still rolls forward. Crank Open next round."
            : empty.message;
    return empty;
  }
  const round = decodeRoundV2(roundInfo.data);
  if (!round) return empty;
  const entries = entriesFromRoundV2(round, config.ticketLamports);
  const slips = slipsFromEntries(entries);
  const startsAt = new Date(round.startTs * 1000).toISOString();
  const endsAt = new Date(round.endTs * 1000).toISOString();
  const balance = roundInfo.lamports;
  const roundLamports = slipPotLamports(config.ticketLamports, slips.length);
  const status = v2TapeStatus(round.status);
  const messages: Record<string, string> = {
    open: "Buy a slip on-chain. After close, the kennel asks ORAO for one VRF. Winner takes 85%. Fifteen percent seeds the next rock.",
    awaiting_vrf_request: "Sales are closed. Crank Request randomness to bind one ORAO VRF job. A second request is rejected.",
    awaiting_vrf: "Waiting on ORAO to fulfill the bound request. Then crank Settle. If the timeout hits first, refunds open.",
    awaiting_settle: "ORAO fulfilled. Crank Settle to map the stored randomness onto a slip with rejection sampling.",
    drawn: "The program picked a winner. Claim pays that wallet 85%. Fifteen percent stays in the pot.",
    claimed: "Winner took 85%. Crank Open next round to roll the leftover 15% forward.",
    void: "No slips. Crank Open next round. Any leftover seed rolls forward.",
    refunding: "VRF timed out. Anyone can refund unpaid buyers their 99% pot share. The 1% kennel fee stays paid.",
    refunded: "Every buyer was refunded. Crank Open next round to roll leftover seed.",
  };
  const draw = await drawFromRoundV2(round, config.ticketLamports);
  const rent = await rentExemptLamports(rpc, roundInfo.data.length);
  const ledger = buildLedger({
    accountBalanceLamports: balance,
    rentExemptReserveLamports: rent,
    ticketCount: round.ticketCount,
    ticketPriceLamports: config.ticketLamports,
    currentRound: round.roundId,
  });
  const split = splitFromAccount(
    balance,
    roundInfo.data.length,
    roundLamports,
    round.ticketCount,
    config.ticketLamports,
    round.roundId,
  );
  const defaultRequest = "11111111111111111111111111111111";
  return {
    pot: roundPk.toBase58(),
    round: round.roundId,
    startsAt,
    endsAt,
    ticketPriceSol: config.ticketLamports / 1_000_000_000,
    ticketLamports: config.ticketLamports,
    potLamports: balance,
    potSol: balance / 1_000_000_000,
    roundLamports,
    roundSol: roundLamports / 1_000_000_000,
    entries,
    slips,
    totalTickets: round.ticketCount,
    status,
    draw,
    last: draw ? null : last,
    proof: await v2ProofInput(round, roundPk.toBase58(), slips, draw, config.ticketLamports),
    message: messages[status] ?? empty.message,
    engine: "program",
    currentRound: config.currentRound,
    entropySlot: null,
    programId: lottoProgramId(),
    configPda: configPk.toBase58(),
    feeWallet: lottoFeeWallet(),
    wallets: walletsFromEntries(entries, round.ticketCount),
    split,
    posted,
    ledger,
    randomnessProvider: "ORAO VRF Classic",
    vrfRequest: round.vrfRequest && round.vrfRequest !== defaultRequest ? round.vrfRequest : null,
    vrfTimeoutAt: round.vrfTimeoutTs ? new Date(round.vrfTimeoutTs * 1000).toISOString() : null,
    verifiedBuild: false,
    upgradeable: true,
    onchainStatus: round.status,
    roundSecs: config.roundSecs,
    authority: config.authority,
  };
}

function programProofInput(round: OnchainRound, pot: string, slips: ReturnType<typeof slipsFromEntries>, draw: LottoDraw | null, ticketLamports: number) {
  return buildProof({
    pot,
    round: round.roundId,
    startsAt: new Date(round.startTs * 1000).toISOString(),
    endsAt: new Date(round.endTs * 1000).toISOString(),
    entropyAfter: `slot ${round.entropySlot || "pending"}`,
    ticketLamports,
    slips,
    draw,
    version: LOTTO_PROGRAM_PROOF_VERSION,
    rules: PROGRAM_LOTTO_RULES,
  });
}

async function getPreviousRound(rpc: Connection, config: OnchainConfig) {
  if (config.currentRound <= 0) return null;
  const [prevPk] = roundPda(config.currentRound - 1);
  const info = await rpc.getAccountInfo(prevPk, "confirmed");
  if (!info?.data) return null;
  const round = decodeRound(info.data);
  if (!round) return null;
  return { round, lamports: info.lamports, pot: prevPk.toBase58(), dataLen: info.data.length };
}

async function getProgramSnapshot(rpc: Connection): Promise<LottoSnapshot | null> {
  if (isLottoV2()) return getV2ProgramSnapshot(rpc);
  if (!hasLottoProgram()) return null;
  const [configPk] = configPda();
  const configInfo = await rpc.getAccountInfo(configPk, "confirmed");
  if (!configInfo?.data) return null;
  const config = decodeConfig(configInfo.data);
  if (!config) return null;
  const [roundPk] = roundPda(config.currentRound);
  const roundInfo = await rpc.getAccountInfo(roundPk, "confirmed");
  const empty = emptyLottoSnapshot(
    "The on-chain round is not open yet. Anyone can crank Open next round.",
  );
  empty.engine = "program";
  empty.currentRound = config.currentRound;
  empty.ticketLamports = config.ticketLamports;
  empty.ticketPriceSol = config.ticketLamports / 1_000_000_000;
  empty.pot = roundPk.toBase58();
  empty.programId = lottoProgramId();
  empty.configPda = configPk.toBase58();
  empty.feeWallet = lottoFeeWallet();
  empty.roundSecs = config.roundSecs;
  empty.authority = config.authority;
  const previous = await getPreviousRound(rpc, config);
  const last = previous ? await drawFromRound(previous.round, config.ticketLamports) : null;
  const posted = await loadPostedRounds(rpc, config.currentRound, config.ticketLamports);
  empty.posted = posted;
  if (!roundInfo?.data) {
    empty.status = "awaiting_round";
    empty.last = last;
    empty.potLamports = previous?.lamports ?? 0;
    empty.potSol = (previous?.lamports ?? 0) / 1_000_000_000;
    empty.split = previous
      ? splitFromAccount(previous.lamports, previous.dataLen, 0, 0, config.ticketLamports, previous.round.roundId)
      : splitClaimable(0, 0);
    if (previous) {
      await rentExemptLamports(rpc, previous.dataLen);
      empty.ledger = buildLedger({
        accountBalanceLamports: previous.lamports,
        rentExemptReserveLamports: rentEstimate(previous.dataLen),
        ticketCount: 0,
        ticketPriceLamports: config.ticketLamports,
        currentRound: previous.round.roundId,
      });
    }
    empty.proof.version = LOTTO_PROGRAM_PROOF_VERSION;
    empty.proof.rules = PROGRAM_LOTTO_RULES;
    empty.proof.pot = roundPk.toBase58();
    empty.message =
      previous?.round.status === "claimed"
        ? "Last winner took 85%. Fifteen percent is waiting to seed the next round. Crank Open next round."
        : previous?.round.status === "void"
          ? "Last round had no slips. Leftover seed still rolls forward. Crank Open next round."
          : empty.message;
    return empty;
  }
  const round = decodeRound(roundInfo.data);
  if (!round) return empty;
  const entries = entriesFromRound(round, config.ticketLamports);
  const slips = slipsFromEntries(entries);
  const startsAt = new Date(round.startTs * 1000).toISOString();
  const endsAt = new Date(round.endTs * 1000).toISOString();
  const balance = roundInfo.lamports;
  const roundLamports = slipPotLamports(config.ticketLamports, slips.length);
  let status: LottoSnapshot["status"] = "open";
  let message = "Buy a slip on-chain. The round account holds the pot. Winner takes 85%. Fifteen percent seeds the next rock.";
  if (round.status === "closed") {
    status = "awaiting_block";
    message = `Sales are closed. Wait until slot ${round.entropySlot} lands in SlotHashes, then crank Settle within a few minutes.`;
  } else if (round.status === "settled") {
    status = "drawn";
    message = "The program picked a winner. Claim pays that wallet 85%. Fifteen percent stays in the pot.";
  } else if (round.status === "claimed") {
    status = "claimed";
    message = "Winner took 85%. Crank Open next round to roll the leftover 15% forward.";
  } else if (round.status === "void") {
    status = "void";
    message = "No slips. Crank Open next round. Any leftover seed rolls forward.";
  } else if (Date.now() >= round.endTs * 1000) {
    message =
      "Sales are over. Close, settle, pay the winner, then open the next rock. The page does that automatically when a wallet is connected. Anyone can also press the finish buttons.";
  }
  const draw = await drawFromRound(round, config.ticketLamports);
  const rent = await rentExemptLamports(rpc, roundInfo.data.length);
  const ledger = buildLedger({
    accountBalanceLamports: balance,
    rentExemptReserveLamports: rent,
    ticketCount: round.ticketCount,
    ticketPriceLamports: config.ticketLamports,
    currentRound: round.roundId,
  });
  const split = splitFromAccount(
    balance,
    roundInfo.data.length,
    roundLamports,
    round.ticketCount,
    config.ticketLamports,
    round.roundId,
  );
  return {
    pot: roundPk.toBase58(),
    round: round.roundId,
    startsAt,
    endsAt,
    ticketPriceSol: config.ticketLamports / 1_000_000_000,
    ticketLamports: config.ticketLamports,
    potLamports: balance,
    potSol: balance / 1_000_000_000,
    roundLamports,
    roundSol: roundLamports / 1_000_000_000,
    entries,
    slips,
    totalTickets: round.ticketCount,
    status,
    draw,
    last: draw ? null : last,
    proof: await programProofInput(round, roundPk.toBase58(), slips, draw, config.ticketLamports),
    message,
    engine: "program",
    currentRound: config.currentRound,
    entropySlot: round.entropySlot || null,
    programId: lottoProgramId(),
    configPda: configPk.toBase58(),
    feeWallet: lottoFeeWallet(),
    wallets: walletsFromEntries(entries, round.ticketCount),
    split,
    posted,
    ledger,
    randomnessProvider: "Solana SlotHashes",
    vrfRequest: null,
    vrfTimeoutAt: null,
    verifiedBuild: false,
    upgradeable: true,
    onchainStatus: round.status,
    roundSecs: config.roundSecs,
    authority: config.authority,
  };
}

export async function getLottoSnapshot(fresh = false): Promise<LottoSnapshot> {
  if (!fresh && cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  const rpc = connection();
  const programmed = await getProgramSnapshot(rpc).catch(() => null);
  if (programmed) {
    cache = { at: Date.now(), data: programmed };
    return programmed;
  }
  const potKey = lottoPot();
  if (!hasLottoPot() || !looksLikePot(potKey)) {
    const empty = emptyLottoSnapshot(
      "The pot wallet is not posted yet. File NEXT_PUBLIC_LOTTO_POT, then the rock can take slips.",
    );
    cache = { at: Date.now(), data: empty };
    return empty;
  }

  const pot = new PublicKey(potKey);
  const now = Date.now();
  const current = lottoRoundAt(now);
  const previous = lottoRoundAt(current.startsAt - 1);
  const price = lottoTicketLamports();
  const startsAt = new Date(current.startsAt).toISOString();
  const endsAt = new Date(current.endsAt).toISOString();
  const entropyAfter = new Date(current.drawAfter).toISOString();

  const [balance, currentEntries, lastEntries] = await Promise.all([
    rpc.getBalance(pot, "confirmed"),
    loadEntries(rpc, pot, Math.floor(current.startsAt / 1000), Math.floor(current.endsAt / 1000)),
    current.round > 0
      ? loadEntries(rpc, pot, Math.floor(previous.startsAt / 1000), Math.floor(previous.endsAt / 1000))
      : Promise.resolve([] as LottoEntry[]),
  ]);

  const slips = slipsFromEntries(currentEntries);
  const lastSlips = slipsFromEntries(lastEntries);
  const roundLamports = slipPotLamports(price, slips.length);
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
    engine: "wallet",
    currentRound: current.round,
    entropySlot: draw?.slot ?? null,
    programId: "",
    configPda: "",
    feeWallet: lottoFeeWallet(),
    wallets: walletsFromEntries(sortEntries(currentEntries), slips.length),
    split: splitClaimable(roundLamports, roundLamports),
    posted: last
      ? [
          {
            round: previous.round,
            pot: potKey,
            status: "claimed",
            startsAt: new Date(previous.startsAt).toISOString(),
            endsAt: new Date(previous.endsAt).toISOString(),
            tickets: lastSlips.length,
            winner: last.winner,
            winnerIndex: last.winnerIndex,
            jackpotLamports: lastSlips.length * price,
            carryLamports: 0,
            ticketLamports: lastSlips.length * price,
            seedLamports: 0,
            payoutKnown: false,
            verified: last.verified,
            entropySlot: last.slot,
            entropyHash: last.blockhash,
          },
        ]
      : [],
  };
  cache = { at: Date.now(), data };
  return data;
}
