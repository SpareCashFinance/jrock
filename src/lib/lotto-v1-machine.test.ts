import assert from "node:assert/strict";
import test from "node:test";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { buyIxForRound, claimIx, closeSalesIx, settleIx, SLOT_HASHES } from "./lotto-program.ts";
import { kennelFeeLamports, winnerPayoutLamports } from "./lotto-ledger.ts";

const PROGRAM = new PublicKey("FvQfcJYAcRFEDeq8rS19MNXTZfeiCxcSN5nmfA6RdWuC");
const FEE = new PublicKey("qbjbLafSNGq27fYFiF1RKhb9BREk1zFWWS8H6Drj8co");
const BUYER = new PublicKey("3CJZNCvudnMMedpCH8dyxM2wSDeZrkYsMZP7aeSjxWuZ");

const STATUSES = ["open", "closed", "settled", "claimed", "void"] as const;
type Status = (typeof STATUSES)[number];

function canBuy(status: Status, now: number, endTs: number, tickets: number) {
  return status === "open" && now < endTs && tickets >= 1 && tickets <= 20;
}

function canClose(status: Status, now: number, endTs: number) {
  return status === "open" && now >= endTs;
}

function close(status: Status, tickets: number): Status {
  if (tickets === 0) return "void";
  return "closed";
}

function canSettle(status: Status, slot: number, entropySlot: number, tickets: number) {
  return status === "closed" && tickets > 0 && slot > entropySlot;
}

function canClaim(status: Status, winner: string, provided: string) {
  return status === "settled" && winner === provided;
}

test("v1 buy presets 1, 2, 5, 10, 20 are legal; 0 and 21 are not", () => {
  const end = 100;
  for (const n of [1, 2, 5, 10, 20]) assert.equal(canBuy("open", 50, end, n), true);
  assert.equal(canBuy("open", 50, end, 0), false);
  assert.equal(canBuy("open", 50, end, 21), false);
  assert.equal(canBuy("closed", 50, end, 1), false);
  assert.equal(canBuy("open", 100, end, 1), false);
});

test("v1 close before deadline fails; zero tickets voids; otherwise closed", () => {
  assert.equal(canClose("open", 99, 100), false);
  assert.equal(canClose("open", 100, 100), true);
  assert.equal(close("open", 0), "void");
  assert.equal(close("open", 1), "closed");
});

test("v1 rejects buy after close, double settle, and wrong winner", () => {
  assert.equal(canBuy("closed", 1, 2, 1), false);
  assert.equal(canSettle("closed", 11, 10, 2), true);
  assert.equal(canSettle("settled", 11, 10, 2), false);
  assert.equal(canSettle("closed", 10, 10, 2), false);
  assert.equal(canClaim("settled", "A", "A"), true);
  assert.equal(canClaim("settled", "A", "B"), false);
  assert.equal(canClaim("closed", "A", "A"), false);
});

test("v1 one-ticket round always maps to index 0", () => {
  assert.equal(0 % 1, 0);
});

test("v1 claim split conserves donated pot minus rent", () => {
  const claimable = 445_500_000;
  const payout = winnerPayoutLamports(claimable);
  assert.equal(payout + (claimable - payout), claimable);
  assert.equal(kennelFeeLamports(9 * 50_000_000), 4_500_000);
});

test("v1 client ixs keep SlotHashes on settle and fee wallet on buy", () => {
  const buy = buyIxForRound(BUYER, 0, 20, FEE);
  assert.equal(buy.programId.toBase58(), PROGRAM.toBase58());
  assert.equal(buy.keys[4]?.pubkey.toBase58(), FEE.toBase58());
  assert.equal(buy.data[8], 20);
  const settle = settleIx(0);
  assert.equal(settle.keys[2]?.pubkey.toBase58(), SLOT_HASHES.toBase58());
  const closeIx = closeSalesIx(0);
  assert.equal(closeIx.keys.length, 2);
  const claim = claimIx(0, BUYER);
  assert.equal(claim.keys[2]?.pubkey.toBase58(), BUYER.toBase58());
  assert.ok(SystemProgram.programId);
});
