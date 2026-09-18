import "server-only";

import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { getLottoSnapshot } from "@/lib/lotto-chain";
import { nextCrankStep } from "@/lib/lotto-crank-plan";
import {
  claimIx,
  closeSalesIx,
  isLottoV2,
  openRoundIx,
  settleIx,
} from "@/lib/lotto-program";
import { claimIxV2, closeSalesIxV2, openRoundIxV2, settleIxV2 } from "@/lib/lotto-program-v2";
import { serverSolanaRpcUrl } from "@/lib/solana";

function loadCranker() {
  const raw = (process.env.LOTTO_CRANK_SECRET ?? "").trim();
  if (!raw) return null;
  try {
    if (raw.startsWith("[")) {
      return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]));
    }
  } catch {
    return null;
  }
  return null;
}

export function crankerPublicKey() {
  return loadCranker()?.publicKey.toBase58() ?? "";
}

export async function runLottoCrank() {
  const cranker = loadCranker();
  if (!cranker) {
    return { ok: true, skipped: true, reason: "LOTTO_CRANK_SECRET is not set. Connect a wallet on /lotto to finish the draw." };
  }

  const rpc = new Connection(serverSolanaRpcUrl(), "confirmed");
  const tape = await getLottoSnapshot(true);
  const slot = await rpc.getSlot("confirmed");
  const step = nextCrankStep(tape, { slot, nowMs: Date.now() });
  if (step.kind === "idle" || step.kind === "wait") {
    return { ok: true, skipped: true, reason: step.reason, step: step.kind, slot, round: tape.round };
  }
  if (step.kind === "request_vrf" || step.kind === "store_vrf") {
    return { ok: false, reason: "VRF steps still need a browser wallet. v1 SlotHashes cranks are automatic." };
  }

  const v2 = isLottoV2(tape.programId);
  const round = tape.currentRound;
  let ix;
  if (step.kind === "close") ix = v2 ? closeSalesIxV2(round) : closeSalesIx(round);
  else if (step.kind === "settle") {
    if (v2) return { ok: false, reason: "v2 settle needs the bound VRF account." };
    ix = settleIx(round);
  } else if (step.kind === "claim") {
    const winner = new PublicKey(step.winner);
    ix = v2 ? claimIxV2(round, winner) : claimIx(round, winner);
  } else {
    ix = v2 ? openRoundIxV2(cranker.publicKey, round) : openRoundIx(cranker.publicKey, round);
  }

  const { blockhash, lastValidBlockHeight } = await rpc.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: cranker.publicKey, blockhash, lastValidBlockHeight }).add(ix);
  tx.sign(cranker);
  const signature = await rpc.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 4 });
  await rpc.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
  return {
    ok: true,
    skipped: false,
    step: step.kind,
    signature,
    cranker: cranker.publicKey.toBase58(),
    round: tape.round,
    slot,
  };
}
