import type { LottoDraw, LottoPostedWin } from "./lotto.ts";

export function lastPostedWin(posted: LottoPostedWin[]): LottoPostedWin | null {
  return (
    posted.find(
      (row) =>
        Boolean(row.winner) &&
        row.winnerIndex != null &&
        (row.status === "claimed" || row.status === "settled"),
    ) ?? null
  );
}

export function postedWinKey(win: LottoPostedWin) {
  return `${win.legacy ? "legacy" : "live"}:${win.round}:${win.pot}`;
}

export function postedWinLabel(win: LottoPostedWin) {
  const round = win.legacy ? "First kennel" : `Round ${String(win.round + 1).padStart(2, "0")}`;
  return `${round} · ${win.status}`;
}

export function drawFromPostedWin(win: LottoPostedWin | null): LottoDraw | null {
  if (!win?.winner || win.winnerIndex == null) return null;
  if (win.status !== "claimed" && win.status !== "settled") return null;
  return {
    slot: win.entropySlot ?? 0,
    blockTime: Date.parse(win.endsAt) / 1000,
    blockhash: win.entropyHash || "",
    hash: win.entropyHash || "",
    random: String(win.winnerIndex),
    winnerIndex: win.winnerIndex,
    winner: win.winner,
    winningSignature: "",
    verified: win.verified,
  };
}
