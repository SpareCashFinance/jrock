import { Connection, PublicKey } from "@solana/web3.js";
import { assertLedgerConserved, buildLedger, ownerForTicket, type LottoLedger } from "@/lib/lotto-ledger";
import { winnerIndexFromSlotHash } from "@/lib/lotto";
import {
  configPda,
  decodeConfig,
  decodeRound,
  isLottoV2,
  lottoProgramId,
  roundPda,
  type OnchainRound,
} from "@/lib/lotto-program";
import { decodeConfigV2, decodeRoundV2 } from "@/lib/lotto-program-v2";
import { hexToBytes, winnerFromVrfEntropy } from "@/lib/lotto-vrf";

export const PUBLIC_SOLANA_RPC = "https://api.mainnet-beta.solana.com";
export const LOTTO_MAPPING_V1 =
  "winnerIndex = u64be(sha256(slot_hash || round_id_le || ticket_count_le)[0..8]) % ticket_count (0..n-1). Remainder of integer division stays with the 15% seed. Not a VRF.";
export const LOTTO_MAPPING_V2 =
  "winnerIndex = rejection sampling of the first 32 bytes of the fulfilled ORAO VRF output into 0..ticket_count-1. Seed = sha256(program_id || round_pda || round_id_le || ticket_count_le). One request. Stored randomness cannot reroll.";
export const LOTTO_MAPPING = LOTTO_MAPPING_V1;

export type IndependentReceipt = {
  rpc: string;
  network: "solana-mainnet-beta";
  programId: string;
  configPda: string;
  roundPda: string;
  roundId: number;
  status: string;
  startsAt: string;
  endsAt: string;
  ticketPriceLamports: number;
  totalTickets: number;
  buyers: OnchainRound["buyers"];
  entropySlot: number | null;
  entropyHash: string | null;
  vrfRequest: string | null;
  computedWinnerIndex: number | null;
  storedWinnerIndex: number | null;
  computedWinner: string | null;
  storedWinner: string | null;
  matches: boolean | null;
  mapping: string;
  ledger: LottoLedger;
  conserved: boolean;
  limitations: string[];
};

function publicConnection() {
  return new Connection(PUBLIC_SOLANA_RPC, "confirmed");
}

export async function verifyRoundIndependent(input?: {
  roundId?: number;
  roundPda?: string;
  rpc?: Connection;
  rpcUrl?: string;
}): Promise<IndependentReceipt> {
  const rpc = input?.rpc ?? publicConnection();
  const programId = lottoProgramId();
  const [configPk] = configPda();
  const configInfo = await rpc.getAccountInfo(configPk, "confirmed");
  if (!configInfo?.data) throw new Error("Config PDA is missing on this RPC.");

  if (isLottoV2(programId)) {
    return verifyV2(rpc, configPk, configInfo.data, programId, input);
  }
  return verifyV1(rpc, configPk, configInfo.data, programId, input);
}

async function verifyV1(
  rpc: Connection,
  configPk: PublicKey,
  configData: Uint8Array,
  programId: string,
  input?: { roundId?: number; roundPda?: string; rpcUrl?: string },
): Promise<IndependentReceipt> {
  const config = decodeConfig(configData);
  if (!config) throw new Error("Config PDA did not decode.");

  let roundId = input?.roundId;
  let roundPk: PublicKey;
  if (input?.roundPda) {
    roundPk = new PublicKey(input.roundPda);
  } else {
    roundId = roundId ?? config.currentRound;
    roundPk = roundPda(roundId)[0];
  }

  const roundInfo = await rpc.getAccountInfo(roundPk, "confirmed");
  if (!roundInfo?.data) throw new Error(`Round account ${roundPk.toBase58()} is missing.`);
  const round = decodeRound(roundInfo.data);
  if (!round) throw new Error("Round account did not decode.");
  roundId = round.roundId;

  const rent = await rpc.getMinimumBalanceForRentExemption(roundInfo.data.length, "confirmed");
  const ledger = buildLedger({
    accountBalanceLamports: roundInfo.lamports,
    rentExemptReserveLamports: rent,
    ticketCount: round.ticketCount,
    ticketPriceLamports: config.ticketLamports,
    currentRound: round.roundId,
  });

  const settled = round.status === "settled" || round.status === "claimed";
  const entropyHash = round.entropyHash === "0".repeat(64) ? null : round.entropyHash;
  let computedWinnerIndex: number | null = null;
  let computedWinner: string | null = null;
  if (settled && entropyHash && round.ticketCount > 0) {
    const math = await winnerIndexFromSlotHash(entropyHash, round.roundId, round.ticketCount);
    computedWinnerIndex = math.index;
    computedWinner = ownerForTicket(round.buyers, math.index);
  }

  const storedWinner = settled ? round.winner : null;
  const storedWinnerIndex = settled ? round.winnerIndex : null;
  const matches =
    computedWinnerIndex == null
      ? null
      : computedWinnerIndex === storedWinnerIndex && computedWinner === storedWinner;

  return {
    rpc: input?.rpcUrl || PUBLIC_SOLANA_RPC,
    network: "solana-mainnet-beta",
    programId,
    configPda: configPk.toBase58(),
    roundPda: roundPk.toBase58(),
    roundId,
    status: round.status,
    startsAt: new Date(round.startTs * 1000).toISOString(),
    endsAt: new Date(round.endTs * 1000).toISOString(),
    ticketPriceLamports: config.ticketLamports,
    totalTickets: round.ticketCount,
    buyers: round.buyers,
    entropySlot: round.entropySlot || null,
    entropyHash,
    vrfRequest: null,
    computedWinnerIndex,
    storedWinnerIndex,
    computedWinner,
    storedWinner,
    matches,
    mapping: LOTTO_MAPPING_V1,
    ledger,
    conserved: assertLedgerConserved(ledger),
    limitations: [
      "Randomness is Solana SlotHashes after close, not ORAO/Switchboard VRF.",
      "Modulo mapping has a tiny bias for ticket counts that do not divide 2^64.",
      "If SlotHashes drops the locked slot, settle can fail and this round can stick until an upgrade.",
      "The program is upgradeable. A verified build is not filed. One wallet can replace the code.",
    ],
  };
}

async function verifyV2(
  rpc: Connection,
  configPk: PublicKey,
  configData: Uint8Array,
  programId: string,
  input?: { roundId?: number; roundPda?: string; rpcUrl?: string },
): Promise<IndependentReceipt> {
  const config = decodeConfigV2(configData);
  if (!config) throw new Error("Config PDA did not decode as v2.");

  let roundId = input?.roundId;
  let roundPk: PublicKey;
  if (input?.roundPda) {
    roundPk = new PublicKey(input.roundPda);
  } else {
    roundId = roundId ?? config.currentRound;
    roundPk = roundPda(roundId)[0];
  }

  const roundInfo = await rpc.getAccountInfo(roundPk, "confirmed");
  if (!roundInfo?.data) throw new Error(`Round account ${roundPk.toBase58()} is missing.`);
  const round = decodeRoundV2(roundInfo.data);
  if (!round) throw new Error("Round account did not decode as v2.");
  roundId = round.roundId;

  const rent = await rpc.getMinimumBalanceForRentExemption(roundInfo.data.length, "confirmed");
  const ledger = buildLedger({
    accountBalanceLamports: roundInfo.lamports,
    rentExemptReserveLamports: rent,
    ticketCount: round.ticketCount,
    ticketPriceLamports: config.ticketLamports,
    currentRound: round.roundId,
  });

  const settled = round.status === "settled" || round.status === "claimed";
  const entropyHash = round.vrfRandomness === "0".repeat(64) ? null : round.vrfRandomness;
  let computedWinnerIndex: number | null = null;
  let computedWinner: string | null = null;
  if (settled && entropyHash && round.ticketCount > 0) {
    const math = await winnerFromVrfEntropy(hexToBytes(entropyHash), round.ticketCount);
    computedWinnerIndex = math.index;
    computedWinner = ownerForTicket(round.buyers, math.index);
  }

  const storedWinner = settled ? round.winner : null;
  const storedWinnerIndex = settled ? round.winnerIndex : null;
  const matches =
    computedWinnerIndex == null
      ? null
      : computedWinnerIndex === storedWinnerIndex && computedWinner === storedWinner;
  const defaultPk = "11111111111111111111111111111111";

  return {
    rpc: input?.rpcUrl || PUBLIC_SOLANA_RPC,
    network: "solana-mainnet-beta",
    programId,
    configPda: configPk.toBase58(),
    roundPda: roundPk.toBase58(),
    roundId,
    status: round.status,
    startsAt: new Date(round.startTs * 1000).toISOString(),
    endsAt: new Date(round.endTs * 1000).toISOString(),
    ticketPriceLamports: config.ticketLamports,
    totalTickets: round.ticketCount,
    buyers: round.buyers,
    entropySlot: null,
    entropyHash,
    vrfRequest: round.vrfRequest && round.vrfRequest !== defaultPk ? round.vrfRequest : null,
    computedWinnerIndex,
    storedWinnerIndex,
    computedWinner,
    storedWinner,
    matches,
    mapping: LOTTO_MAPPING_V2,
    ledger,
    conserved: assertLedgerConserved(ledger),
    limitations: [
      round.ticketCount === 0
        ? "This round is still open with 0 slips. A winner is always one of the wallets that bought. An empty book cannot pick a wallet."
        : settled
          ? "If anyone bought, settle mapped the stored ORAO bytes onto one of those wallets. Recompute from those bytes, not this website."
          : "A winner is always one of the wallets that bought. This round is not settled yet, so there is no stored winner to recompute.",
      "ORAO VRF Classic must fulfill before settle. A winner is always one of the wallets that bought. refund_one is disabled.",
      "The book holds 256 buy rows this round. Explorer verification is filed against SpareCashFinance/jrock-lotto.",
      "Upgrade authority is a single kennel wallet. Do not treat a verified ELF as an immutable program.",
    ],
  };
}
