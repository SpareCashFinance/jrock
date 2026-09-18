import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PROGRAM_ID = new PublicKey("66FyiUTkw4JMYMi3yErfa7UBqrHm9GZha1meAxcgbjDg");
const CONFIG = new PublicKey("FBFL6W8ARdkhNM1WFhEfKHqw3HohacK1qhy9jhXQPLwv");
const ROUND = new PublicKey("6R2TdLtWQEqgUVe2yLnhf1GKX651JHja1yUfwEurL8st");
const COMPACT_DISC = Buffer.from([10, 31, 187, 65, 146, 127, 211, 225]);
const RPC = process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com";
const KEY_PATH = process.env.SOLANA_KEYPAIR || join(homedir(), ".config", "solana", "jrock-deployer.json");

const secret = Uint8Array.from(JSON.parse(readFileSync(KEY_PATH, "utf8")));
const payer = Keypair.fromSecretKey(secret);
const connection = new Connection(RPC, "confirmed");
const before = await connection.getAccountInfo(ROUND, "confirmed");
const tx = new Transaction().add(
  ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 150_000 }),
  new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: CONFIG, isSigner: false, isWritable: false },
      { pubkey: ROUND, isSigner: false, isWritable: true },
    ],
    data: COMPACT_DISC,
  }),
);
const sig = await sendAndConfirmTransaction(connection, tx, [payer], { commitment: "confirmed" });
const after = await connection.getAccountInfo(ROUND, "confirmed");
console.log(
  JSON.stringify(
    {
      signature: sig,
      round: ROUND.toBase58(),
      beforeBytes: before?.data.length ?? 0,
      afterBytes: after?.data.length ?? 0,
      lamports: after?.lamports ?? 0,
    },
    null,
    2,
  ),
);
