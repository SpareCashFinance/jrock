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
    if (tape.totalTickets === 0) {
      return {
        kind: "close",
        label: "Open next rock",
        reason: "No slips this round. Close the book and start the next rock in the same transaction.",
      };
    }
    return {
      kind: "close",
      label: "Close and ask ORAO",
      reason: "Sales are over. One transaction closes the book and binds one ORAO job.",
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
    return { kind: "request_vrf", label: "Ask ORAO", reason: "Bind one ORAO job. This is leftover if close did not include the request." };
  }
  if (v2 && tape.status === "awaiting_vrf" && !tape.vrfFulfilled) {
    return {
      kind: "wait",
      label: "Waiting on ORAO",
      reason: "The request is bound. ORAO still has to write the number. One click finishes the rest after that.",
    };
  }
  if (v2 && (tape.status === "awaiting_vrf" || tape.status === "awaiting_settle")) {
    return {
      kind: "settle",
      label: "Pay winner & open next",
      reason: "ORAO answered. One transaction maps the slip, pays 85%, and opens the next rock.",
    };
  }

  if (tape.status === "drawn" && tape.draw?.winner) {
    return {
      kind: "claim",
      label: "Pay winner & open next",
      reason: "Pay 85% of the prize pool. The leftover 15% seeds the next rock, which opens in the same transaction.",
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
      reason: "The next rock should already be open after payout. This recovers leftover seed if that step was skipped.",
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
