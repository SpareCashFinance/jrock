import assert from "node:assert/strict";
import test from "node:test";
import { assertLedgerConserved, buildLedger, ownerForTicket, winnerPayoutLamports } from "./lotto-ledger.ts";

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
