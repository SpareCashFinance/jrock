export const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96QnTrNe2EtkZ";
export const LOTTO_MEMO_PREFIX = "jrock-lotto";

const DEFAULT_GENESIS = "2026-09-14T00:00:00.000Z";
const DEFAULT_ROUND_MS = 72 * 60 * 60 * 1000;
const DEFAULT_TICKET_SOL = 0.05;
const DRAW_LAG_SECONDS = 15;

export type LottoEntry = {
  wallet: string;
  tickets: number;
  lamports: number;
  signature: string;
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
  random: string;
  winnerIndex: number;
  winner: string;
  winningSignature: string;
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

export function decodeBase58(value: string) {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const bytes: number[] = [0];
  for (const char of value) {
    const digit = alphabet.indexOf(char);
    if (digit < 0) throw new Error("Invalid blockhash");
    let carry = digit;
    for (let i = 0; i < bytes.length; i += 1) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 255;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 255);
      carry >>= 8;
    }
  }
  for (const char of value) {
    if (char !== "1") break;
    bytes.push(0);
  }
  return Uint8Array.from(bytes.reverse());
}

export function randomFromBlockhash(blockhash: string) {
  const bytes = decodeBase58(blockhash);
  let value = BigInt(0);
  for (const byte of bytes) {
    value = (value << BigInt(8)) | BigInt(byte);
  }
  return value;
}

export function winnerIndexFromBlockhash(blockhash: string, ticketCount: number) {
  if (ticketCount <= 0) return 0;
  return Number(randomFromBlockhash(blockhash) % BigInt(ticketCount));
}

export function slipsFromEntries(entries: LottoEntry[]): LottoSlip[] {
  const slips: LottoSlip[] = [];
  for (const entry of entries) {
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

export function emptyLottoSnapshot(message: string): LottoSnapshot {
  const clock = lottoRoundAt();
  return {
    pot: lottoPot(),
    round: clock.round,
    startsAt: new Date(clock.startsAt).toISOString(),
    endsAt: new Date(clock.endsAt).toISOString(),
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
    message,
  };
}
