import "server-only";

import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { getLottoSnapshot } from "@/lib/lotto-chain";
import { nextCrankStep } from "@/lib/lotto-crank-plan";
import { finishFlowIxs } from "@/lib/lotto-continue";
import { isLottoV2 } from "@/lib/lotto-program";
import {
  fulfillRandomnessIxV2,
  oraoNetworkStatePda,
  oraoRequestPda,
  oraoTreasuryFromNetworkState,
  requestRandomnessIxV2,
} from "@/lib/lotto-program-v2";
import { vrfSeedBytes } from "@/lib/lotto-vrf";
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

  const v2 = isLottoV2(tape.programId);
  const round = tape.currentRound;
  let ixs;
  if (step.kind === "request_vrf") {
    const program = new PublicKey(tape.programId);
    const roundPda = new PublicKey(tape.pot);
    const seed = await vrfSeedBytes(program.toBytes(), roundPda.toBytes(), tape.round, tape.totalTickets);
    const [request] = oraoRequestPda(seed);
    const [network] = oraoNetworkStatePda();
    const info = await rpc.getAccountInfo(network, "confirmed");
    if (!info?.data) return { ok: false, reason: "ORAO network state is missing on this RPC." };
    const treasury = oraoTreasuryFromNetworkState(info.data);
    if (!treasury) return { ok: false, reason: "ORAO treasury did not decode." };
    ixs = [requestRandomnessIxV2(cranker.publicKey, round, request, treasury)];
  } else if (step.kind === "store_vrf") {
    if (!tape.vrfRequest) return { ok: false, reason: "No VRF request is stored on this round yet." };
    ixs = [fulfillRandomnessIxV2(round, new PublicKey(tape.vrfRequest))];
  } else {
    ixs = finishFlowIxs({
      v2,
      payer: cranker.publicKey,
      currentRound: round,
      step,
      totalTickets: tape.totalTickets,
      winner: step.kind === "claim" ? step.winner : tape.draw?.winner,
      vrfRequest: tape.vrfRequest,
    });
  }
  if (!ixs.length) return { ok: false, reason: "No crank instruction was built." };

  const { blockhash, lastValidBlockHeight } = await rpc.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: cranker.publicKey, blockhash, lastValidBlockHeight }).add(...ixs);
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
