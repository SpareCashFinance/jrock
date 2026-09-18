import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const OTTER_VERIFY = new PublicKey("verifycLy8mB96wd9wqq3WDXQwM4oU6r42Th37Db9fC");
const PROGRAM_ID = new PublicKey("66FyiUTkw4JMYMi3yErfa7UBqrHm9GZha1meAxcgbjDg");
const INIT_DISC = Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]);
const UPDATE_DISC = Buffer.from([219, 200, 88, 176, 158, 63, 253, 127]);
const RPC = process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com";
const KEY_PATH = process.env.SOLANA_KEYPAIR || join(homedir(), ".config", "solana", "jrock-deployer.json");
const REPO = "https://github.com/SpareCashFinance/jrock-lotto";
const COMMIT = process.env.LOTTO_VERIFY_COMMIT || "ae90921aebd5dff6f08c67dc6d98fa9acdc621c7";
const VERSION = "0.5.1";
const ARGS = ["--library-name", "jrock_lotto_v2"];

function encodeString(value) {
  const bytes = Buffer.from(value, "utf8");
  const out = Buffer.alloc(4 + bytes.length);
  out.writeUInt32LE(bytes.length, 0);
  bytes.copy(out, 4);
  return out;
}

function encodeVecStrings(values) {
  const parts = [Buffer.alloc(4)];
  parts[0].writeUInt32LE(values.length, 0);
  for (const value of values) parts.push(encodeString(value));
  return Buffer.concat(parts);
}

function encodeU64(value) {
  const out = Buffer.alloc(8);
  out.writeBigUInt64LE(BigInt(value));
  return out;
}

function encodeParams(deployedSlot) {
  return Buffer.concat([
    encodeString(VERSION),
    encodeString(REPO),
    encodeString(COMMIT),
    encodeVecStrings(ARGS),
    encodeU64(deployedSlot),
  ]);
}

const secret = Uint8Array.from(JSON.parse(readFileSync(KEY_PATH, "utf8")));
const payer = Keypair.fromSecretKey(secret);
const connection = new Connection(RPC, "confirmed");
const [pda] = PublicKey.findProgramAddressSync(
  [Buffer.from("otter_verify"), payer.publicKey.toBuffer(), PROGRAM_ID.toBuffer()],
  OTTER_VERIFY,
);

const parsed = await connection.getParsedAccountInfo(PROGRAM_ID, "confirmed");
const programData = parsed.value?.data?.parsed?.info?.programData;
if (!programData) throw new Error("Program data address missing.");
const dataInfo = await connection.getParsedAccountInfo(new PublicKey(programData), "confirmed");
const deployedSlot = dataInfo.value?.data?.parsed?.info?.slot;
if (typeof deployedSlot !== "number") throw new Error("Deployed slot missing from program data.");

const existing = await connection.getAccountInfo(pda, "confirmed");
const disc = existing ? UPDATE_DISC : INIT_DISC;
const ix = new TransactionInstruction({
  programId: OTTER_VERIFY,
  keys: [
    { pubkey: pda, isSigner: false, isWritable: true },
    { pubkey: payer.publicKey, isSigner: true, isWritable: false },
    { pubkey: PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  data: Buffer.concat([disc, encodeParams(deployedSlot)]),
});

const tx = new Transaction().add(
  ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
  ix,
);
const sig = await sendAndConfirmTransaction(connection, tx, [payer], { commitment: "confirmed" });
console.log(JSON.stringify({ pda: pda.toBase58(), signer: payer.publicKey.toBase58(), deployedSlot, existing: Boolean(existing), signature: sig }, null, 2));

const job = await fetch("https://verify.osec.io/verify-with-signer", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    program_id: PROGRAM_ID.toBase58(),
    signer: payer.publicKey.toBase58(),
    repository: REPO,
    commit_hash: COMMIT,
  }),
});
const text = await job.text();
console.log(text);
