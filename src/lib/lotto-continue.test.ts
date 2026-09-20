import assert from "node:assert/strict";
import test from "node:test";
import { finishFlowAsking, finishFlowDone, finishFlowPlan } from "./lotto-continue-plan.ts";

test("paying the winner also opens the next round", () => {
  assert.deepEqual(finishFlowPlan("claim", 29), ["claim", "open_next"]);
});

test("an empty book closes and opens the next rock together", () => {
  assert.deepEqual(finishFlowPlan("close", 0), ["close", "open_next"]);
  assert.deepEqual(finishFlowPlan("close", 4), ["close", "request_vrf"]);
  assert.deepEqual(finishFlowPlan("close", 4, false), ["close"]);
});

test("after ORAO answers, settle pays and opens in one breath", () => {
  assert.deepEqual(finishFlowPlan("settle", 29), ["settle", "claim", "open_next"]);
  assert.deepEqual(finishFlowPlan("store_vrf", 29), ["settle", "claim", "open_next"]);
});

test("finish copy names the next rock on pay and empty close", () => {
  assert.match(finishFlowAsking("claim", 29), /opening next rock/i);
  assert.match(finishFlowDone("claim", 29), /next rock open/i);
  assert.match(finishFlowAsking("close", 0), /opening next rock/i);
  assert.equal(finishFlowDone("close", 4), "ORAO asked");
  assert.match(finishFlowAsking("settle", 29), /opening next rock/i);
});
