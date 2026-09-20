import type { LottoPostedWin, LottoSnapshot, LottoStatus } from "./lotto";

function formatAmount(value: number, digits = 4) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(value);
}

function formatCount(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function shortenAddress(value: string, size = 4) {
  const trimmed = value.trim();
  if (trimmed.length <= size * 2 + 3) return trimmed;
  return `${trimmed.slice(0, size)}…${trimmed.slice(-size)}`;
}

export const TELEGRAM_PLAY_URL = "https://petrock.fun/lotto";
export const TELEGRAM_VERIFY_URL = "https://petrock.fun/lotto/verify";
export const TELEGRAM_PROGRAM_ID = "66FyiUTkw4JMYMi3yErfa7UBqrHm9GZha1meAxcgbjDg";

export type TelegramPotTape = Pick<
  LottoSnapshot,
  "round" | "status" | "endsAt" | "ticketPriceSol" | "totalTickets" | "split" | "programId"
> & {
  posted?: LottoPostedWin[];
};

export type TelegramWinTape = {
  round: number;
  winner: string;
  winnerIndex: number;
  tickets: number;
  jackpotLamports: number;
  carryLamports: number;
  ticketLamports: number;
  pot?: string;
  programId?: string;
};

export type TelegramReceiptTape = {
  matches: boolean | null;
  storedWinner?: string | null;
  storedWinnerIndex?: number | null;
  computedWinner?: string | null;
  computedWinnerIndex?: number | null;
  ledger?: {
    winnerPayoutLamports: number;
    nextRoundSeedLamports: number;
    ticketGrossLamports?: number;
    distributablePotLamports?: number;
  };
  programId?: string;
  vrfRequest?: string | null;
};

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function solFromLamports(lamports: number, digits = 4) {
  return `${formatAmount(lamports / 1e9, digits) ?? "0"} SOL`;
}

export function remainingLabel(endsAt: string, nowMs: number) {
  const end = Date.parse(endsAt);
  if (!Number.isFinite(end)) return "clock unknown";
  const ms = end - nowMs;
  if (ms <= 0) return "sales ended";
  const totalMin = Math.floor(ms / 60_000);
  const days = Math.floor(totalMin / 1_440);
  const hours = Math.floor((totalMin % 1_440) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

export function phaseLine(status: LottoStatus, ended: boolean) {
  if (status === "open" && !ended) return "live";
  if (status === "open" && ended) return "sales ended";
  if (status === "awaiting_vrf_request" || status === "awaiting_vrf") return "waiting on ORAO";
  if (status === "awaiting_settle" || status === "awaiting_block" || status === "drawn") return "paying out";
  if (status === "claimed") return "paid";
  if (status === "void") return "no slips";
  if (status === "awaiting_round") return "opening next rock";
  return status.replaceAll("_", " ");
}

export function parseTelegramCommand(text: string | undefined) {
  const raw = (text ?? "").trim();
  if (!raw.startsWith("/")) return null;
  const [first] = raw.split(/\s+/, 1);
  const name = first.slice(1).split("@", 1)[0]?.toLowerCase() ?? "";
  if (name === "jackpot" || name === "pot" || name === "rock") return "jackpot";
  if (name === "verify") return "verify";
  if (name === "help" || name === "start") return name;
  return null;
}

export function programUrl(programId = TELEGRAM_PROGRAM_ID) {
  return `https://solscan.io/account/${programId}`;
}

export function walletUrl(wallet: string) {
  return `https://solscan.io/account/${wallet}#transfers`;
}

export function walletLink(wallet: string, short = false) {
  const raw = wallet.trim();
  if (!raw) return "";
  const label = short ? shortenAddress(raw, 6) : raw;
  return `<a href="${walletUrl(raw)}">${escapeHtml(label)}</a>`;
}

export function verifyUrl(round: number) {
  return `${TELEGRAM_VERIFY_URL}?round=${round}`;
}

function lastWinLine(posted: LottoPostedWin[] | undefined) {
  const win = posted?.find(
    (row) =>
      Boolean(row.winner) &&
      row.winnerIndex != null &&
      (row.status === "claimed" || row.status === "settled"),
  );
  if (!win?.winner || win.winnerIndex == null) return "";
  return `🏆 Last rock · slip ${formatCount(win.winnerIndex)} · ${solFromLamports(win.jackpotLamports)} · ${walletLink(win.winner, true)}`;
}

export function formatPulse(tape: TelegramPotTape, nowMs: number, opts: { jackpot?: boolean } = {}) {
  const ended = remainingLabel(tape.endsAt, nowMs) === "sales ended";
  const phase = phaseLine(tape.status, ended);
  const clock = ended ? phaseLine(tape.status, true) : remainingLabel(tape.endsAt, nowMs);
  const slips = formatCount(tape.totalTickets) ?? "0";
  const payout = solFromLamports(tape.split.winnerLamports);
  const seed = solFromLamports(tape.split.carryLamports);
  const potLine =
    tape.totalTickets > 0
      ? ` <b>${escapeHtml(payout)}</b>`
      : " No slips yet";
  const extra = opts.jackpot
    ? [`📅 Ends ${escapeHtml(tape.endsAt)}`, `🌱 15% seeds the next rock (${escapeHtml(seed)})`]
    : [];
  return [
    `🪨 <b>Rock ${tape.round}</b> · ${escapeHtml(phase)}`,
    "",
    potLine,
    `🎫 ${escapeHtml(slips)} slips · ${escapeHtml(String(tape.ticketPriceSol))} SOL a slip`,
    `⏱ ${escapeHtml(clock)}`,
    ...extra,
    "",
    `▶️ <a href="${TELEGRAM_PLAY_URL}">Play</a> · 📜 <a href="${programUrl(tape.programId || TELEGRAM_PROGRAM_ID)}">Verified contract</a>`,
    lastWinLine(tape.posted),
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export function formatJackpot(tape: TelegramPotTape, nowMs: number) {
  return formatPulse(tape, nowMs, { jackpot: true });
}

export function formatWinner(win: TelegramWinTape, receipt?: TelegramReceiptTape | null) {
  const paid = solFromLamports(receipt?.ledger?.winnerPayoutLamports ?? win.jackpotLamports);
  const tickets = solFromLamports(receipt?.ledger?.distributablePotLamports ?? win.ticketLamports);
  const seed = solFromLamports(receipt?.ledger?.nextRoundSeedLamports ?? win.carryLamports);
  const programId = receipt?.programId || win.programId || TELEGRAM_PROGRAM_ID;
  const rematch =
    receipt?.matches == null
      ? "Rematch pending"
      : receipt.matches
        ? "Rematch: matches"
        : "Rematch: does not match stored winner";
  return [
    `🏆 <b>Rock ${win.round} is paid.</b>`,
    "",
    `Winner\n${walletLink(win.winner)}`,
    `🎫 Slip ${formatCount(win.winnerIndex)}`,
    "",
    ` <b>${escapeHtml(paid)}</b>`,
    `🎫 ${escapeHtml(formatCount(win.tickets) ?? "0")} slips · ${escapeHtml(tickets)} tickets`,
    `🌱 ${escapeHtml(seed)} seeded the next rock`,
    "",
    rematch.startsWith("Rematch: matches") ? `✅ ${escapeHtml(rematch)}` : `🔎 ${escapeHtml(rematch)}`,
    `🔗 <a href="${verifyUrl(win.round)}">Verify</a> · <a href="${walletUrl(win.winner)}">Solscan txs</a>`,
    `▶️ <a href="${TELEGRAM_PLAY_URL}">Play the next rock</a> · 📜 <a href="${programUrl(programId)}">Verified contract</a>`,
  ].join("\n");
}

export function formatVerify(win: TelegramWinTape | null, receipt?: TelegramReceiptTape | null) {
  if (!win) return "No paid rock yet. Buy a slip and the rematch will show here after payout.";
  const match =
    receipt?.matches == null
      ? "Rematch is not ready yet."
      : receipt.matches
        ? "Independent rematch matches the stored winner."
        : "Independent rematch does not match the stored winner.";
  return [
    `🔎 <b>Rock ${win.round}</b>`,
    `Stored ${walletLink(receipt?.storedWinner || win.winner)} · slip ${formatCount(receipt?.storedWinnerIndex ?? win.winnerIndex)}`,
    receipt?.computedWinner
      ? `Recomputed ${walletLink(receipt.computedWinner)} · slip ${formatCount(receipt.computedWinnerIndex ?? -1)}`
      : "Recomputed winner pending.",
    receipt?.matches ? `✅ ${escapeHtml(match)}` : `🔎 ${escapeHtml(match)}`,
    `🔗 <a href="${verifyUrl(win.round)}">Open the rematch page</a> · 📜 <a href="${programUrl(receipt?.programId || win.programId)}">Verified contract</a>`,
  ].join("\n");
}

export function formatHelp() {
  return [
    "🪨 <b>Kennel desk</b>",
    "",
    " /jackpot — live pot, slips, time left",
    "🔎 /verify — rematch the last paid rock",
    "❓ /help — this list",
    "",
    `▶️ <a href="${TELEGRAM_PLAY_URL}">Play</a> · 📜 <a href="${programUrl()}">Verified contract</a>`,
  ].join("\n");
}

export function formatStart() {
  return [
    "🪨 The kennel lotto is on-chain.",
    "",
    "Buy a slip. 0.05 SOL. 48 hours. If anyone buys, the rock always picks one of those wallets.",
    "",
    " /jackpot for the live pot.",
    `▶️ <a href="${TELEGRAM_PLAY_URL}">petrock.fun/lotto</a>`,
  ].join("\n");
}
