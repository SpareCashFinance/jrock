import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import {
  JROCK_LOTTO_V2_PROGRAM_ID,
  configPda,
  isLottoV2,
  lottoProgramKey,
  roundPda,
} from "./lotto-program";

export { JROCK_LOTTO_V2_PROGRAM_ID, isLottoV2 };
export const ORAO_VRF_PROGRAM_ID = "VRFzZoJdhFWL8rkvu87LpKM3RbcVezpMEc6X5GVDr7y";

const IX = {
  initialize: [175, 175, 109, 31, 13, 152, 155, 237],
  setRoundSecs: [161, 155, 62, 109, 203, 221, 239, 254],
  openRound: [66, 235, 123, 240, 8, 35, 185, 159],
  buy: [102, 6, 61, 18, 1, 218, 235, 234],
  closeSales: [63, 216, 175, 193, 204, 39, 113, 225],
  requestRandomness: [213, 5, 173, 166, 37, 236, 31, 18],
  fulfillRandomness: [235, 105, 140, 46, 40, 88, 117, 2],
  settle: [175, 42, 185, 87, 144, 131, 102, 212],
  claim: [62, 198, 214, 193, 213, 159, 108, 210],
  refundOne: [51, 162, 110, 71, 71, 81, 71, 58],
} as const;

const ACCOUNT = {
  config: [155, 12, 170, 224, 30, 250, 204, 130],
  round: [87, 127, 165, 51, 73, 78, 116, 174],
} as const;

const STATUS = [
  "open",
  "closed",
  "randomness_requested",
  "fulfilled",
  "settled",
  "claimed",
  "void",
  "refunding",
  "refunded",
] as const;

export type OnchainRoundV2Status = (typeof STATUS)[number];

export type OnchainBuyerV2 = {
  wallet: string;
  tickets: number;
  fromIndex: number;
  refunded: boolean;
};

export type OnchainConfigV2 = {
  authority: string;
  ticketLamports: number;
  roundSecs: number;
  vrfTimeoutSecs: number;
  currentRound: number;
  bump: number;
};

export type OnchainRoundV2 = {
  roundId: number;
  startTs: number;
  endTs: number;
  closeTs: number;
  vrfTimeoutTs: number;
  ticketCount: number;
  winnerIndex: number;
  winner: string;
  vrfSeed: string;
  vrfRandomness: string;
  vrfRequest: string;
  status: OnchainRoundV2Status;
  buyers: OnchainBuyerV2[];
  bump: number;
};

export function oraoNetworkStatePda(vrf = new PublicKey(ORAO_VRF_PROGRAM_ID)) {
  return PublicKey.findProgramAddressSync([textBytes("orao-vrf-network-configuration")], vrf);
}

export function oraoRequestPda(seed: Uint8Array, vrf = new PublicKey(ORAO_VRF_PROGRAM_ID)) {
  return PublicKey.findProgramAddressSync([textBytes("orao-vrf-randomness-request"), seed], vrf);
}

export function oraoTreasuryFromNetworkState(data: Uint8Array) {
  if (data.length < 8 + 32 + 32) return null;
  return new PublicKey(data.slice(8 + 32, 8 + 64));
}

function textBytes(value: string) {
  return new TextEncoder().encode(value);
}

function disc(values: readonly number[]) {
  return Uint8Array.from(values);
}

function concat(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function u64le(value: number | bigint) {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, BigInt(value), true);
  return out;
}

function i64le(value: number) {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigInt64(0, BigInt(value), true);
  return out;
}

function u32le(value: number) {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value, true);
  return out;
}

function viewAt(data: Uint8Array, offset: number, length: number) {
  return new DataView(data.buffer, data.byteOffset + offset, length);
}

function matches(bytes: Uint8Array, expected: readonly number[]) {
  return expected.every((value, index) => bytes[index] === value);
}

function readPubkey(data: Uint8Array, offset: number) {
  return new PublicKey(data.slice(offset, offset + 32)).toBase58();
}

function readU64(data: Uint8Array, offset: number) {
  return Number(viewAt(data, offset, 8).getBigUint64(0, true));
}

function readI64(data: Uint8Array, offset: number) {
  return Number(viewAt(data, offset, 8).getBigInt64(0, true));
}

function readU32(data: Uint8Array, offset: number) {
  return viewAt(data, offset, 4).getUint32(0, true);
}

function ixData(bytes: Uint8Array) {
  return bytes as unknown as Buffer;
}

function toHex(data: Uint8Array) {
  return [...data].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function decodeConfigV2(data: Uint8Array): OnchainConfigV2 | null {
  if (data.length < 8 + 32 + 8 * 4 + 1 || !matches(data, ACCOUNT.config)) return null;
  let o = 8;
  const authority = readPubkey(data, o);
  o += 32;
  const ticketLamports = readU64(data, o);
  o += 8;
  const roundSecs = readI64(data, o);
  o += 8;
  const vrfTimeoutSecs = readI64(data, o);
  o += 8;
  const currentRound = readU64(data, o);
  o += 8;
  return { authority, ticketLamports, roundSecs, vrfTimeoutSecs, currentRound, bump: data[o] ?? 0 };
}

export function decodeRoundV2(data: Uint8Array): OnchainRoundV2 | null {
  if (data.length < 8 + 8 * 5 + 4 * 2 + 32 * 4 + 1 + 4 || !matches(data, ACCOUNT.round)) return null;
  let o = 8;
  const roundId = readU64(data, o);
  o += 8;
  const startTs = readI64(data, o);
  o += 8;
  const endTs = readI64(data, o);
  o += 8;
  const closeTs = readI64(data, o);
  o += 8;
  const vrfTimeoutTs = readI64(data, o);
  o += 8;
  const ticketCount = readU32(data, o);
  o += 4;
  const winnerIndex = readU32(data, o);
  o += 4;
  const winner = readPubkey(data, o);
  o += 32;
  const vrfSeed = toHex(data.slice(o, o + 32));
  o += 32;
  const vrfRandomness = toHex(data.slice(o, o + 32));
  o += 32;
  const vrfRequest = readPubkey(data, o);
  o += 32;
  const status = STATUS[data[o] ?? 0] ?? "open";
  o += 1;
  const buyerCount = readU32(data, o);
  o += 4;
  const buyers: OnchainBuyerV2[] = [];
  for (let i = 0; i < buyerCount && o + 41 <= data.length; i += 1) {
    buyers.push({
      wallet: readPubkey(data, o),
      tickets: readU32(data, o + 32),
      fromIndex: readU32(data, o + 36),
      refunded: (data[o + 40] ?? 0) !== 0,
    });
    o += 41;
  }
  return {
    roundId,
    startTs,
    endTs,
    closeTs,
    vrfTimeoutTs,
    ticketCount,
    winnerIndex,
    winner,
    vrfSeed,
    vrfRandomness,
    vrfRequest,
    status,
    buyers,
    bump: data[o] ?? 0,
  };
}

function program() {
  return isLottoV2() ? lottoProgramKey() : new PublicKey(JROCK_LOTTO_V2_PROGRAM_ID);
}

export function initializeIxV2(authority: PublicKey, ticketLamports: number, roundSecs: number, vrfTimeoutSecs: number) {
  const programId = program();
  const [config] = configPda(programId);
  const [round] = roundPda(0, programId);
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: true },
      { pubkey: round, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: ixData(concat([disc(IX.initialize), u64le(ticketLamports), i64le(roundSecs), i64le(vrfTimeoutSecs)])),
  });
}

export function setRoundSecsIxV2(authority: PublicKey, roundSecs: number) {
  const programId = program();
  const [config] = configPda(programId);
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: false },
      { pubkey: config, isSigner: false, isWritable: true },
    ],
    data: ixData(concat([disc(IX.setRoundSecs), i64le(roundSecs)])),
  });
}

export function openRoundIxV2(payer: PublicKey, currentRound: number) {
  const programId = program();
  const [config] = configPda(programId);
  const [previous] = roundPda(currentRound - 1, programId);
  const [round] = roundPda(currentRound, programId);
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: previous, isSigner: false, isWritable: true },
      { pubkey: round, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: ixData(disc(IX.openRound)),
  });
}

export function buyIxV2(buyer: PublicKey, currentRound: number, tickets: number, feeWallet: PublicKey) {
  const programId = program();
  const [config] = configPda(programId);
  const [round] = roundPda(currentRound, programId);
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: buyer, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: round, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: feeWallet, isSigner: false, isWritable: true },
    ],
    data: ixData(concat([disc(IX.buy), Uint8Array.from([tickets])])),
  });
}

export function closeSalesIxV2(currentRound: number) {
  const programId = program();
  const [config] = configPda(programId);
  const [round] = roundPda(currentRound, programId);
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: config, isSigner: false, isWritable: true },
      { pubkey: round, isSigner: false, isWritable: true },
    ],
    data: ixData(disc(IX.closeSales)),
  });
}

export function requestRandomnessIxV2(
  payer: PublicKey,
  currentRound: number,
  vrfRequest: PublicKey,
  treasury: PublicKey,
) {
  const programId = program();
  const [config] = configPda(programId);
  const [round] = roundPda(currentRound, programId);
  const [networkState] = oraoNetworkStatePda();
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: round, isSigner: false, isWritable: true },
      { pubkey: new PublicKey(ORAO_VRF_PROGRAM_ID), isSigner: false, isWritable: false },
      { pubkey: networkState, isSigner: false, isWritable: true },
      { pubkey: treasury, isSigner: false, isWritable: true },
      { pubkey: vrfRequest, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: ixData(disc(IX.requestRandomness)),
  });
}

export function fulfillRandomnessIxV2(currentRound: number, vrfRequest: PublicKey) {
  const programId = program();
  const [config] = configPda(programId);
  const [round] = roundPda(currentRound, programId);
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: round, isSigner: false, isWritable: true },
      { pubkey: vrfRequest, isSigner: false, isWritable: false },
    ],
    data: ixData(disc(IX.fulfillRandomness)),
  });
}

export function settleIxV2(currentRound: number, vrfRequest: PublicKey) {
  const programId = program();
  const [config] = configPda(programId);
  const [round] = roundPda(currentRound, programId);
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: round, isSigner: false, isWritable: true },
      { pubkey: vrfRequest, isSigner: false, isWritable: false },
    ],
    data: ixData(disc(IX.settle)),
  });
}

export function claimIxV2(currentRound: number, winner: PublicKey) {
  const programId = program();
  const [config] = configPda(programId);
  const [round] = roundPda(currentRound, programId);
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: config, isSigner: false, isWritable: true },
      { pubkey: round, isSigner: false, isWritable: true },
      { pubkey: winner, isSigner: false, isWritable: true },
    ],
    data: ixData(disc(IX.claim)),
  });
}

export function refundOneIxV2(currentRound: number, buyer: PublicKey, buyerIndex: number) {
  const programId = program();
  const [config] = configPda(programId);
  const [round] = roundPda(currentRound, programId);
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: config, isSigner: false, isWritable: true },
      { pubkey: round, isSigner: false, isWritable: true },
      { pubkey: buyer, isSigner: false, isWritable: true },
    ],
    data: ixData(concat([disc(IX.refundOne), u32le(buyerIndex)])),
  });
}
