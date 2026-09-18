import { Connection, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";

const SESSION = "1ff107";
const INGEST = "http://127.0.0.1:7449/ingest/52cf5c94-f293-4e30-be44-38f2c53ad0b0";
const PROGRAM_ID = new PublicKey("66FyiUTkw4JMYMi3yErfa7UBqrHm9GZha1meAxcgbjDg");
const ROUND = new PublicKey("6R2TdLtWQEqgUVe2yLnhf1GKX651JHja1yUfwEurL8st");
const CONFIG = new PublicKey("FBFL6W8ARdkhNM1WFhEfKHqw3HohacK1qhy9jhXQPLwv");
const REFUND_DISC = Buffer.from([51, 162, 110, 71, 71, 81, 71, 58]);
const RPC = process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com";
const RUN = process.env.LOTTO_CHECK_RUN || "pre-upgrade";

// #region agent log
function log(hypothesisId, location, message, data) {
  const body = {
    sessionId: SESSION,
    runId: RUN,
    hypothesisId,
    location,
    message,
    data,
    timestamp: Date.now(),
  };
  console.log(JSON.stringify(body));
  return fetch(INGEST, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": SESSION },
    body: JSON.stringify(body),
  }).catch(() => {});
}
// #endregion

const connection = new Connection(RPC, "confirmed");
const parsed = await connection.getParsedAccountInfo(PROGRAM_ID, "confirmed");
const programData = parsed.value?.data?.parsed?.info?.programData;
if (!programData) throw new Error("Missing program data address.");
const dataInfo = await connection.getAccountInfo(new PublicKey(programData), "confirmed");
const elf = dataInfo?.data ?? Buffer.alloc(0);
const telegram = elf.includes(Buffer.from("t.me/Jamiespetrock"));
const securityTxt = elf.includes(Buffer.from("https://petrock.fun/lotto/verify"));
const refundsDisabled = elf.includes(Buffer.from("does not refund"));
const bookFull = elf.includes(Buffer.from("The book is full"));

// #region agent log
await log("H1", "scripts/check-lotto-prod.mjs:elf", "Live ELF security strings", {
  programData,
  elfBytes: elf.length,
  telegram,
  securityTxt,
  refundsDisabled,
  bookFull,
});
// #endregion

const roundInfo = await connection.getAccountInfo(ROUND, "confirmed");
const buyerCount = roundInfo ? roundInfo.data.readUInt32LE(185) : 0;
const firstBuyer = roundInfo && buyerCount > 0 ? new PublicKey(roundInfo.data.slice(189, 221)).toBase58() : null;
const uniqueBuyers = new Set();
if (roundInfo) {
  for (let i = 0; i < buyerCount; i += 1) {
    uniqueBuyers.add(new PublicKey(roundInfo.data.slice(189 + i * 41, 221 + i * 41)).toBase58());
  }
}

// #region agent log
await log("H3", "scripts/check-lotto-prod.mjs:round", "Live round 0 account size", {
  round: ROUND.toBase58(),
  dataLen: roundInfo?.data.length ?? 0,
  lamports: roundInfo?.lamports ?? 0,
  buyerCount,
  uniqueBuyers: uniqueBuyers.size,
  firstBuyer,
});
// #endregion

const buyer = new PublicKey(firstBuyer || CONFIG.toBase58());
const tx = new Transaction();
tx.add(
  new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: CONFIG, isSigner: false, isWritable: true },
      { pubkey: ROUND, isSigner: false, isWritable: true },
      { pubkey: buyer, isSigner: false, isWritable: true },
    ],
    data: Buffer.concat([REFUND_DISC, Buffer.from([0, 0, 0, 0])]),
  }),
);
tx.feePayer = buyer;
tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
const sim = await connection.simulateTransaction(tx);
const logs = sim.value.logs ?? [];
const err = sim.value.err;

// #region agent log
await log("H2", "scripts/check-lotto-prod.mjs:refund", "refund_one simulation", {
  buyer: buyer.toBase58(),
  err,
  logs: logs.slice(-12),
  refundsDisabledLog: logs.some((line) => line.includes("RefundsDisabled") || line.includes("does not refund")),
});
// #endregion

try {
  const otter = await fetch(`https://verify.osec.io/status/${PROGRAM_ID.toBase58()}`, {
    signal: AbortSignal.timeout(8000),
  });
  const status = await otter.json();
  // #region agent log
  await log("H4", "scripts/check-lotto-prod.mjs:ottersec", "OtterSec verify status", {
    isVerified: status?.is_verified ?? status?.[0]?.is_verified ?? null,
    sha256: status?.sha256 ?? status?.[0]?.executable_hash ?? null,
    commit: status?.commit_hash ?? status?.[0]?.commit_hash ?? null,
  });
  // #endregion
} catch (error) {
  // #region agent log
  await log("H4", "scripts/check-lotto-prod.mjs:ottersec", "OtterSec verify status failed", {
    error: String(error),
  });
  // #endregion
}
