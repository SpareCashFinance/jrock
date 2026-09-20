import "server-only";

import { getLottoSnapshot } from "@/lib/lotto-chain";
import { lastPostedWin } from "@/lib/lotto-history";
import type { LottoSnapshot } from "@/lib/lotto";
import { verifyRoundIndependent } from "@/lib/lotto-verify";
import { sendKennelMessage, telegramConfigured } from "@/lib/telegram-bot";
import { formatJackpot, formatPulse, formatVerify, formatWinner } from "@/lib/telegram-copy";
import { lastAnnouncedRound, markAnnouncedRound, telegramStatePersistent } from "@/lib/telegram-state";

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
  const tape = input.justPaid || !input.tape ? await getLottoSnapshot(true) : input.tape;
  const win = winFromTape(tape);
  if (!win) return { skipped: true as const, reason: "no paid rock yet", round: tape.round };

  const announced = await lastAnnouncedRound();
  if (announced != null && announced >= win.round) {
    return { skipped: true as const, reason: "already announced", round: win.round };
  }
  if (announced == null && !input.justPaid && !telegramStatePersistent()) {
    return { skipped: true as const, reason: "no store; wait for payout crank or pulse mention", round: win.round };
  }

  const receipt = await receiptFor(win.round);
  const sent = await sendKennelMessage(formatWinner(win, receipt));
  await markAnnouncedRound(win.round);
  return { skipped: sent.skipped, reason: "reason" in sent ? sent.reason : undefined, round: win.round, messageId: "messageId" in sent ? sent.messageId : undefined };
}

export async function pulseKennel(nowMs = Date.now()) {
  if (!telegramConfigured()) return { skipped: true as const, reason: "telegram not configured" };
  const tape = await getLottoSnapshot(true);
  const sent = await sendKennelMessage(formatPulse(tape, nowMs));
  const winner = await maybeAnnounceWinner({ tape, justPaid: false });
  return { skipped: sent.skipped, pulse: sent, winner };
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
