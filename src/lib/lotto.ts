export const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96QnTrNe2EtkZ";
export const LOTTO_MEMO_PREFIX = "jrock-lotto";
export const LOTTO_PROOF_VERSION = "jrock-lotto-v2";
export const DRAW_LAG_SECONDS = 60;

const DEFAULT_GENESIS = "2026-09-14T00:00:00.000Z";
const DEFAULT_ROUND_MS = 72 * 60 * 60 * 1000;
const DEFAULT_TICKET_SOL = 0.05;

export const LOTTO_RULES = {
  version: LOTTO_PROOF_VERSION,
  ticket: "Count floor(lamports / ticket_price) for each successful SOL transfer into the pot.",
  window: "A transfer counts only if its blockTime is >= round start and < round end.",
  order: "Sort entries by slot ascending, then signature ascending. Expand each entry into that many slips.",
  entropy: `First finalized Solana block whose blockTime is >= round end + ${DRAW_LAG_SECONDS}s.`,
  formula: "winnerIndex = sha256(utf8(blockhash)) as big-endian integer, modulo slip count.",
  payout: "The pot wallet pays the winning slip. Randomness is on-chain; payout is still a kennel transfer.",
} as const;

export type LottoEntry = {
  wallet: string;
  tickets: number;
  lamports: number;
  signature: string;
  slot: number;
  at: string;
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
  rules: typeof LOTTO_RULES;
};

export type LottoStatus = "awaiting_pot" | "open" | "awaiting_block" | "void" | "drawn";

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

export async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  if (globalThis.crypto?.subtle) {
    const digest = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", data));
    return toHex(digest);
  }
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(value).digest("hex");
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

export async function buildProof(input: {
  pot: string;
  round: number;
  startsAt: string;
  endsAt: string;
  entropyAfter: string;
  ticketLamports: number;
  slips: LottoSlip[];
  draw: LottoDraw | null;
}): Promise<LottoProof> {
  return {
    version: LOTTO_PROOF_VERSION,
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
    rules: LOTTO_RULES,
  };
}

export function emptyLottoSnapshot(message: string): LottoSnapshot {
  const clock = lottoRoundAt();
  const startsAt = new Date(clock.startsAt).toISOString();
  const endsAt = new Date(clock.endsAt).toISOString();
  return {
    pot: lottoPot(),
    round: clock.round,
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
    status: hasLottoPot() ? "open" : "awaiting_pot",
    draw: null,
    last: null,
    proof: {
      version: LOTTO_PROOF_VERSION,
      pot: lottoPot(),
      round: clock.round,
      startsAt,
      endsAt,
      entropyAfter: new Date(clock.drawAfter).toISOString(),
      ticketPriceLamports: lottoTicketLamports(),
      ticketCount: 0,
      bookHash: "",
      slot: null,
      blockhash: null,
      sha256: null,
      winnerIndex: null,
      winner: null,
      rules: LOTTO_RULES,
    },
    message,
  };
}
