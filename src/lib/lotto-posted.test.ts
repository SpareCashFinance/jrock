import assert from "node:assert/strict";
import test from "node:test";
import { drawFromPostedWin, lastPostedWin, postedWinKey, postedWinLabel, type LottoPostedWin } from "./lotto-history.ts";

function posted(partial: Partial<LottoPostedWin>): LottoPostedWin {
  return {
    round: 0,
    pot: "6R2TdLtWQEqgUVe2yLnhf1GKX651JHja1yUfwEurL8st",
    status: "claimed",
    startsAt: "2026-09-15T00:00:00.000Z",
    endsAt: "2026-09-18T00:00:00.000Z",
    tickets: 9,
    winner: "3CJZNCvudnMMedpCH8dyxM2wSDeZrkYsMZP7aeSjxWuZ",
    winnerIndex: 4,
    jackpotLamports: 378_675_000,
    carryLamports: 66_825_000,
    ticketLamports: 445_500_000,
    seedLamports: 0,
    payoutKnown: true,
    verified: true,
    entropySlot: 123,
    entropyHash: "ab".repeat(32),
    ...partial,
  };
}

test("last posted win skips open and void rounds", () => {
  const win = lastPostedWin([
    posted({ status: "open", winner: null, winnerIndex: null, tickets: 0 }),
    posted({ status: "void", winner: null, winnerIndex: null, tickets: 0 }),
    posted({ status: "claimed", round: 0 }),
  ]);
  assert.equal(win?.winner, "3CJZNCvudnMMedpCH8dyxM2wSDeZrkYsMZP7aeSjxWuZ");
  assert.equal(win?.winnerIndex, 4);
});

test("posted win keys stay unique when two kennels both used round 0", () => {
  const live = posted({ round: 0, pot: "6R2TdLtWQEqgUVe2yLnhf1GKX651JHja1yUfwEurL8st" });
  const first = posted({
    round: 0,
    pot: "3Q5u97fxVbwxPBcqg34CgqtfPdQ1RTyvnwQHPrg7CUe1",
    legacy: true,
  });
  assert.notEqual(postedWinKey(live), postedWinKey(first));
  assert.equal(postedWinLabel(live), "Round 01 · claimed");
  assert.equal(postedWinLabel(first), "First kennel · claimed");
});

test("draw from posted win keeps the paid rock while the next round is empty", () => {
  const draw = drawFromPostedWin(posted({}));
  assert.equal(draw?.winner, "3CJZNCvudnMMedpCH8dyxM2wSDeZrkYsMZP7aeSjxWuZ");
  assert.equal(draw?.winnerIndex, 4);
  assert.equal(draw?.verified, true);
  assert.equal(drawFromPostedWin(posted({ status: "open", winner: null, winnerIndex: null })), null);
});
