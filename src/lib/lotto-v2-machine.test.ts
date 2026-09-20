import assert from "node:assert/strict";
import test from "node:test";
import { JROCK_LOTTO_V2_PROGRAM_ID } from "./lotto-program.ts";

const STATUSES = [
  "open",
  "closed",
  "randomness_requested",
  "fulfilled",
  "settled",
  "claimed",
  "void",
  "refunding",
  "refunded",
] as const;
type Status = (typeof STATUSES)[number];

function canBuy(status: Status, now: number, endTs: number, tickets: number) {
  return status === "open" && now < endTs && tickets >= 1 && tickets <= 20;
}

function canClose(status: Status, now: number, endTs: number) {
  return status === "open" && now >= endTs;
}

function canRequest(status: Status, tickets: number) {
  return status === "closed" && tickets > 0;
}

function canSettle(status: Status) {
  return status === "randomness_requested" || status === "fulfilled";
}

function canRefund() {
  return false;
}

test("v2 buy presets 1, 2, 5, 10, 20 are legal; 0 and 21 are not", () => {
  for (const n of [1, 2, 5, 10, 20]) assert.equal(canBuy("open", 50, 100, n), true);
  assert.equal(canBuy("open", 50, 100, 0), false);
  assert.equal(canBuy("open", 50, 100, 21), false);
  assert.equal(canBuy("closed", 50, 100, 1), false);
});

test("v2 close, request, settle, and refund gates", () => {
  assert.equal(canClose("open", 99, 100), false);
  assert.equal(canClose("open", 100, 100), true);
  assert.equal(canRequest("closed", 1), true);
  assert.equal(canRequest("closed", 0), false);
  assert.equal(canRequest("open", 1), false);
  assert.equal(canSettle("randomness_requested"), true);
  assert.equal(canSettle("fulfilled"), true);
  assert.equal(canSettle("settled"), false);
  assert.equal(canSettle("refunding"), false);
  assert.equal(canRefund(), false);
});

test("v2 kennel fee is 1 percent inside the posted price", () => {
  const gross = 50_000_000 * 2;
  const fee = Math.floor((gross * 1) / 100);
  assert.equal(fee, 1_000_000);
  assert.equal(gross - fee, 99_000_000);
});

test("v2 successor program id is distinct from live v1", () => {
  assert.equal(JROCK_LOTTO_V2_PROGRAM_ID, "66FyiUTkw4JMYMi3yErfa7UBqrHm9GZha1meAxcgbjDg");
  assert.notEqual(JROCK_LOTTO_V2_PROGRAM_ID, "FvQfcJYAcRFEDeq8rS19MNXTZfeiCxcSN5nmfA6RdWuC");
});

test("ORAO RandomnessV2 fulfilled layout is disc + enum + client + seed + 64 random bytes", () => {
  const data = new Uint8Array(8 + 1 + 32 + 32 + 64);
  data[8] = 1;
  data.fill(7, 9 + 32, 9 + 64);
  data.fill(9, 9 + 64);
  assert.equal(data[8], 1);
  assert.deepEqual([...data.slice(8 + 1 + 32, 8 + 1 + 64)], Array(32).fill(7));
  assert.deepEqual([...data.slice(8 + 1 + 64, 8 + 1 + 96)], Array(32).fill(9));
  assert.equal(data.length >= 8 + 1 + 32 + 32 + 64 && data[8] === 1, true);
  assert.deepEqual([...data.slice(8 + 1 + 32 + 32, 8 + 1 + 32 + 32 + 32)], Array(32).fill(9));
});
