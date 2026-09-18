import assert from "node:assert/strict";
import test from "node:test";
import { assertLedgerConserved, buildLedger, kennelFeeLamports, ownerForTicket, winnerPayoutLamports } from "./lotto-ledger.ts";

test("round 0 two 0.05 SOL slips match mainnet snapshot", () => {
  const ledger = buildLedger({
    accountBalanceLamports: 113_254_480,
    rentExemptReserveLamports: 14_254_480,
    ticketCount: 2,
    ticketPriceLamports: 50_000_000,
    currentRound: 0,
  });
  assert.equal(ledger.ticketGrossLamports, 100_000_000);
  assert.equal(ledger.kennelFeeLamports, 1_000_000);
  assert.equal(ledger.distributablePotLamports, 99_000_000);
  assert.equal(ledger.winnerPayoutLamports, 84_150_000);
  assert.equal(ledger.nextRoundSeedLamports, 14_850_000);
  assert.equal(ledger.priorRoundSeedLamports, 0);
  assert.equal(ledger.donationsOrUnexpectedDepositsLamports, 0);
  assert.equal(ledger.winnerPayoutLamports + ledger.nextRoundSeedLamports, 99_000_000);
  assert.ok(assertLedgerConserved(ledger));
});

test("remainder after 85% floor stays in next seed", () => {
  assert.equal(winnerPayoutLamports(99), 84);
  const ledger = buildLedger({
    accountBalanceLamports: 199,
    rentExemptReserveLamports: 100,
    ticketCount: 0,
    ticketPriceLamports: 50_000_000,
    currentRound: 1,
  });
  assert.equal(ledger.winnerPayoutLamports, 84);
  assert.equal(ledger.nextRoundSeedLamports, 15);
  assert.ok(assertLedgerConserved(ledger));
});

test("live round 0 nine 0.05 SOL slips match production independent API", () => {
  const ledger = buildLedger({
    accountBalanceLamports: 459_754_480,
    rentExemptReserveLamports: 14_254_480,
    ticketCount: 9,
    ticketPriceLamports: 50_000_000,
    currentRound: 0,
  });
  assert.equal(ledger.ticketGrossLamports, 450_000_000);
  assert.equal(ledger.kennelFeeLamports, 4_500_000);
  assert.equal(ledger.distributablePotLamports, 445_500_000);
  assert.equal(ledger.winnerPayoutLamports, 378_675_000);
  assert.equal(ledger.nextRoundSeedLamports, 66_825_000);
  assert.ok(assertLedgerConserved(ledger));
});

test("oversized book rent is not treated as ticket money", () => {
  const ledger = buildLedger({
    accountBalanceLamports: 1_450_445_360,
    rentExemptReserveLamports: 54_935_120,
    ticketCount: 29,
    ticketPriceLamports: 50_000_000,
    currentRound: 0,
  });
  assert.equal(ledger.distributablePotLamports, 1_395_510_240);
  assert.equal(ledger.ticketGrossLamports - ledger.kennelFeeLamports, 1_435_500_000);
  assert.equal(assertLedgerConserved(ledger), false);
});

test("compacted live round 0 puts leftover realloc rent back in the pot", () => {
  const ledger = buildLedger({
    accountBalanceLamports: 1_450_445_360,
    rentExemptReserveLamports: 3_073_400,
    ticketCount: 29,
    ticketPriceLamports: 50_000_000,
    currentRound: 0,
  });
  assert.equal(ledger.distributablePotLamports, 1_447_371_960);
  assert.equal(ledger.winnerPayoutLamports, 1_230_266_166);
  assert.equal(ledger.donationsOrUnexpectedDepositsLamports, 11_871_960);
  assert.ok(assertLedgerConserved(ledger));
});

test("twenty slips keep 1% inside the posted price", () => {
  assert.equal(kennelFeeLamports(20 * 50_000_000), 10_000_000);
});

test("ticket 0 and last ticket map to the owning wallet", () => {
  const buyers = [
    { wallet: "A", tickets: 1, fromIndex: 0 },
    { wallet: "A", tickets: 1, fromIndex: 1 },
    { wallet: "B", tickets: 5, fromIndex: 2 },
  ];
  assert.equal(ownerForTicket(buyers, 0), "A");
  assert.equal(ownerForTicket(buyers, 1), "A");
  assert.equal(ownerForTicket(buyers, 2), "B");
  assert.equal(ownerForTicket(buyers, 6), "B");
  assert.equal(ownerForTicket(buyers, 7), null);
});
