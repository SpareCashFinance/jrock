import assert from "node:assert/strict";
import test from "node:test";
import {
  crossedPotMilestones,
  formatBuyCheer,
  formatHelp,
  formatJackpot,
  formatLastHour,
  formatLastWin,
  formatMilestone,
  formatNewRock,
  formatPulse,
  formatRolling,
  formatStart,
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
  mentionUser,
  packRoundTickets,
  parseTelegramCommand,
  playReplyMarkup,
  remainingLabel,
  TELEGRAM_LOTTO_CLIP,
  unpackRoundTickets,
  type TelegramPotTape,
  type TelegramReceiptTape,
  type TelegramWinTape,
} from "./telegram-copy.ts";

const NOW = Date.parse("2026-09-21T12:00:00.000Z");

function pot(partial: Partial<TelegramPotTape> = {}): TelegramPotTape {
  return {
    round: 1,
    status: "open",
    endsAt: "2026-09-22T17:43:30.000Z",
    ticketPriceSol: 0.05,
    totalTickets: 12,
    programId: "66FyiUTkw4JMYMi3yErfa7UBqrHm9GZha1meAxcgbjDg",
    split: {
      rentLamports: 3_281_680,
      claimableLamports: 594_000_000,
      ticketLamports: 594_000_000,
      seedLamports: 0,
      winnerLamports: 504_900_000,
      carryLamports: 89_100_000,
    },
    posted: [
      {
        round: 0,
        pot: "6R2TdLtWQEqgUVe2yLnhf1GKX651JHja1yUfwEurL8st",
        status: "claimed",
        startsAt: "2026-09-18T17:43:30.000Z",
        endsAt: "2026-09-20T17:43:30.000Z",
        tickets: 31,
        winner: "62C41rN2uUrsZoRkZyTqxD8GJYpa6KtERAtehfNmiXwq",
        winnerIndex: 30,
        jackpotLamports: 1_314_239_128,
        carryLamports: 231_924_552,
        ticketLamports: 1_304_325_000,
        seedLamports: 0,
        payoutKnown: true,
        verified: true,
        entropySlot: null,
        entropyHash: null,
      },
    ],
    ...partial,
  };
}

function win(partial: Partial<TelegramWinTape> = {}): TelegramWinTape {
  return {
    round: 0,
    winner: "62C41rN2uUrsZoRkZyTqxD8GJYpa6KtERAtehfNmiXwq",
    winnerIndex: 30,
    tickets: 31,
    jackpotLamports: 1_314_239_128,
    carryLamports: 231_924_552,
    ticketLamports: 1_304_325_000,
    programId: "66FyiUTkw4JMYMi3yErfa7UBqrHm9GZha1meAxcgbjDg",
    ...partial,
  };
}

function receipt(partial: Partial<TelegramReceiptTape> = {}): TelegramReceiptTape {
  return {
    matches: true,
    storedWinner: "62C41rN2uUrsZoRkZyTqxD8GJYpa6KtERAtehfNmiXwq",
    storedWinnerIndex: 30,
    computedWinner: "62C41rN2uUrsZoRkZyTqxD8GJYpa6KtERAtehfNmiXwq",
    computedWinnerIndex: 30,
    programId: "66FyiUTkw4JMYMi3yErfa7UBqrHm9GZha1meAxcgbjDg",
    ledger: {
      winnerPayoutLamports: 1_314_239_128,
      nextRoundSeedLamports: 231_924_552,
      ticketGrossLamports: 1_550_000_000,
      distributablePotLamports: 1_546_163_680,
    },
    ...partial,
  };
}

test("slash commands map jackpot aliases and ignore noise", () => {
  assert.equal(parseTelegramCommand("/jackpot"), "jackpot");
  assert.equal(parseTelegramCommand("/pot@jrockkennel_bot"), "jackpot");
  assert.equal(parseTelegramCommand("/rock"), "jackpot");
  assert.equal(parseTelegramCommand("/verify"), "verify");
  assert.equal(parseTelegramCommand("/last"), "last");
  assert.equal(parseTelegramCommand("/winner"), "last");
  assert.equal(parseTelegramCommand("/help"), "help");
  assert.equal(parseTelegramCommand("/start"), "start");
  assert.equal(parseTelegramCommand("jackpot"), null);
  assert.equal(parseTelegramCommand("/refund"), null);
});

test("remaining clock is stable for a fixed now", () => {
  assert.equal(remainingLabel("2026-09-22T17:43:30.000Z", NOW), "1d 5h left");
  assert.equal(remainingLabel("2026-09-21T13:10:00.000Z", NOW), "1h 10m left");
  assert.equal(remainingLabel("2026-09-21T11:00:00.000Z", NOW), "sales ended");
});

test("pulse names pot, slips, payout, and last winner without refund copy", () => {
  const text = formatPulse(pot(), NOW);
  assert.match(text, /Rock 1/);
  assert.match(text, /0\.5049 SOL/);
  assert.match(text, /12 slips/);
  assert.doesNotMatch(text, /0\.594 SOL/);
  assert.doesNotMatch(text, /If this rock pays now/);
  assert.match(text, /1d 5h left/);
  assert.match(text, /petrock\.fun\/lotto/);
  assert.match(text, /Last rock/);
  assert.match(text, /solscan\.io\/account\/62C41rN2uUrsZoRkZyTqxD8GJYpa6KtERAtehfNmiXwq#transfers/);
  assert.doesNotMatch(text, /refund/i);
  assert.doesNotMatch(text, /immutable/i);
  assert.doesNotMatch(text, /provably fair/i);
});

test("jackpot adds the end time and seed note", () => {
  const text = formatJackpot(pot(), NOW);
  assert.match(text, /Ends 2026-09-22T17:43:30.000Z/);
  assert.match(text, /15%/);
  assert.match(text, /0\.0891 SOL/);
});

test("empty book pulse does not invent a payout", () => {
  const text = formatPulse(pot({ totalTickets: 0, split: { ...pot().split, winnerLamports: 0 } }), NOW);
  assert.match(text, /No slips yet/);
  assert.doesNotMatch(text, /If this rock pays now/);
  assert.doesNotMatch(text, /0\.5049 SOL/);
});

test("winner card includes wallet, slip, rematch, and verify links", () => {
  const text = formatWinner(win(), receipt());
  assert.match(text, /Rock 0 is paid/);
  assert.match(text, /href="https:\/\/solscan\.io\/account\/62C41rN2uUrsZoRkZyTqxD8GJYpa6KtERAtehfNmiXwq#transfers"/);
  assert.match(text, /Slip 30/);
  assert.match(text, /1\.3142 SOL/);
  assert.match(text, /Rematch: matches/);
  assert.match(text, /lotto\/verify\?round=0/);
  assert.match(text, /66FyiUTkw4JMYMi3yErfa7UBqrHm9GZha1meAxcgbjDg/);
  assert.doesNotMatch(text, /refund/i);
});

test("verify command reports a rematch miss", () => {
  const text = formatVerify(win(), receipt({ matches: false, computedWinner: "So11111111111111111111111111111111111111112", computedWinnerIndex: 1 }));
  assert.match(text, /does not match/);
  assert.match(text, /href="https:\/\/solscan\.io\/account\/So11111111111111111111111111111111111111112#transfers"/);
});

test("last hour window is only the final 60 minutes", () => {
  assert.equal(isLastHour("2026-09-21T13:00:00.000Z", NOW), true);
  assert.equal(isLastHourOpen("2026-09-21T13:00:00.000Z", NOW), true);
  assert.equal(isLastHour("2026-09-21T13:10:00.000Z", NOW), false);
  assert.equal(isLastHour("2026-09-21T12:30:00.000Z", NOW), true);
  assert.equal(isLastHourOpen("2026-09-21T12:30:00.000Z", NOW), false);
});

test("last-hour post is the real payout and a play link", () => {
  const text = formatLastHour(pot({ endsAt: "2026-09-21T13:00:00.000Z" }), NOW);
  assert.match(text, /Last hour/);
  assert.match(text, /0\.5049 SOL/);
  assert.doesNotMatch(text, /If this rock pays now/);
  assert.match(text, /petrock\.fun\/lotto/);
});

test("new-rock post names the seed and clock", () => {
  const text = formatNewRock(pot({ totalTickets: 0, split: { ...pot().split, winnerLamports: 0 } }), NOW);
  assert.match(text, /Rock 1 is open/);
  assert.match(text, /Seeded with/);
  assert.match(text, /0\.05 SOL a slip/);
  assert.match(text, /1d 5h left/);
});

test("kennel photos come from compact sticker thumbs", () => {
  assert.match(kennelPhotoUrl("hour", 0), /\/memes\/tg\/08-red-rings\.webp/);
  assert.match(kennelPhotoUrl("open", 0), /\/memes\/tg\/09-green-rings\.webp/);
  assert.match(kennelPhotoUrl("winner", 0), /\/memes\/tg\/20-throne\.webp/);
  assert.match(kennelPhotoUrl("pulse", 0), /\/memes\/tg\/01-rebuttal\.webp/);
});

test("help and start stay kennel-voiced", () => {
  assert.match(formatHelp(), /\/jackpot/);
  assert.match(formatHelp(), /\/last/);
  assert.match(formatStart(), /0\.05 SOL/);
  assert.doesNotMatch(formatHelp(), /refund/i);
  assert.doesNotMatch(formatStart(), /provably fair/i);
});

test("last win names the wallet, slip, and payout", () => {
  const text = formatLastWin(win());
  assert.match(text, /Last rock 0/);
  assert.match(text, /1\.3142 SOL/);
  assert.match(text, /solscan\.io\/account\/62C41rN2uUrsZoRkZyTqxD8GJYpa6KtERAtehfNmiXwq#transfers/);
  assert.match(text, /petrock\.fun\/lotto/);
  assert.doesNotMatch(text, /refund/i);
  assert.match(formatLastWin(null), /No paid rock yet/);
});

test("buy cheer and pot marks name the live payout", () => {
  assert.match(formatBuyCheer(pot(), 3), /\+3 slips/);
  assert.match(formatBuyCheer(pot(), 3), /The pot is now <b>0\.5049 SOL<\/b>/);
  assert.match(formatBuyCheer(pot(), 1), /\+1 slip/);
  assert.match(formatMilestone(pot(), 5), /crossed <b>5 SOL<\/b>/);
  assert.deepEqual(crossedPotMilestones(0, 12e9), [5, 10]);
  assert.equal(highestPotMilestone(4.9e9), 0);
  assert.equal(highestPotMilestone(5e9), 5);
  assert.deepEqual(unpackRoundTickets(packRoundTickets(2, 80)), { round: 2, tickets: 80 });
});

test("rolling post says the rock is picking", () => {
  const text = formatRolling(pot({ status: "awaiting_vrf" }));
  assert.match(text, /Rock 1 is rolling/);
  assert.match(text, /picking a wallet/);
  assert.match(text, /0\.5049 SOL/);
  assert.equal(isRollingStatus("awaiting_vrf"), true);
  assert.equal(isRollingStatus("open"), false);
  assert.doesNotMatch(text, /provably fair/i);
  assert.equal(playReplyMarkup().inline_keyboard[0]?.[0]?.url, "https://petrock.fun/lotto");
});

test("X forwards keep the tweet text and a play link", () => {
  const text = formatXPost({ id: "123", text: "Come take a slip" });
  assert.match(text, /@petrockbtc/);
  assert.match(text, /Come take a slip/);
  assert.match(text, /x\.com\/petrockbtc\/status\/123/);
  assert.match(text, /petrock\.fun\/lotto/);
  assert.doesNotMatch(text, /refund/i);
  assert.doesNotMatch(text, /provably fair/i);
});

test("join welcomes @ the user and name the live payout", () => {
  const text = formatWelcome(
    [{ id: 7, username: "jamie", first_name: "Jamie" }],
    pot(),
    NOW,
  );
  assert.match(text, /Welcome @jamie/);
  assert.match(text, /The pot is <b>0\.5049 SOL<\/b>/);
  assert.match(text, /Enter for your chance to win!/);
  assert.match(text, /0\.05 SOL a slip/);
  assert.match(text, /petrock\.fun\/lotto/);
  assert.doesNotMatch(text, /refund/i);
  assert.doesNotMatch(text, /provably fair/i);
  assert.match(TELEGRAM_LOTTO_CLIP, /\/media\/tg\/lotto-rock\.mp4/);
});

test("join welcomes without a username still mention the person", () => {
  const text = formatWelcome(
    [{ id: 9, first_name: "Rock" }],
    pot({ totalTickets: 0, split: { ...pot().split, winnerLamports: 0 } }),
    NOW,
  );
  assert.match(text, /tg:\/\/user\?id=9/);
  assert.match(text, /The pot is open/);
  assert.match(text, /Enter for your chance to win!/);
  assert.equal(humanJoiners([{ id: 1, is_bot: true }, { id: 2, first_name: "A" }]).length, 1);
  assert.match(mentionUser({ id: 2, username: "kennel" }), /@kennel/);
});
