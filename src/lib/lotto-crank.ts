import "server-only";

import { Connection, Keypair, Transaction } from "@solana/web3.js";
import { getLottoSnapshot } from "@/lib/lotto-chain";
import { nextCrankStep } from "@/lib/lotto-crank-plan";
import { deskCrankIxs } from "@/lib/lotto-continue";
import { isLottoV2 } from "@/lib/lotto-program";
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

  const ixs = await deskCrankIxs({
    v2: isLottoV2(tape.programId),
    payer: cranker.publicKey,
    currentRound: tape.currentRound,
    step,
    totalTickets: tape.totalTickets,
    winner: step.kind === "claim" ? step.winner : tape.pendingWinner ?? tape.draw?.winner,
    vrfRequest: tape.vrfRequest,
    buyers: tape.entries.map((row) => ({ wallet: row.wallet, tickets: row.tickets, fromIndex: row.slot })),
    vrfEntropy: tape.vrfEntropy,
    connection: rpc,
    programId: tape.programId,
    roundPda: tape.pot,
    ticketCount: tape.totalTickets,
    roundId: tape.round,
  });
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
