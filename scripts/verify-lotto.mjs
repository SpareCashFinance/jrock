#!/usr/bin/env node
/**
 * Independent kennel-lotto verifier. Talks to public Solana RPC only.
 * Usage: node scripts/verify-lotto.mjs [roundId|roundPda]
 * Optional: LOTTO_PROGRAM / NEXT_PUBLIC_LOTTO_PROGRAM to point at v2.
 */
import { createHash } from "node:crypto";
import { Connection, PublicKey } from "@solana/web3.js";

const V1 = "FvQfcJYAcRFEDeq8rS19MNXTZfeiCxcSN5nmfA6RdWuC";
const V2 = "66FyiUTkw4JMYMi3yErfa7UBqrHm9GZha1meAxcgbjDg";
const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const PROGRAM = (process.env.LOTTO_PROGRAM || process.env.NEXT_PUBLIC_LOTTO_PROGRAM || V1).trim();
const STATUS_V1 = ["open", "closed", "settled", "claimed", "void"];
const STATUS_V2 = [
  "open",
  "closed",
  "randomness_requested",
  "fulfilled",
  "settled",
  "claimed",
  "void",
  "refunding",
  "refunded",
];

function u64le(n) {
  const out = Buffer.alloc(8);
  out.writeBigUInt64LE(BigInt(n));
  return out;
}

function readU64(buf, o) {
  return Number(buf.readBigUInt64LE(o));
}

function readI64(buf, o) {
  return Number(buf.readBigInt64LE(o));
}

function pk(buf, o) {
  return new PublicKey(buf.subarray(o, o + 32)).toBase58();
}

function hex(buf) {
  return Buffer.from(buf).toString("hex");
}

function winnerFromVrf(entropy, ticketCount) {
  if (ticketCount <= 0) return null;
  if (ticketCount === 1) return 0;
  const n = BigInt(ticketCount);
  const max = (1n << 64n) - 1n;
  let rem = (max % n) + 1n;
  if (rem === n) rem = 0n;
  let seed = Buffer.from(entropy);
  for (let i = 0; i < 64; i += 1) {
    const x = seed.readBigUInt64BE(0);
    if (rem === 0n || x < (1n << 64n) - rem) return Number(x % n);
    seed = createHash("sha256").update(seed).digest();
  }
  return null;
}

async function main() {
  const arg = process.argv[2] ?? "0";
  const v2 = PROGRAM === V2;
  const program = new PublicKey(PROGRAM);
  const rpc = new Connection(RPC, "confirmed");
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], program);
  const configInfo = await rpc.getAccountInfo(configPda, "confirmed");
  if (!configInfo) throw new Error("config PDA missing");
  const cfg = Buffer.from(configInfo.data);
  const ticketLamports = readU64(cfg, 40);
  const currentRound = readU64(cfg, 64);

  let roundId = Number.parseInt(arg, 10);
  let roundPk;
  if (Number.isFinite(roundId) && arg.length < 32) {
    roundPk = PublicKey.findProgramAddressSync([Buffer.from("round"), u64le(roundId)], program)[0];
  } else {
    roundPk = new PublicKey(arg);
    roundId = -1;
  }

  const info = await rpc.getAccountInfo(roundPk, "confirmed");
  if (!info) throw new Error("round missing");
  const r = Buffer.from(info.data);
  let o = 8;
  const decodedRoundId = readU64(r, o);
  o += 8;
  const startTs = readI64(r, o);
  o += 8;
  const endTs = readI64(r, o);
  o += 8;

  let entropySlot = 0;
  let closeTs = 0;
  let vrfTimeoutTs = 0;
  if (v2) {
    closeTs = readI64(r, o);
    o += 8;
    vrfTimeoutTs = readI64(r, o);
    o += 8;
  } else {
    entropySlot = readU64(r, o);
    o += 8;
  }

  const ticketCount = r.readUInt32LE(o);
  o += 4;
  const winnerIndex = r.readUInt32LE(o);
  o += 4;
  const winner = pk(r, o);
  o += 32;
  const entropyHash = r.subarray(o, o + 32);
  o += 32;
  let vrfRequest = null;
  if (v2) {
    vrfRequest = pk(r, o);
    o += 32;
  }
  const status = (v2 ? STATUS_V2 : STATUS_V1)[r[o] ?? 0] ?? "open";
  o += 1;
  const buyerCount = r.readUInt32LE(o);
  o += 4;
  const buyers = [];
  const rowSize = v2 ? 41 : 40;
  for (let i = 0; i < buyerCount; i += 1) {
    buyers.push({
      wallet: pk(r, o),
      tickets: r.readUInt32LE(o + 32),
      fromIndex: r.readUInt32LE(o + 36),
      refunded: v2 ? r[o + 40] !== 0 : false,
    });
    o += rowSize;
  }

  const rent = await rpc.getMinimumBalanceForRentExemption(info.data.length, "confirmed");
  const gross = ticketCount * ticketLamports;
  const fee = Math.floor((gross * 1) / 100);
  const dist = Math.max(0, info.lamports - rent);
  const winnerPay = Math.floor((dist * 85) / 100);
  const seed = dist - winnerPay;

  let computed = null;
  const hashHex = hex(entropyHash);
  const settled = status === "settled" || status === "claimed";
  if (settled && ticketCount > 0 && hashHex !== "0".repeat(64)) {
    if (v2) {
      const index = winnerFromVrf(entropyHash, ticketCount);
      const owner = buyers.find((row) => index >= row.fromIndex && index < row.fromIndex + row.tickets);
      computed = { index, owner: owner?.wallet ?? null, matches: index === winnerIndex && owner?.wallet === winner };
    } else {
      const countBuf = Buffer.alloc(4);
      countBuf.writeUInt32LE(ticketCount);
      const digest = createHash("sha256")
        .update(Buffer.concat([entropyHash, u64le(decodedRoundId), countBuf]))
        .digest();
      const random = digest.readBigUInt64BE(0);
      const index = Number(random % BigInt(ticketCount));
      const owner = buyers.find((row) => index >= row.fromIndex && index < row.fromIndex + row.tickets);
      computed = { index, owner: owner?.wallet ?? null, matches: index === winnerIndex && owner?.wallet === winner };
    }
  }

  const out = {
    rpc: RPC,
    program: PROGRAM,
    engine: v2 ? "v2-orao" : "v1-slothashes",
    configPda: configPda.toBase58(),
    currentRound,
    roundPda: roundPk.toBase58(),
    roundId: decodedRoundId,
    status,
    startsAt: new Date(startTs * 1000).toISOString(),
    endsAt: new Date(endTs * 1000).toISOString(),
    ticketCount,
    buyers,
    entropySlot: entropySlot || null,
    vrfRequest: v2 && vrfRequest !== "11111111111111111111111111111111" ? vrfRequest : null,
    vrfTimeoutAt: v2 && vrfTimeoutTs ? new Date(vrfTimeoutTs * 1000).toISOString() : null,
    closeTs: v2 && closeTs ? new Date(closeTs * 1000).toISOString() : null,
    entropyHash: hashHex === "0".repeat(64) ? null : hashHex,
    storedWinner: settled ? winner : null,
    storedWinnerIndex: settled ? winnerIndex : null,
    computed,
    ledger: {
      accountBalanceLamports: info.lamports,
      rentExemptReserveLamports: rent,
      ticketGrossLamports: gross,
      kennelFeeLamports: fee,
      distributablePotLamports: dist,
      winnerPayoutLamports: winnerPay,
      nextRoundSeedLamports: seed,
    },
    mapping: v2
      ? "rejection sampling of first 32 bytes of fulfilled ORAO output into 0..n-1"
      : "u64be(sha256(slot_hash || round_id_le || ticket_count_le)[0..8]) % n  in 0..n-1. INTERIM SlotHashes, not VRF.",
  };
  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
