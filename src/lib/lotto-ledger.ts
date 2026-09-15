export type LottoLedger = {
  accountBalanceLamports: number;
  rentExemptReserveLamports: number;
  ticketGrossLamports: number;
  kennelFeeLamports: number;
  priorRoundSeedLamports: number;
  donationsOrUnexpectedDepositsLamports: number;
  distributablePotLamports: number;
  winnerPayoutLamports: number;
  nextRoundSeedLamports: number;
  otherReservedLiabilitiesLamports: number;
};

export const EMPTY_LEDGER: LottoLedger = {
  accountBalanceLamports: 0,
  rentExemptReserveLamports: 0,
  ticketGrossLamports: 0,
  kennelFeeLamports: 0,
  priorRoundSeedLamports: 0,
  donationsOrUnexpectedDepositsLamports: 0,
  distributablePotLamports: 0,
  winnerPayoutLamports: 0,
  nextRoundSeedLamports: 0,
  otherReservedLiabilitiesLamports: 0,
};

export const WINNER_SHARE_BPS = 85;
export const SHARE_DENOM = 100;
export const SLIP_FEE_BPS = 1;

export function kennelFeeLamports(ticketGrossLamports: number) {
  return Math.floor((Math.max(0, Math.floor(ticketGrossLamports)) * SLIP_FEE_BPS) / SHARE_DENOM);
}

export function winnerPayoutLamports(distributablePotLamports: number) {
  return Math.floor((Math.max(0, Math.floor(distributablePotLamports)) * WINNER_SHARE_BPS) / SHARE_DENOM);
}

export function buildLedger(input: {
  accountBalanceLamports: number;
  rentExemptReserveLamports: number;
  ticketCount: number;
  ticketPriceLamports: number;
  currentRound?: number;
}): LottoLedger {
  const accountBalanceLamports = Math.max(0, Math.floor(input.accountBalanceLamports));
  const rentExemptReserveLamports = Math.max(0, Math.floor(input.rentExemptReserveLamports));
  const ticketGrossLamports =
    Math.max(0, Math.floor(input.ticketCount)) * Math.max(0, Math.floor(input.ticketPriceLamports));
  const fee = kennelFeeLamports(ticketGrossLamports);
  const ticketNet = ticketGrossLamports - fee;
  const distributablePotLamports = Math.max(0, accountBalanceLamports - rentExemptReserveLamports);
  const excess = Math.max(0, distributablePotLamports - ticketNet);
  const priorRoundSeedLamports = (input.currentRound ?? 0) > 0 ? excess : 0;
  const donationsOrUnexpectedDepositsLamports = (input.currentRound ?? 0) > 0 ? 0 : excess;
  const winner = winnerPayoutLamports(distributablePotLamports);
  return {
    accountBalanceLamports,
    rentExemptReserveLamports,
    ticketGrossLamports,
    kennelFeeLamports: fee,
    priorRoundSeedLamports,
    donationsOrUnexpectedDepositsLamports,
    distributablePotLamports,
    winnerPayoutLamports: winner,
    nextRoundSeedLamports: distributablePotLamports - winner,
    otherReservedLiabilitiesLamports: 0,
  };
}

export function assertLedgerConserved(ledger: LottoLedger) {
  const ticketNet = ledger.ticketGrossLamports - ledger.kennelFeeLamports;
  const accountedDistributable =
    ticketNet + ledger.priorRoundSeedLamports + ledger.donationsOrUnexpectedDepositsLamports;
  return (
    ledger.accountBalanceLamports === ledger.rentExemptReserveLamports + ledger.distributablePotLamports &&
    ledger.distributablePotLamports === ledger.winnerPayoutLamports + ledger.nextRoundSeedLamports &&
    ledger.distributablePotLamports === accountedDistributable &&
    ledger.ticketGrossLamports === ledger.kennelFeeLamports + ticketNet
  );
}

export function ownerForTicket(
  buyers: { wallet: string; tickets: number; fromIndex: number }[],
  winnerIndex: number,
) {
  return buyers.find((row) => winnerIndex >= row.fromIndex && winnerIndex < row.fromIndex + row.tickets)?.wallet ?? null;
}
