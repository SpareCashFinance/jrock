import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";

export const JROCK_LOTTO_PROGRAM_ID = "FvQfcJYAcRFEDeq8rS19MNXTZfeiCxcSN5nmfA6RdWuC";
export const SLOT_HASHES = new PublicKey("SysvarS1otHashes111111111111111111111111111");

const IX = {
  initialize: [175, 175, 109, 31, 13, 152, 155, 237],
  openRound: [66, 235, 123, 240, 8, 35, 185, 159],
  buy: [102, 6, 61, 18, 1, 218, 235, 234],
  closeSales: [63, 216, 175, 193, 204, 39, 113, 225],
  settle: [175, 42, 185, 87, 144, 131, 102, 212],
  claim: [62, 198, 214, 193, 213, 159, 108, 210],
} as const;

const ACCOUNT = {
  config: [155, 12, 170, 224, 30, 250, 204, 130],
  round: [87, 127, 165, 51, 73, 78, 116, 174],
} as const;

export type LottoEngine = "program" | "wallet";

export type OnchainBuyer = {
  wallet: string;
  tickets: number;
  fromIndex: number;
};

export type OnchainConfig = {
  authority: string;
  ticketLamports: number;
  roundSecs: number;
  lagSlots: number;
  currentRound: number;
  bump: number;
};

export type OnchainRound = {
  roundId: number;
  startTs: number;
  endTs: number;
  entropySlot: number;
  ticketCount: number;
  winnerIndex: number;
  winner: string;
  entropyHash: string;
  status: "open" | "closed" | "settled" | "claimed" | "void";
  buyers: OnchainBuyer[];
  bump: number;
};

export function lottoProgramId() {
  return (process.env.NEXT_PUBLIC_LOTTO_PROGRAM ?? JROCK_LOTTO_PROGRAM_ID).trim();
}

export function hasLottoProgram() {
  return lottoProgramId().length >= 32;
}

export function lottoProgramKey() {
  return new PublicKey(lottoProgramId());
}

export function configPda(program = lottoProgramKey()) {
  return PublicKey.findProgramAddressSync([Buffer.from("config")], program);
}

export function roundPda(roundId: number, program = lottoProgramKey()) {
  const id = Buffer.alloc(8);
  id.writeBigUInt64LE(BigInt(roundId));
  return PublicKey.findProgramAddressSync([Buffer.from("round"), id], program);
}

function disc(values: readonly number[]) {
  return Buffer.from(values);
}

function u64le(value: number | bigint) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(value));
  return buf;
}

function i64le(value: number) {
  const buf = Buffer.alloc(8);
  buf.writeBigInt64LE(BigInt(value));
  return buf;
}

function matches(bytes: Uint8Array, expected: readonly number[]) {
  return expected.every((value, index) => bytes[index] === value);
}

function readPubkey(data: Uint8Array, offset: number) {
  return new PublicKey(data.slice(offset, offset + 32)).toBase58();
}

function readU64(data: Uint8Array, offset: number) {
  const view = Buffer.from(data.slice(offset, offset + 8));
  return Number(view.readBigUInt64LE(0));
}

function readI64(data: Uint8Array, offset: number) {
  const view = Buffer.from(data.slice(offset, offset + 8));
  return Number(view.readBigInt64LE(0));
}

function readU32(data: Uint8Array, offset: number) {
  return Buffer.from(data.slice(offset, offset + 4)).readUInt32LE(0);
}

const STATUS = ["open", "closed", "settled", "claimed", "void"] as const;

export function decodeConfig(data: Uint8Array): OnchainConfig | null {
  if (data.length < 8 + 32 + 8 * 4 + 1 || !matches(data, ACCOUNT.config)) return null;
  let o = 8;
  const authority = readPubkey(data, o);
  o += 32;
  const ticketLamports = readU64(data, o);
  o += 8;
  const roundSecs = readI64(data, o);
  o += 8;
  const lagSlots = readU64(data, o);
  o += 8;
  const currentRound = readU64(data, o);
  o += 8;
  return { authority, ticketLamports, roundSecs, lagSlots, currentRound, bump: data[o] ?? 0 };
}

export function decodeRound(data: Uint8Array): OnchainRound | null {
  if (data.length < 118 || !matches(data, ACCOUNT.round)) return null;
  let o = 8;
  const roundId = readU64(data, o);
  o += 8;
  const startTs = readI64(data, o);
  o += 8;
  const endTs = readI64(data, o);
  o += 8;
  const entropySlot = readU64(data, o);
  o += 8;
  const ticketCount = readU32(data, o);
  o += 4;
  const winnerIndex = readU32(data, o);
  o += 4;
  const winner = readPubkey(data, o);
  o += 32;
  const entropyHash = Buffer.from(data.slice(o, o + 32)).toString("hex");
  o += 32;
  const status = STATUS[data[o] ?? 0] ?? "open";
  o += 1;
  const buyerCount = readU32(data, o);
  o += 4;
  const buyers: OnchainBuyer[] = [];
  for (let i = 0; i < buyerCount && o + 40 <= data.length; i += 1) {
    buyers.push({
      wallet: readPubkey(data, o),
      tickets: readU32(data, o + 32),
      fromIndex: readU32(data, o + 36),
    });
    o += 40;
  }
  return {
    roundId,
    startTs,
    endTs,
    entropySlot,
    ticketCount,
    winnerIndex,
    winner,
    entropyHash,
    status,
    buyers,
    bump: data[o] ?? 0,
  };
}

export function initializeIx(authority: PublicKey, ticketLamports: number, roundSecs: number, lagSlots: number) {
  const program = lottoProgramKey();
  const [config] = configPda(program);
  const [round] = roundPda(0, program);
  return new TransactionInstruction({
    programId: program,
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: true },
      { pubkey: round, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([disc(IX.initialize), u64le(ticketLamports), i64le(roundSecs), u64le(lagSlots)]),
  });
}

export function openRoundIx(payer: PublicKey, currentRound: number) {
  const program = lottoProgramKey();
  const [config] = configPda(program);
  const [previous] = roundPda(currentRound - 1, program);
  const [round] = roundPda(currentRound, program);
  return new TransactionInstruction({
    programId: program,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: previous, isSigner: false, isWritable: false },
      { pubkey: round, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: disc(IX.openRound),
  });
}

export function buyIxForRound(buyer: PublicKey, currentRound: number, tickets: number) {
  const program = lottoProgramKey();
  const [config] = configPda(program);
  const [round] = roundPda(currentRound, program);
  return new TransactionInstruction({
    programId: program,
    keys: [
      { pubkey: buyer, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: round, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([disc(IX.buy), Buffer.from([tickets])]),
  });
}

export function closeSalesIx(currentRound: number) {
  const program = lottoProgramKey();
  const [config] = configPda(program);
  const [round] = roundPda(currentRound, program);
  return new TransactionInstruction({
    programId: program,
    keys: [
      { pubkey: config, isSigner: false, isWritable: true },
      { pubkey: round, isSigner: false, isWritable: true },
    ],
    data: disc(IX.closeSales),
  });
}

export function settleIx(currentRound: number) {
  const program = lottoProgramKey();
  const [config] = configPda(program);
  const [round] = roundPda(currentRound, program);
  return new TransactionInstruction({
    programId: program,
    keys: [
      { pubkey: config, isSigner: false, isWritable: false },
      { pubkey: round, isSigner: false, isWritable: true },
      { pubkey: SLOT_HASHES, isSigner: false, isWritable: false },
    ],
    data: disc(IX.settle),
  });
}

export function claimIx(currentRound: number, winner: PublicKey) {
  const program = lottoProgramKey();
  const [config] = configPda(program);
  const [round] = roundPda(currentRound, program);
  return new TransactionInstruction({
    programId: program,
    keys: [
      { pubkey: config, isSigner: false, isWritable: true },
      { pubkey: round, isSigner: false, isWritable: true },
      { pubkey: winner, isSigner: false, isWritable: true },
    ],
    data: disc(IX.claim),
  });
}

