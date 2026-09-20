import "server-only";

import { getLottoSnapshot } from "@/lib/lotto-chain";
import { lastPostedWin } from "@/lib/lotto-history";
import type { LottoSnapshot } from "@/lib/lotto";
import { verifyRoundIndependent } from "@/lib/lotto-verify";
import { sendKennelMessage, telegramConfigured } from "@/lib/telegram-bot";
import {
  formatJackpot,
  formatLastHour,
  formatNewRock,
  formatPulse,
  formatVerify,
  formatWinner,
  isLastHour,
  isLastHourOpen,
} from "@/lib/telegram-copy";
import { markedRound, markRound, telegramStatePersistent } from "@/lib/telegram-state";

function winFromTape(tape: LottoSnapshot) {
  const posted = lastPostedWin(tape.posted);
  if (!posted?.winner || posted.winnerIndex == null) return null;
  return {
    round: posted.round,
    winner: posted.winner,
    winnerIndex: posted.winnerIndex,
    tickets: posted.tickets,
    jackpotLamports: posted.jackpotLamports,
    carryLamports: posted.carryLamports,
    ticketLamports: posted.ticketLamports,
    pot: posted.pot,
    programId: tape.programId,
  };
}

async function receiptFor(round: number) {
  try {
    return await verifyRoundIndependent({ roundId: round });
  } catch {
    return null;
  }
}

export async function maybeAnnounceWinner(input: { tape?: LottoSnapshot; justPaid?: boolean } = {}) {
  if (!telegramConfigured()) return { skipped: true as const, reason: "telegram not configured" };
  const tape = input.tape ?? (await getLottoSnapshot(true));
  const win = winFromTape(tape);
  if (!win) return { skipped: true as const, reason: "no paid rock yet", round: tape.round };

  const announced = await markedRound("win");
  if (announced != null && announced >= win.round) {
    return { skipped: true as const, reason: "already announced", round: win.round };
  }
  if (announced == null && !input.justPaid && !telegramStatePersistent()) {
    return { skipped: true as const, reason: "no store; wait for payout crank or pulse mention", round: win.round };
  }

  const receipt = await receiptFor(win.round);
  const sent = await sendKennelMessage(formatWinner(win, receipt));
  await markRound("win", win.round);
  return { skipped: sent.skipped, reason: "reason" in sent ? sent.reason : undefined, round: win.round, messageId: "messageId" in sent ? sent.messageId : undefined };
}

export async function maybeAnnounceNewRock(input: { tape?: LottoSnapshot; justOpened?: boolean; nowMs?: number } = {}) {
  if (!telegramConfigured()) return { skipped: true as const, reason: "telegram not configured" };
  const tape = input.tape ?? (await getLottoSnapshot(true));
  if (tape.status !== "open") {
    return { skipped: true as const, reason: "next rock is not open", round: tape.round };
  }

  const announced = await markedRound("open");
  if (announced != null && announced >= tape.round) {
    return { skipped: true as const, reason: "already announced", round: tape.round };
  }
  if (announced == null && !input.justOpened) {
    await markRound("open", tape.round);
    return { skipped: true as const, reason: "remembered live rock without posting", round: tape.round };
  }

  const sent = await sendKennelMessage(formatNewRock(tape, input.nowMs ?? Date.now()));
  await markRound("open", tape.round);
  return { skipped: sent.skipped, reason: "reason" in sent ? sent.reason : undefined, round: tape.round, messageId: "messageId" in sent ? sent.messageId : undefined };
}

export async function maybeAnnounceLastHour(input: { tape?: LottoSnapshot; nowMs?: number } = {}) {
  if (!telegramConfigured()) return { skipped: true as const, reason: "telegram not configured" };
  const tape = input.tape ?? (await getLottoSnapshot(true));
  const nowMs = input.nowMs ?? Date.now();
  if (tape.status !== "open" || !isLastHour(tape.endsAt, nowMs)) {
    return { skipped: true as const, reason: "not the last hour", round: tape.round };
  }

  const warned = await markedRound("hour");
  if (warned === tape.round) {
    return { skipped: true as const, reason: "already warned", round: tape.round };
  }
  if (warned == null && !telegramStatePersistent() && !isLastHourOpen(tape.endsAt, nowMs)) {
    return { skipped: true as const, reason: "missed the first minute of last hour", round: tape.round };
  }

  const sent = await sendKennelMessage(formatLastHour(tape, nowMs));
  await markRound("hour", tape.round);
  return { skipped: sent.skipped, reason: "reason" in sent ? sent.reason : undefined, round: tape.round, messageId: "messageId" in sent ? sent.messageId : undefined };
}

export async function runKennelDesk(input: { tape?: LottoSnapshot; justPaid?: boolean; justOpened?: boolean } = {}) {
  if (!telegramConfigured()) return { skipped: true as const, reason: "telegram not configured" };
  const tape =
    input.justPaid || input.justOpened || !input.tape ? await getLottoSnapshot(true) : input.tape;
  const winner = await maybeAnnounceWinner({ tape, justPaid: input.justPaid });
  const opened = await maybeAnnounceNewRock({ tape, justOpened: input.justOpened });
  const hour = await maybeAnnounceLastHour({ tape });
  return { skipped: false as const, winner, opened, hour, round: tape.round };
}

export async function pulseKennel(nowMs = Date.now()) {
  if (!telegramConfigured()) return { skipped: true as const, reason: "telegram not configured" };
  const tape = await getLottoSnapshot(true);
  const sent = await sendKennelMessage(formatPulse(tape, nowMs));
  const desk = await runKennelDesk({ tape, justPaid: false, justOpened: false });
  return { skipped: sent.skipped, pulse: sent, desk };
}

export async function jackpotText(nowMs = Date.now()) {
  const tape = await getLottoSnapshot(true);
  return formatJackpot(tape, nowMs);
}

export async function verifyText() {
  const tape = await getLottoSnapshot(true);
  const win = winFromTape(tape);
  const receipt = win ? await receiptFor(win.round) : null;
  return formatVerify(win, receipt);
}
