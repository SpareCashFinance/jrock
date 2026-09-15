import assert from "node:assert/strict";
import test from "node:test";
import { winnerFromVrfEntropy, hexToBytes } from "./lotto-vrf.ts";

test("v2 one ticket always maps to index 0", async () => {
  assert.equal((await winnerFromVrfEntropy(new Uint8Array(32), 1)).index, 0);
  assert.equal((await winnerFromVrfEntropy(new Uint8Array(32).fill(255), 1)).index, 0);
});

test("v2 rejection sampling stays inside 0..n-1", async () => {
  for (const n of [2, 3, 5, 9, 20, 64]) {
    for (const fill of [0, 1, 7, 255]) {
      const entropy = new Uint8Array(32).fill(fill);
      entropy[31] = n;
      const { index } = await winnerFromVrfEntropy(entropy, n);
      assert.ok(index >= 0 && index < n, `index ${index} for n ${n}`);
    }
  }
});

test("v2 all-ones entropy for n=3 still lands in range", async () => {
  const { index } = await winnerFromVrfEntropy(hexToBytes("ff".repeat(32)), 3);
  assert.ok(index < 3);
});
