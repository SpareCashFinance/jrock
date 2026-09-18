import { isLottoV2 } from "./lotto-program";
import type { LottoSnapshot } from "./lotto";

export type CrankStep =
  | { kind: "idle"; label: string; reason: string }
  | { kind: "wait"; label: string; reason: string }
  | { kind: "close"; label: string; reason: string }
  | { kind: "request_vrf"; label: string; reason: string }
  | { kind: "store_vrf"; label: string; reason: string }
  | { kind: "settle"; label: string; reason: string }
  | { kind: "claim"; label: string; reason: string; winner: string }
  | { kind: "open"; label: string; reason: string };

export function salesHaveEnded(tape: Pick<LottoSnapshot, "endsAt">, nowMs = Date.now()) {
  const end = Date.parse(tape.endsAt);
  return Number.isFinite(end) && nowMs >= end;
}

export function nextCrankStep(
  tape: LottoSnapshot,
  input: { nowMs?: number; slot?: number | null } = {},
): CrankStep {
  const nowMs = input.nowMs ?? Date.now();
  const slot = input.slot ?? null;
  if (tape.engine !== "program") {
    return { kind: "idle", label: "", reason: "Wallet-mode kennel does not use program cranks." };
  }

  const v2 = isLottoV2(tape.programId);
  const ended = salesHaveEnded(tape, nowMs);

  if (tape.status === "open") {
    if (!ended) return { kind: "idle", label: "", reason: "Sales are still open." };
    return {
      kind: "close",
      label: "Finish this draw",
      reason: "Sales are over. Close the book so the program can lock a slot and pick a winner.",
    };
  }

  if (!v2 && tape.status === "awaiting_block") {
    if (tape.entropySlot && slot != null && slot <= tape.entropySlot) {
      return {
        kind: "wait",
        label: "Waiting on Solana",
        reason: `Entropy slot ${tape.entropySlot} is not in SlotHashes yet. Settle within a few minutes after it lands.`,
      };
    }
    if (slot == null && tape.entropySlot) {
      return {
        kind: "wait",
        label: "Waiting on Solana",
        reason: `Waiting for slot ${tape.entropySlot} so settle can read SlotHashes.`,
      };
    }
    return {
      kind: "settle",
      label: "Settle draw",
      reason: "Sales are closed. Settle hashes the locked slot and writes the winner.",
    };
  }

  if (v2 && tape.status === "awaiting_vrf_request") {
    return { kind: "request_vrf", label: "Request randomness", reason: "Bind one ORAO VRF job to this round." };
  }
  if (v2 && tape.status === "awaiting_vrf") {
    return { kind: "store_vrf", label: "Store VRF", reason: "Read the fulfilled ORAO output onto the round." };
  }
  if (v2 && tape.status === "awaiting_settle") {
    return { kind: "settle", label: "Settle draw", reason: "Map stored VRF output onto one slip." };
  }

  if (tape.status === "drawn" && tape.draw?.winner) {
    return {
      kind: "claim",
      label: "Pay the winner",
      reason: "Send 85% of the prize pool after rent. 15% stays to seed the next rock.",
      winner: tape.draw.winner,
    };
  }

  if (
    tape.status === "claimed" ||
    tape.status === "void" ||
    tape.status === "awaiting_round" ||
    tape.status === "refunded"
  ) {
    return {
      kind: "open",
      label: "Open next round",
      reason: "Roll leftover seed into a new round and start selling slips again.",
    };
  }

  return { kind: "idle", label: "", reason: "No crank is needed right now." };
}

export function drawPhaseLabel(tape: LottoSnapshot, ended: boolean) {
  if (tape.draw || tape.status === "drawn") return "Winner";
  if (tape.status === "claimed") return "Paid";
  if (tape.status === "awaiting_round") return "Next rock";
  if (tape.status === "awaiting_block" || tape.status === "awaiting_settle") return "Drawing";
  if (tape.status === "awaiting_vrf" || tape.status === "awaiting_vrf_request") return "Waiting on VRF";
  if (tape.status === "open" && ended) return "Sales ended";
  if (tape.status === "void") return "No slips";
  return "This draw";
}
