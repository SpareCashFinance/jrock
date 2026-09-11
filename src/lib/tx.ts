import { Transaction, VersionedTransaction } from "@solana/web3.js";

function toBytes(b64: string) {
  const bin = atob(b64);
  const raw = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) raw[i] = bin.charCodeAt(i);
  return raw;
}

export function decodeTx(b64: string): Transaction | VersionedTransaction {
  const raw = toBytes(b64);
  try {
    return Transaction.from(raw);
  } catch {
    return VersionedTransaction.deserialize(raw);
  }
}

export function encodeTx(tx: Transaction | VersionedTransaction) {
  const raw =
    tx instanceof VersionedTransaction
      ? tx.serialize()
      : tx.serialize({ requireAllSignatures: false, verifySignatures: false });
  const bytes = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
