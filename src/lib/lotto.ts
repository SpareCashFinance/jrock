import { EMPTY_LEDGER } from "./lotto-ledger";
import { hasLottoProgram, isLottoV2, lottoProgramId } from "./lotto-program";

export const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96QnTrNe2EtkZ";
export const LOTTO_MEMO_PREFIX = "jrock-lotto";
export const LOTTO_PROOF_VERSION = "jrock-lotto-v2";
export const LOTTO_PROGRAM_PROOF_VERSION = "jrock-lotto-v3";
export const LOTTO_PROGRAM_V2_PROOF_VERSION = "jrock-lotto-v4";
export const DRAW_LAG_SECONDS = 60;
export const LOTTO_WINNER_SHARE = 0.85;
export const LOTTO_CARRY_SHARE = 0.15;
export const LOTTO_SLIP_FEE_BPS = 1;
export const LOTTO_SLIP_FEE_DENOM = 100;
export const DEFAULT_LOTTO_FEE_WALLET = "qbjbLafSNGq27fYFiF1RKhb9BREk1zFWWS8H6Drj8co";

const DEFAULT_GENESIS = "2026-09-14T00:00:00.000Z";
const DEFAULT_ROUND_MS = 48 * 60 * 60 * 1000;
const DEFAULT_TICKET_SOL = 0.05;
export const LOTTO_ROUND_SECS_48H = 48 * 60 * 60;

export const LOTTO_RULES = {
  version: LOTTO_PROOF_VERSION,
  ticket: "Count floor(lamports / ticket_price) for each successful SOL transfer into the pot. 1% of each slip is the kennel fee; the rest is the ticket.",
  window: "A transfer counts only if its blockTime is >= round start and < round end.",
  order: "Sort entries by slot ascending, then signature ascending. Expand each entry into that many slips.",
  entropy: `First finalized Solana block whose blockTime is >= round end + ${DRAW_LAG_SECONDS}s.`,
  formula: "winnerIndex = sha256(utf8(blockhash)) as big-endian integer, modulo slip count.",
  payout: "Wallet mode still needs a kennel transfer from the pot. The on-chain program pays by claim.",
} as const;

export const PROGRAM_LOTTO_RULES = {
  version: LOTTO_PROGRAM_PROOF_VERSION,
  ticket: "Each buy instruction files 1 to 20 slips into the current round PDA. The posted slip price is paid in full. 1% is the kennel fee; 99% goes into the pot. Repeat buys append a new row.",
  window: "A buy counts only while the round is Open and the chain clock is before end_ts.",
  order: "Slips are contiguous ranges. from_index is the first slip of that buy; later buys from the same wallet append.",
  entropy: "INTERIM. After close_sales, entropy_slot = clock.slot + lag_slots. settle reads that exact SlotHashes entry. Not a VRF. If the slot ages out of SlotHashes, settle can fail. A closer chooses the moment of close, which chooses the slot.",
  formula: "winnerIndex = first 8 big-endian bytes of sha256(slot_hash || round_id_le || ticket_count_le) modulo ticket_count (range 0..ticket_count-1). Tiny modulo bias exists.",
  payout: "claim pays 85% of the round pot minus rent to the winner. 15% stays on the round and rolls into the next open_round. Anyone can crank.",
} as const;

export const PROGRAM_LOTTO_RULES_V2 = {
  version: LOTTO_PROGRAM_V2_PROOF_VERSION,
  ticket: "Each buy instruction files 1 to 20 slips into the current round PDA. The posted slip price is paid in full. 1% is the kennel fee; 99% goes into the pot. Repeat buys append a new row.",
  window: "A buy counts only while the round is Open and the chain clock is before end_ts.",
  order: "Slips are contiguous ranges. from_index is the first slip of that buy; later buys from the same wallet append.",
  entropy: "After close_sales, anyone may request one ORAO VRF Classic job seeded with sha256(program_id || round_pda || round_id_le || ticket_count_le). The request account is stored. A second request is rejected.",
  formula: "winnerIndex = rejection sampling of the first 32 bytes of the fulfilled ORAO output into 0..ticket_count-1. Stored randomness is reused so extra VRF responses cannot reroll.",
  payout: "If anyone bought a slip, settle always maps the stored ORAO bytes onto one of those wallets. claim pays 85% of the round pot minus rent to that winner. 15% stays on the round and rolls into the next open_round. Anyone can crank. Winner is derived from buyer ranges, never passed in.",
} as const;

export type LottoEntry = {
  wallet: string;
  tickets: number;
  lamports: number;
  signature: string;
  slot: number;
  at: string;
  refunded?: boolean;
};

export type LottoSlip = {
  index: number;
  wallet: string;
  signature: string;
};

export type LottoDraw = {
  slot: number;
  blockTime: number;
  blockhash: string;
  hash: string;
  random: string;
  winnerIndex: number;
  winner: string;
  winningSignature: string;
  verified: boolean;
};

export type LottoProof = {
  version: string;
  pot: string;
  round: number;
  startsAt: string;
  endsAt: string;
  entropyAfter: string;
  ticketPriceLamports: number;
  ticketCount: number;
  bookHash: string;
  slot: number | null;
  blockhash: string | null;
  sha256: string | null;
  winnerIndex: number | null;
  winner: string | null;
  rules: typeof LOTTO_RULES | typeof PROGRAM_LOTTO_RULES | typeof PROGRAM_LOTTO_RULES_V2;
};

export type LottoStatus =
  | "awaiting_pot"
  | "awaiting_round"
  | "open"
  | "awaiting_block"
  | "awaiting_vrf_request"
  | "awaiting_vrf"
  | "awaiting_settle"
  | "void"
  | "drawn"
  | "claimed"
  | "refunding"
  | "refunded";

export type LottoWalletBook = {
  wallet: string;
  tickets: number;
  lamports: number;
  buys: number;
  ranges: string;
  chance: number;
};

export type LottoSplit = {
  rentLamports: number;
  claimableLamports: number;
  ticketLamports: number;
  seedLamports: number;
  winnerLamports: number;
  carryLamports: number;
};

export type LottoPostedWin = {
  round: number;
  pot: string;
  status:
    | "open"
    | "closed"
    | "randomness_requested"
    | "fulfilled"
    | "settled"
    | "claimed"
    | "void"
    | "refunding"
    | "refunded";
  startsAt: string;
  endsAt: string;
  tickets: number;
  winner: string | null;
  winnerIndex: number | null;
  jackpotLamports: number;
  carryLamports: number;
  ticketLamports: number;
  seedLamports: number;
  payoutKnown: boolean;
  verified: boolean;
  entropySlot: number | null;
  entropyHash: string | null;
};

export { drawFromPostedWin, lastPostedWin } from "./lotto-history";

export type LottoSnapshot = {
  pot: string;
  round: number;
  startsAt: string;
  endsAt: string;
  ticketPriceSol: number;
  ticketLamports: number;
  potLamports: number;
  potSol: number;
  roundLamports: number;
  roundSol: number;
  entries: LottoEntry[];
  slips: LottoSlip[];
  totalTickets: number;
  status: LottoStatus;
  draw: LottoDraw | null;
  last: LottoDraw | null;
  proof: LottoProof;
  message: string;
  engine: "program" | "wallet";
  currentRound: number;
  entropySlot: number | null;
  programId: string;
  configPda: string;
  feeWallet: string;
  wallets: LottoWalletBook[];
  split: LottoSplit;
  posted: LottoPostedWin[];
  ledger?: import("./lotto-ledger").LottoLedger;
  randomnessProvider?: string;
  vrfRequest?: string | null;
  vrfFulfilled?: boolean;
  vrfEntropy?: string | null;
  pendingWinner?: string | null;
  vrfTimeoutAt?: string | null;
  verifiedBuild?: boolean;
  upgradeable?: boolean;
  onchainStatus?: string;
  roundSecs?: number;
  authority?: string;
};

function envNumber(key: string, fallback: number) {
  const raw = Number(process.env[key] ?? "");
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

export function lottoPot() {
  return (process.env.NEXT_PUBLIC_LOTTO_POT ?? "").trim();
}

export function hasLottoPot() {
  return lottoPot().length >= 32;
}

export function lottoFeeWallet() {
  const raw = (process.env.NEXT_PUBLIC_LOTTO_FEE_WALLET ?? "").trim();
  return raw.length >= 32 ? raw : DEFAULT_LOTTO_FEE_WALLET;
}

export function slipFeeLamports(ticketLamports: number, tickets: number) {
  const sold = Math.max(0, Math.floor(ticketLamports)) * Math.max(0, Math.floor(tickets));
  return Math.floor((sold * LOTTO_SLIP_FEE_BPS) / LOTTO_SLIP_FEE_DENOM);
}

export function slipPotLamports(ticketLamports: number, tickets: number) {
  const sold = Math.max(0, Math.floor(ticketLamports)) * Math.max(0, Math.floor(tickets));
  return sold - slipFeeLamports(ticketLamports, tickets);
}

export function slipTotalLamports(ticketLamports: number, tickets: number) {
  return Math.max(0, Math.floor(ticketLamports)) * Math.max(0, Math.floor(tickets));
}

export function lottoTicketSol() {
  return envNumber("NEXT_PUBLIC_LOTTO_TICKET_SOL", DEFAULT_TICKET_SOL);
}

export function lottoTicketLamports() {
  return Math.round(lottoTicketSol() * 1_000_000_000);
}

export function lottoRoundMs() {
  return Math.round(envNumber("NEXT_PUBLIC_LOTTO_ROUND_HOURS", DEFAULT_ROUND_MS / 3_600_000) * 3_600_000);
}

export function lottoGenesisMs() {
  const raw = (process.env.NEXT_PUBLIC_LOTTO_GENESIS ?? DEFAULT_GENESIS).trim();
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : Date.parse(DEFAULT_GENESIS);
}

export function lottoRoundAt(now = Date.now()) {
  const genesis = lottoGenesisMs();
  const length = lottoRoundMs();
  const elapsed = Math.max(0, now - genesis);
  const round = Math.floor(elapsed / length);
  const startsAt = genesis + round * length;
  return {
    round,
    startsAt,
    endsAt: startsAt + length,
    drawAfter: startsAt + length + DRAW_LAG_SECONDS * 1000,
  };
}

export function lottoMemo(round: number, tickets: number) {
  return `${LOTTO_MEMO_PREFIX}:${round}:${tickets}`;
}

export function sortEntries(entries: LottoEntry[]) {
  return [...entries].sort((a, b) => {
    if (a.slot !== b.slot) return a.slot - b.slot;
    return a.signature.localeCompare(b.signature);
  });
}

export function slipsFromEntries(entries: LottoEntry[]): LottoSlip[] {
  const slips: LottoSlip[] = [];
  for (const entry of sortEntries(entries)) {
    for (let i = 0; i < entry.tickets; i += 1) {
      slips.push({
        index: slips.length,
        wallet: entry.wallet,
        signature: entry.signature,
      });
    }
  }
  return slips;
}

export function bookHashSource(slips: LottoSlip[]) {
  return slips.map((slip) => `${slip.index}:${slip.signature}:${slip.wallet}`).join("\n");
}

function toHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string) {
  const clean = hex.trim();
  const out = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16) || 0;
  }
  return out;
}

export async function sha256Bytes(data: Uint8Array) {
  const bytes = new Uint8Array(data.byteLength);
  bytes.set(data);
  if (globalThis.crypto?.subtle) {
    return new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes));
  }
  const { createHash } = await import("node:crypto");
  return new Uint8Array(createHash("sha256").update(bytes).digest());
}

export async function sha256Hex(value: string) {
  return toHex(await sha256Bytes(new TextEncoder().encode(value)));
}

export async function entropyFromBlockhash(blockhash: string) {
  const hash = await sha256Hex(blockhash);
  let value = BigInt(0);
  for (let i = 0; i < hash.length; i += 2) {
    value = (value << BigInt(8)) | BigInt(Number.parseInt(hash.slice(i, i + 2), 16));
  }
  return { hash, random: value.toString(16), value };
}

export async function winnerIndexFromBlockhash(blockhash: string, ticketCount: number) {
  const entropy = await entropyFromBlockhash(blockhash);
  if (ticketCount <= 0) return { ...entropy, index: 0 };
  return { ...entropy, index: Number(entropy.value % BigInt(ticketCount)) };
}

export async function winnerIndexFromSlotHash(slotHashHex: string, roundId: number, ticketCount: number) {
  const slotHash = hexToBytes(slotHashHex);
  const roundBuf = new Uint8Array(8);
  new DataView(roundBuf.buffer).setBigUint64(0, BigInt(roundId), true);
  const countBuf = new Uint8Array(4);
  new DataView(countBuf.buffer).setUint32(0, ticketCount, true);
  const payload = new Uint8Array(slotHash.length + roundBuf.length + countBuf.length);
  payload.set(slotHash, 0);
  payload.set(roundBuf, slotHash.length);
  payload.set(countBuf, slotHash.length + roundBuf.length);
  const digest = await sha256Bytes(payload);
  const hash = toHex(digest);
  const random = new DataView(digest.buffer, digest.byteOffset, 8).getBigUint64(0, false);
  if (ticketCount <= 0) return { hash, random: random.toString(16), value: random, index: 0 };
  return { hash, random: random.toString(16), value: random, index: Number(random % BigInt(ticketCount)) };
}

export async function makeDrawFromBlock(
  block: { slot: number; blockhash: string; blockTime: number },
  slips: LottoSlip[],
): Promise<LottoDraw | null> {
  if (slips.length === 0) return null;
  const entropy = await winnerIndexFromBlockhash(block.blockhash, slips.length);
  const slip = slips[entropy.index];
  if (!slip) return null;
  const check = await winnerIndexFromBlockhash(block.blockhash, slips.length);
  return {
    slot: block.slot,
    blockTime: block.blockTime,
    blockhash: block.blockhash,
    hash: entropy.hash,
    random: entropy.random,
    winnerIndex: entropy.index,
    winner: slip.wallet,
    winningSignature: slip.signature,
    verified: check.index === entropy.index && check.hash === entropy.hash,
  };
}

export async function verifyDraw(draw: LottoDraw, slips: LottoSlip[]) {
  if (slips.length === 0) return false;
  const entropy = await winnerIndexFromBlockhash(draw.blockhash, slips.length);
  const slip = slips[entropy.index];
  return (
    entropy.index === draw.winnerIndex &&
    entropy.hash === draw.hash &&
    slip?.wallet === draw.winner &&
    slip.signature === draw.winningSignature
  );
}

export async function verifyProgramDraw(draw: LottoDraw, slips: LottoSlip[], roundId: number) {
  if (slips.length === 0) return false;
  const entropy = await winnerIndexFromSlotHash(draw.blockhash, roundId, slips.length);
  const slip = slips[entropy.index];
  return entropy.index === draw.winnerIndex && slip?.wallet === draw.winner;
}

export function splitClaimable(claimableLamports: number, ticketLamportsSold: number): LottoSplit {
  const claimable = Math.max(0, Math.floor(claimableLamports));
  const tickets = Math.max(0, Math.floor(ticketLamportsSold));
  const winnerLamports = Math.floor((claimable * 85) / 100);
  const carryLamports = Math.max(0, claimable - winnerLamports);
  const seedLamports = Math.max(0, claimable - tickets);
  return {
    rentLamports: 0,
    claimableLamports: claimable,
    ticketLamports: tickets,
    seedLamports,
    winnerLamports,
    carryLamports,
  };
}

export function slipRange(fromIndex: number, tickets: number) {
  if (tickets <= 1) return String(fromIndex);
  return `${fromIndex}–${fromIndex + tickets - 1}`;
}

export function walletsFromEntries(entries: LottoEntry[], totalTickets: number): LottoWalletBook[] {
  const map = new Map<string, LottoWalletBook>();
  for (const row of entries) {
    const existing = map.get(row.wallet);
    const range = slipRange(row.slot, row.tickets);
    if (existing) {
      existing.tickets += row.tickets;
      existing.lamports += row.lamports;
      existing.buys += 1;
      existing.ranges = `${existing.ranges} · ${range}`;
    } else {
      map.set(row.wallet, {
        wallet: row.wallet,
        tickets: row.tickets,
        lamports: row.lamports,
        buys: 1,
        ranges: range,
        chance: 0,
      });
    }
  }
  const total = totalTickets > 0 ? totalTickets : 0;
  return [...map.values()]
    .map((row) => ({
      ...row,
      chance: total > 0 ? row.tickets / total : 0,
    }))
    .sort((a, b) => b.tickets - a.tickets || a.wallet.localeCompare(b.wallet));
}

export async function buildProof(input: {
  pot: string;
  round: number;
  startsAt: string;
  endsAt: string;
  entropyAfter: string;
  ticketLamports: number;
  slips: LottoSlip[];
  draw: LottoDraw | null;
  version?: string;
  rules?: typeof LOTTO_RULES | typeof PROGRAM_LOTTO_RULES | typeof PROGRAM_LOTTO_RULES_V2;
}): Promise<LottoProof> {
  return {
    version: input.version ?? LOTTO_PROOF_VERSION,
    pot: input.pot,
    round: input.round,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    entropyAfter: input.entropyAfter,
    ticketPriceLamports: input.ticketLamports,
    ticketCount: input.slips.length,
    bookHash: await sha256Hex(bookHashSource(input.slips)),
    slot: input.draw?.slot ?? null,
    blockhash: input.draw?.blockhash ?? null,
    sha256: input.draw?.hash ?? null,
    winnerIndex: input.draw?.winnerIndex ?? null,
    winner: input.draw?.winner ?? null,
    rules: input.rules ?? LOTTO_RULES,
  };
}

export function emptyLottoSnapshot(message: string): LottoSnapshot {
  const programmed = hasLottoProgram();
  const clock = lottoRoundAt();
  const startsAt = new Date(clock.startsAt).toISOString();
  const endsAt = new Date(clock.endsAt).toISOString();
  return {
    pot: lottoPot(),
    round: programmed ? 0 : clock.round,
    startsAt,
    endsAt,
    ticketPriceSol: lottoTicketSol(),
    ticketLamports: lottoTicketLamports(),
    potLamports: 0,
    potSol: 0,
    roundLamports: 0,
    roundSol: 0,
    entries: [],
    slips: [],
    totalTickets: 0,
    status: programmed ? "awaiting_round" : hasLottoPot() ? "open" : "awaiting_pot",
    draw: null,
    last: null,
    proof: {
      version: programmed ? LOTTO_PROGRAM_PROOF_VERSION : LOTTO_PROOF_VERSION,
      pot: lottoPot(),
      round: programmed ? 0 : clock.round,
      startsAt,
      endsAt,
      entropyAfter: programmed ? "slot pending" : new Date(clock.drawAfter).toISOString(),
      ticketPriceLamports: lottoTicketLamports(),
      ticketCount: 0,
      bookHash: "",
      slot: null,
      blockhash: null,
      sha256: null,
      winnerIndex: null,
      winner: null,
      rules: programmed ? PROGRAM_LOTTO_RULES : LOTTO_RULES,
    },
    message,
    engine: programmed ? "program" : "wallet",
    currentRound: programmed ? 0 : clock.round,
    entropySlot: null,
    programId: programmed ? lottoProgramId() : "",
    configPda: "",
    feeWallet: lottoFeeWallet(),
    wallets: [],
    split: splitClaimable(0, 0),
    posted: [],
    ledger: EMPTY_LEDGER,
    randomnessProvider: programmed ? (isLottoV2() ? "ORAO VRF Classic" : "Solana SlotHashes") : "wallet blockhash",
    vrfRequest: null,
    vrfFulfilled: false,
    vrfEntropy: null,
    pendingWinner: null,
    vrfTimeoutAt: null,
    verifiedBuild: false,
    upgradeable: true,
    onchainStatus: "",
    roundSecs: Math.round(lottoRoundMs() / 1000),
    authority: "",
  };
}
