import assert from "node:assert/strict";
import test from "node:test";
import { finishFlowAsking, finishFlowDone, finishFlowPlan } from "./lotto-continue-plan.ts";

test("paying the winner also opens the next round", () => {
  assert.deepEqual(finishFlowPlan("claim", 29), ["claim", "open_next"]);
});

test("an empty book closes and opens the next rock together", () => {
  assert.deepEqual(finishFlowPlan("close", 0), ["close", "open_next"]);
  assert.deepEqual(finishFlowPlan("close", 4), ["close"]);
});

test("settle stays one step so ORAO can still fulfill first", () => {
  assert.deepEqual(finishFlowPlan("settle", 29), ["settle"]);
});

test("finish copy names the next rock on pay and empty close", () => {
  assert.match(finishFlowAsking("claim", 29), /opening next rock/i);
  assert.match(finishFlowDone("claim", 29), /next rock open/i);
  assert.match(finishFlowAsking("close", 0), /opening next rock/i);
  assert.equal(finishFlowDone("close", 4), "Sales closed");
});
