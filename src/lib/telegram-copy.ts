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
export const TELEGRAM_SITE = "https://petrock.fun";
export const TELEGRAM_LOTTO_CLIP = `${TELEGRAM_SITE}/media/tg/lotto-rock.mp4`;

export type TelegramGuest = {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  username?: string;
};

export type KennelPhotoKind = "hour" | "open" | "winner" | "pulse";

const PHOTO_SRC: Record<KennelPhotoKind, string[]> = {
  hour: ["/memes/tg/08-red-rings.webp", "/memes/tg/03-here-we-go.webp", "/memes/tg/07-paper-hands.webp"],
  open: ["/memes/tg/09-green-rings.webp", "/memes/tg/02-lining.webp", "/memes/tg/06-first-class.webp", "/memes/tg/19-premiere.webp"],
  winner: ["/memes/tg/20-throne.webp", "/memes/tg/21-hodl.webp", "/memes/tg/24-posted.webp", "/memes/tg/33-peek.webp"],
  pulse: ["/memes/tg/01-rebuttal.webp", "/memes/tg/05-chart-eye.webp", "/memes/tg/25-executive.webp"],
};

export function kennelPhotoUrl(kind: KennelPhotoKind, salt = 0) {
  const files = PHOTO_SRC[kind];
  return `${TELEGRAM_SITE}${files[Math.abs(salt) % files.length]}`;
}

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

export const LAST_HOUR_MS = 60 * 60 * 1000;
export const LAST_HOUR_OPEN_MS = 58 * 60 * 1000;
export const POT_MILESTONES_SOL = [5, 10, 25, 50, 100] as const;
const TICKET_PACK = 1_000_000;
const MILE_PACK = 1_000;

export function playReplyMarkup(label = "▶️ Play") {
  return {
    inline_keyboard: [[{ text: label, url: TELEGRAM_PLAY_URL }]],
  };
}

export function packRoundTickets(round: number, tickets: number) {
  return Math.max(0, round) * TICKET_PACK + Math.max(0, tickets);
}

export function unpackRoundTickets(value: number) {
  return { round: Math.floor(value / TICKET_PACK), tickets: value % TICKET_PACK };
}

export function packRoundMile(round: number, mile: number) {
  return Math.max(0, round) * MILE_PACK + Math.max(0, mile);
}

export function unpackRoundMile(value: number) {
  return { round: Math.floor(value / MILE_PACK), mile: value % MILE_PACK };
}

export function crossedPotMilestones(prevSol: number, winnerLamports: number) {
  const sol = winnerLamports / 1e9;
  return POT_MILESTONES_SOL.filter((n) => n > prevSol && sol >= n);
}

export function highestPotMilestone(winnerLamports: number) {
  return [...POT_MILESTONES_SOL].reverse().find((n) => winnerLamports / 1e9 >= n) ?? 0;
}

export function isRollingStatus(status: LottoStatus) {
  return status === "awaiting_vrf_request" || status === "awaiting_vrf";
}

export function remainingMs(endsAt: string, nowMs: number) {
  const end = Date.parse(endsAt);
  if (!Number.isFinite(end)) return null;
  return end - nowMs;
}

export function isLastHour(endsAt: string, nowMs: number) {
  const ms = remainingMs(endsAt, nowMs);
  return ms != null && ms > 0 && ms <= LAST_HOUR_MS;
}

export function isLastHourOpen(endsAt: string, nowMs: number) {
  const ms = remainingMs(endsAt, nowMs);
  return ms != null && ms > LAST_HOUR_OPEN_MS && ms <= LAST_HOUR_MS;
}

export function remainingLabel(endsAt: string, nowMs: number) {
  const ms = remainingMs(endsAt, nowMs);
  if (ms == null) return "clock unknown";
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
  if (name === "last" || name === "winner") return "last";
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

export function mentionUser(user: TelegramGuest) {
  const username = user.username?.trim();
  if (username) return `@${escapeHtml(username)}`;
  const name = (user.first_name ?? "").trim() || "rock";
  return `<a href="tg://user?id=${user.id}">${escapeHtml(name)}</a>`;
}

export function humanJoiners(users: TelegramGuest[] | undefined) {
  return (users ?? []).filter((user) => !user.is_bot && Number.isFinite(user.id));
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

export function formatLastHour(tape: TelegramPotTape, nowMs: number) {
  const payout = solFromLamports(tape.split.winnerLamports);
  const slips = formatCount(tape.totalTickets) ?? "0";
  const potLine =
    tape.totalTickets > 0 ? ` <b>${escapeHtml(payout)}</b>` : " No slips yet";
  return [
    "⏱ <b>Last hour</b>",
    "",
    `🪨 Rock ${tape.round}`,
    potLine,
    `🎫 ${escapeHtml(slips)} slips · ${escapeHtml(String(tape.ticketPriceSol))} SOL a slip`,
    `⏱ ${escapeHtml(remainingLabel(tape.endsAt, nowMs))}`,
    "",
    `▶️ <a href="${TELEGRAM_PLAY_URL}">Play</a> · 📜 <a href="${programUrl(tape.programId || TELEGRAM_PROGRAM_ID)}">Verified contract</a>`,
  ].join("\n");
}

export function formatNewRock(tape: TelegramPotTape, nowMs: number) {
  const seed = solFromLamports(tape.split.claimableLamports);
  return [
    `🪨 <b>Rock ${tape.round} is open</b>`,
    "",
    `🌱 Seeded with <b>${escapeHtml(seed)}</b>`,
    `🎫 ${escapeHtml(String(tape.ticketPriceSol))} SOL a slip`,
    `⏱ ${escapeHtml(remainingLabel(tape.endsAt, nowMs))}`,
    "",
    `▶️ <a href="${TELEGRAM_PLAY_URL}">Play</a> · 📜 <a href="${programUrl(tape.programId || TELEGRAM_PROGRAM_ID)}">Verified contract</a>`,
  ].join("\n");
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
    "🏆 /last — last paid rock",
    "🔎 /verify — rematch the last paid rock",
    "❓ /help — this list",
    "",
    `▶️ <a href="${TELEGRAM_PLAY_URL}">Play</a> · 📜 <a href="${programUrl()}">Verified contract</a>`,
  ].join("\n");
}

export function formatLastWin(win: TelegramWinTape | null) {
  if (!win) return "No paid rock yet. Buy a slip and the last winner will show here after payout.";
  return [
    `🏆 <b>Last rock ${win.round}</b>`,
    "",
    `Winner\n${walletLink(win.winner)}`,
    `🎫 Slip ${formatCount(win.winnerIndex)}`,
    ` <b>${escapeHtml(solFromLamports(win.jackpotLamports))}</b>`,
    "",
    `🔗 <a href="${verifyUrl(win.round)}">Verify</a> · <a href="${walletUrl(win.winner)}">Solscan txs</a>`,
    `▶️ <a href="${TELEGRAM_PLAY_URL}">Play</a> · 📜 <a href="${programUrl(win.programId)}">Verified contract</a>`,
  ].join("\n");
}

export function formatBuyCheer(tape: TelegramPotTape, added: number) {
  const pot = solFromLamports(tape.split.winnerLamports);
  const slips = formatCount(tape.totalTickets) ?? "0";
  const extra = Math.max(1, added);
  return [
    `🎫 <b>+${formatCount(extra)} ${extra === 1 ? "slip" : "slips"}</b> just landed`,
    "",
    ` The pot is now <b>${escapeHtml(pot)}</b>`,
    `🎫 ${escapeHtml(slips)} slips · ${escapeHtml(String(tape.ticketPriceSol))} SOL a slip`,
    "",
    "Enter for your chance to win!",
    `▶️ <a href="${TELEGRAM_PLAY_URL}">Play</a>`,
  ].join("\n");
}

export function formatMilestone(tape: TelegramPotTape, mile: number) {
  return [
    ` The pot just crossed <b>${escapeHtml(String(mile))} SOL</b>`,
    "",
    `🪨 Rock ${tape.round}`,
    `🎫 ${escapeHtml(formatCount(tape.totalTickets) ?? "0")} slips · ${escapeHtml(String(tape.ticketPriceSol))} SOL a slip`,
    "",
    "Enter for your chance to win!",
    `▶️ <a href="${TELEGRAM_PLAY_URL}">Play</a>`,
  ].join("\n");
}

export function formatRolling(tape: TelegramPotTape) {
  const pot = solFromLamports(tape.split.winnerLamports);
  return [
    `🪨 <b>Rock ${tape.round} is rolling</b>`,
    "",
    ` ${escapeHtml(pot)}`,
    `🎫 ${escapeHtml(formatCount(tape.totalTickets) ?? "0")} slips`,
    "",
    "The rock is picking a wallet.",
    `▶️ <a href="${TELEGRAM_PLAY_URL}">Play the next rock</a> · 📜 <a href="${programUrl(tape.programId || TELEGRAM_PROGRAM_ID)}">Verified contract</a>`,
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

export function formatWelcome(guests: TelegramGuest[], tape?: TelegramPotTape | null, nowMs = Date.now()) {
  const who = humanJoiners(guests).map(mentionUser).join(" · ") || "rock";
  const price = tape ? String(tape.ticketPriceSol) : "0.05";
  const pot = tape ? solFromLamports(tape.split.winnerLamports) : null;
  const potLine =
    pot && tape && tape.split.winnerLamports > 0
      ? ` The pot is <b>${escapeHtml(pot)}</b>`
      : " The pot is open · first slips fill it";
  const clock = tape ? remainingLabel(tape.endsAt, nowMs) : "48h rounds";
  const slips = tape ? `${formatCount(tape.totalTickets) ?? "0"} slips in` : "buy a slip";
  return [
    `🪨 Welcome ${who}`,
    "",
    potLine,
    `🎫 ${escapeHtml(price)} SOL a slip · ${escapeHtml(slips)}`,
    `⏱ ${escapeHtml(clock)}`,
    "",
    "Enter for your chance to win!",
    "",
    `▶️ <a href="${TELEGRAM_PLAY_URL}">Play</a> · 📜 <a href="${programUrl(tape?.programId)}">Verified contract</a>`,
  ].join("\n");
}
