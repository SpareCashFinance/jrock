#!/usr/bin/env node
/**
 * Independent kennel-lotto verifier. Talks to public Solana RPC only.
 * Usage: node scripts/verify-lotto.mjs [roundId|roundPda]
 */
import { createHash } from "node:crypto";
import { Connection, PublicKey } from "@solana/web3.js";

const PROGRAM = "FvQfcJYAcRFEDeq8rS19MNXTZfeiCxcSN5nmfA6RdWuC";
const RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const STATUS = ["open", "closed", "settled", "claimed", "void"];

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

async function main() {
  const arg = process.argv[2] ?? "0";
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
  const decodedRoundId = readU64(r, o); o += 8;
  const startTs = readI64(r, o); o += 8;
  const endTs = readI64(r, o); o += 8;
  const entropySlot = readU64(r, o); o += 8;
  const ticketCount = r.readUInt32LE(o); o += 4;
  const winnerIndex = r.readUInt32LE(o); o += 4;
  const winner = pk(r, o); o += 32;
  const entropyHash = r.subarray(o, o + 32); o += 32;
  const status = STATUS[r[o] ?? 0] ?? "open"; o += 1;
  const buyerCount = r.readUInt32LE(o); o += 4;
  const buyers = [];
  for (let i = 0; i < buyerCount; i += 1) {
    buyers.push({
      wallet: pk(r, o),
      tickets: r.readUInt32LE(o + 32),
      fromIndex: r.readUInt32LE(o + 36),
    });
    o += 40;
  }

  const rent = await rpc.getMinimumBalanceForRentExemption(info.data.length, "confirmed");
  const gross = ticketCount * ticketLamports;
  const fee = Math.floor((gross * 1) / 100);
  const dist = Math.max(0, info.lamports - rent);
  const winnerPay = Math.floor((dist * 85) / 100);
  const seed = dist - winnerPay;

  let computed = null;
  const hashHex = Buffer.from(entropyHash).toString("hex");
  if ((status === "settled" || status === "claimed") && ticketCount > 0 && hashHex !== "0".repeat(64)) {
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

  const out = {
    rpc: RPC,
    program: PROGRAM,
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
    entropyHash: hashHex === "0".repeat(64) ? null : hashHex,
    storedWinner: status === "settled" || status === "claimed" ? winner : null,
    storedWinnerIndex: status === "settled" || status === "claimed" ? winnerIndex : null,
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
    mapping: "u64be(sha256(slot_hash || round_id_le || ticket_count_le)[0..8]) % n  in 0..n-1. INTERIM SlotHashes, not VRF.",
  };
  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
