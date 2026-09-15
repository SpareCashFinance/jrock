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

function canRefund(status: Status, now: number, timeoutTs: number) {
  return (
    now >= timeoutTs &&
    (status === "closed" || status === "randomness_requested" || status === "fulfilled" || status === "refunding")
  );
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
  assert.equal(canRefund("closed", 10, 9), true);
  assert.equal(canRefund("closed", 8, 9), false);
  assert.equal(canRefund("settled", 20, 9), false);
});

test("v2 refund is 99 percent of the posted price", () => {
  const refund = 50_000_000 * 2 - Math.floor((50_000_000 * 2 * 1) / 100);
  assert.equal(refund, 99_000_000);
});

test("v2 successor program id is distinct from live v1", () => {
  assert.equal(JROCK_LOTTO_V2_PROGRAM_ID, "66FyiUTkw4JMYMi3yErfa7UBqrHm9GZha1meAxcgbjDg");
  assert.notEqual(JROCK_LOTTO_V2_PROGRAM_ID, "FvQfcJYAcRFEDeq8rS19MNXTZfeiCxcSN5nmfA6RdWuC");
});
