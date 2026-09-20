import { Connection, PublicKey, type TransactionInstruction } from "@solana/web3.js";
import type { CrankStep } from "./lotto-crank-plan";
import { finishFlowPlan } from "./lotto-continue-plan";
import { ownerForTicket } from "./lotto-ledger";
import { claimIx, closeSalesIx, openRoundIx, settleIx } from "./lotto-program";
import {
  claimIxV2,
  closeSalesIxV2,
  openRoundIxV2,
  oraoFulfilledEntropy,
  oraoNetworkStatePda,
  oraoRequestPda,
  oraoTreasuryFromNetworkState,
  requestRandomnessIxV2,
  settleIxV2,
} from "./lotto-program-v2";
import { hexToBytes, toHex, vrfSeedBytes, winnerFromVrfEntropy } from "./lotto-vrf";

export { finishFlowAsking, finishFlowDone } from "./lotto-continue-plan";

export type FinishBuyer = { wallet: string; tickets: number; fromIndex: number };

export type FinishFlowInput = {
  v2: boolean;
  payer: PublicKey;
  currentRound: number;
  step: CrankStep;
  totalTickets: number;
  winner?: string | null;
  vrfRequest?: string | null;
  buyers?: FinishBuyer[];
  vrfEntropy?: string | null;
};

/**
 * Two on-chain breaths: close+request, then after ORAO answers settle+claim+open.
 * claim / empty close bump current_round, so open_round targets currentRound + 1.
 */
export function finishFlowIxs(input: FinishFlowInput): TransactionInstruction[] {
  const { v2, payer, currentRound, step, totalTickets } = input;
  const openCurrent = () => (v2 ? openRoundIxV2(payer, currentRound) : openRoundIx(payer, currentRound));
  const openNext = () => (v2 ? openRoundIxV2(payer, currentRound + 1) : openRoundIx(payer, currentRound + 1));
  const ixs: TransactionInstruction[] = [];

  for (const part of finishFlowPlan(step.kind, totalTickets, v2)) {
    if (part === "close") ixs.push(v2 ? closeSalesIxV2(currentRound) : closeSalesIx(currentRound));
    if (part === "settle") {
      if (v2) {
        if (!input.vrfRequest) throw new Error("v2 settle needs the bound VRF account.");
        ixs.push(settleIxV2(currentRound, new PublicKey(input.vrfRequest)));
      } else {
        ixs.push(settleIx(currentRound));
      }
    }
    if (part === "claim") {
      const winner = new PublicKey((step.kind === "claim" ? step.winner : "") || input.winner || payer.toBase58());
      ixs.push(v2 ? claimIxV2(currentRound, winner) : claimIx(currentRound, winner));
    }
    if (part === "open_next") ixs.push(openNext());
    if (part === "open_current") ixs.push(openCurrent());
  }
  return ixs;
}

async function buildRequestIx(input: FinishFlowInput & {
  connection?: Connection;
  programId?: string;
  roundPda?: string;
  ticketCount?: number;
  roundId?: number;
}) {
  const connection = input.connection;
  const programId = input.programId;
  const roundPda = input.roundPda;
  if (!connection || !programId || !roundPda) throw new Error("VRF request needs the round account.");
  const program = new PublicKey(programId);
  const round = new PublicKey(roundPda);
  const seed = await vrfSeedBytes(
    program.toBytes(),
    round.toBytes(),
    input.roundId ?? input.currentRound,
    input.ticketCount ?? input.totalTickets,
  );
  const [request] = oraoRequestPda(seed);
  const [network] = oraoNetworkStatePda();
  const info = await connection.getAccountInfo(network, "confirmed");
  if (!info?.data) throw new Error("ORAO network state is missing on this RPC.");
  const treasury = oraoTreasuryFromNetworkState(info.data);
  if (!treasury) throw new Error("ORAO treasury did not decode.");
  return requestRandomnessIxV2(input.payer, input.currentRound, request, treasury);
}

async function resolveWinner(input: FinishFlowInput & { connection?: Connection }) {
  const claimed = input.step.kind === "claim" ? input.step.winner : "";
  if (claimed) return claimed;
  if (input.winner) return input.winner;
  let entropy = input.vrfEntropy ?? "";
  if (!entropy && input.connection && input.vrfRequest) {
    const info = await input.connection.getAccountInfo(new PublicKey(input.vrfRequest), "confirmed");
    const bytes = info?.data ? oraoFulfilledEntropy(info.data) : null;
    if (bytes) entropy = toHex(bytes);
  }
  if (!entropy || !input.buyers?.length || input.totalTickets <= 0) return null;
  const math = await winnerFromVrfEntropy(hexToBytes(entropy), input.totalTickets);
  return ownerForTicket(input.buyers, math.index);
}

export async function deskCrankIxs(
  input: FinishFlowInput & {
    connection?: Connection;
    programId?: string;
    roundPda?: string;
    ticketCount?: number;
    roundId?: number;
  },
): Promise<TransactionInstruction[]> {
  const plan = finishFlowPlan(input.step.kind, input.totalTickets, input.v2);
  if (plan.includes("request_vrf") && !plan.includes("settle") && !plan.includes("claim")) {
    const ixs: TransactionInstruction[] = [];
    for (const part of plan) {
      if (part === "close") ixs.push(input.v2 ? closeSalesIxV2(input.currentRound) : closeSalesIx(input.currentRound));
      if (part === "request_vrf") ixs.push(await buildRequestIx(input));
    }
    return ixs;
  }

  const winner = await resolveWinner(input);
  if (plan.includes("claim") && !winner) {
    throw new Error("ORAO has not picked a slip yet.");
  }
  return finishFlowIxs({ ...input, winner });
}
