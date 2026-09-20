import assert from "node:assert/strict";
import test from "node:test";
import {
  formatHelp,
  formatJackpot,
  formatPulse,
  formatStart,
  formatVerify,
  formatWinner,
  parseTelegramCommand,
  remainingLabel,
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
  assert.match(text, /0\.594 SOL/);
  assert.match(text, /12 slips/);
  assert.match(text, /If this rock pays now/);
  assert.match(text, /0\.5049 SOL/);
  assert.match(text, /1d 5h left/);
  assert.match(text, /petrock\.fun\/lotto/);
  assert.match(text, /Last rock paid slip 30/);
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
  assert.match(text, /Nobody has bought a slip yet/);
  assert.doesNotMatch(text, /If this rock pays now/);
});

test("winner card includes wallet, slip, rematch, and verify links", () => {
  const text = formatWinner(win(), receipt());
  assert.match(text, /Rock 0 is paid/);
  assert.match(text, /62C41rN2uUrsZoRkZyTqxD8GJYpa6KtERAtehfNmiXwq/);
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
  assert.match(text, /So11111111111111111111111111111111111111112/);
});

test("help and start stay kennel-voiced", () => {
  assert.match(formatHelp(), /\/jackpot/);
  assert.match(formatStart(), /0\.05 SOL/);
  assert.doesNotMatch(formatHelp(), /refund/i);
  assert.doesNotMatch(formatStart(), /provably fair/i);
});
