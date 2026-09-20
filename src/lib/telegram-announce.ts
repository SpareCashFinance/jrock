import "server-only";

import { getLottoSnapshot } from "@/lib/lotto-chain";
import { lastPostedWin } from "@/lib/lotto-history";
import type { LottoSnapshot } from "@/lib/lotto";
import { verifyRoundIndependent } from "@/lib/lotto-verify";
import { sendKennelCard, sendKennelClip, sendKennelXPost, telegramConfigured } from "@/lib/telegram-bot";
import {
  crossedPotMilestones,
  formatBuyCheer,
  formatJackpot,
  formatLastHour,
  formatLastWin,
  formatMilestone,
  formatNewRock,
  formatPulse,
  formatRolling,
  formatVerify,
  formatWelcome,
  formatWinner,
  formatXPost,
  highestPotMilestone,
  humanJoiners,
  isLastHour,
  isLastHourOpen,
  isRollingStatus,
  kennelPhotoUrl,
  packRoundMile,
  packRoundTickets,
  unpackRoundMile,
  unpackRoundTickets,
  type TelegramGuest,
} from "@/lib/telegram-copy";
import { markedRound, markedText, markRound, markText, telegramStatePersistent } from "@/lib/telegram-state";
import { latestKennelTweets, xConfigured } from "@/lib/x-feed";

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
  const sent = await sendKennelCard(formatWinner(win, receipt), kennelPhotoUrl("winner", win.round));
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

  const sent = await sendKennelCard(formatNewRock(tape, input.nowMs ?? Date.now()), kennelPhotoUrl("open", tape.round));
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

  const sent = await sendKennelCard(formatLastHour(tape, nowMs), kennelPhotoUrl("hour", tape.round));
  await markRound("hour", tape.round);
  return { skipped: sent.skipped, reason: "reason" in sent ? sent.reason : undefined, round: tape.round, messageId: "messageId" in sent ? sent.messageId : undefined };
}

export async function maybeAnnounceRolling(input: { tape?: LottoSnapshot; justRolling?: boolean } = {}) {
  if (!telegramConfigured()) return { skipped: true as const, reason: "telegram not configured" };
  const tape = input.tape ?? (await getLottoSnapshot(true));
  if (!isRollingStatus(tape.status) || tape.totalTickets <= 0) {
    return { skipped: true as const, reason: "rock is not rolling", round: tape.round };
  }

  const announced = await markedRound("roll");
  if (announced != null && announced >= tape.round) {
    return { skipped: true as const, reason: "already rolling", round: tape.round };
  }
  if (announced == null && !input.justRolling && !telegramStatePersistent()) {
    await markRound("roll", tape.round);
    return { skipped: true as const, reason: "remembered a live roll without posting", round: tape.round };
  }

  const sent = await sendKennelCard(formatRolling(tape), kennelPhotoUrl("hour", tape.round));
  await markRound("roll", tape.round);
  return { skipped: sent.skipped, reason: "reason" in sent ? sent.reason : undefined, round: tape.round, messageId: "messageId" in sent ? sent.messageId : undefined };
}

export async function maybeAnnounceHeat(input: { tape?: LottoSnapshot } = {}) {
  if (!telegramConfigured()) return { skipped: true as const, reason: "telegram not configured" };
  const tape = input.tape ?? (await getLottoSnapshot(true));
  if (tape.status !== "open") {
    return { skipped: true as const, reason: "sales are not open", round: tape.round };
  }

  const packedTickets = await markedRound("tickets");
  const packedMile = await markedRound("mile");
  if (packedTickets == null) {
    await markRound("tickets", packRoundTickets(tape.round, tape.totalTickets));
    await markRound("mile", packRoundMile(tape.round, highestPotMilestone(tape.split.winnerLamports)));
    return { skipped: true as const, reason: "remembered live slips without posting", round: tape.round };
  }

  const prevTickets = unpackRoundTickets(packedTickets);
  const prevMile = packedMile == null ? { round: tape.round, mile: 0 } : unpackRoundMile(packedMile);
  if (prevTickets.round !== tape.round) {
    await markRound("tickets", packRoundTickets(tape.round, tape.totalTickets));
    await markRound("mile", packRoundMile(tape.round, highestPotMilestone(tape.split.winnerLamports)));
    return { skipped: true as const, reason: "new rock slip baseline", round: tape.round };
  }

  const added = tape.totalTickets - prevTickets.tickets;
  const miles = prevMile.round === tape.round ? crossedPotMilestones(prevMile.mile, tape.split.winnerLamports) : [];
  const mile = miles.length ? miles[miles.length - 1] : 0;
  if (added <= 0 && !mile) {
    return { skipped: true as const, reason: "no new slips or pot mark", round: tape.round };
  }

  const buy = added > 0 ? await sendKennelCard(formatBuyCheer(tape, added)) : { skipped: true as const, reason: "no new slips" };
  const mark = mile
    ? await sendKennelCard(formatMilestone(tape, mile), kennelPhotoUrl("open", tape.round))
    : { skipped: true as const, reason: "no pot mark" };
  await markRound("tickets", packRoundTickets(tape.round, tape.totalTickets));
  if (mile) await markRound("mile", packRoundMile(tape.round, mile));
  return {
    skipped: Boolean(buy.skipped && mark.skipped),
    round: tape.round,
    added: added > 0 ? added : 0,
    mile,
    buy,
    mark,
  };
}

export async function runKennelDesk(
  input: { tape?: LottoSnapshot; justPaid?: boolean; justOpened?: boolean; justRolling?: boolean } = {},
) {
  if (!telegramConfigured()) return { skipped: true as const, reason: "telegram not configured" };
  const tape =
    input.justPaid || input.justOpened || input.justRolling || !input.tape
      ? await getLottoSnapshot(true)
      : input.tape;
  const winner = await maybeAnnounceWinner({ tape, justPaid: input.justPaid });
  const opened = await maybeAnnounceNewRock({ tape, justOpened: input.justOpened });
  const hour = await maybeAnnounceLastHour({ tape });
  const rolling = await maybeAnnounceRolling({ tape, justRolling: input.justRolling });
  const heat = await maybeAnnounceHeat({ tape });
  const x = await maybeAnnounceXPosts();
  return { skipped: false as const, winner, opened, hour, rolling, heat, x, round: tape.round };
}

export async function maybeAnnounceXPosts() {
  if (!telegramConfigured()) return { skipped: true as const, reason: "telegram not configured" };
  if (!xConfigured()) return { skipped: true as const, reason: "X_BEARER_TOKEN is not set." };

  const since = await markedText("x");
  const feed = await latestKennelTweets(since);
  if (feed.reason && !feed.tweets.length && !feed.latestId) {
    return { skipped: true as const, reason: feed.reason };
  }

  if (!since) {
    const newest = feed.tweets.at(-1)?.id ?? feed.latestId;
    if (newest) await markText("x", newest);
    return { skipped: true as const, reason: "remembered live X without dumping history", id: newest };
  }

  const fresh = feed.tweets.filter((row) => row.id > since);
  if (!fresh.length) return { skipped: true as const, reason: feed.reason || "no new X posts" };

  const posted: string[] = [];
  for (const tweet of fresh) {
    const sent = await sendKennelXPost(formatXPost(tweet));
    if (!sent.skipped) posted.push(tweet.id);
    await markText("x", tweet.id);
  }
  return { skipped: posted.length === 0, posted: posted.length, lastId: posted.at(-1) };
}

export async function pulseKennel(nowMs = Date.now()) {
  if (!telegramConfigured()) return { skipped: true as const, reason: "telegram not configured" };
  const tape = await getLottoSnapshot(true);
  const sent = await sendKennelCard(formatPulse(tape, nowMs), kennelPhotoUrl("pulse", tape.round));
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

export async function lastText() {
  const tape = await getLottoSnapshot(true);
  return formatLastWin(winFromTape(tape));
}

export async function welcomeJoiners(input: {
  chatId: string | number;
  guests: TelegramGuest[];
  nowMs?: number;
}) {
  if (!telegramConfigured()) return { skipped: true as const, reason: "telegram not configured" };
  const guests = humanJoiners(input.guests);
  if (!guests.length) return { skipped: true as const, reason: "no human joiners" };

  let tape: LottoSnapshot | null = null;
  try {
    tape = await getLottoSnapshot(true);
  } catch {
    tape = null;
  }
  const sent = await sendKennelClip(formatWelcome(guests, tape, input.nowMs ?? Date.now()), input.chatId);
  return {
    skipped: sent.skipped,
    reason: "reason" in sent ? sent.reason : undefined,
    messageId: "messageId" in sent ? sent.messageId : undefined,
    guests: guests.length,
  };
}
