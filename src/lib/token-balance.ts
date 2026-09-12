import { LAMPORTS_PER_SOL, PublicKey, type Connection } from "@solana/web3.js";
import { WSOL_MINT } from "@/lib/solana";

const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

function parsedAmount(account: { account: { data: unknown } }) {
  const data = account.account.data as {
    parsed?: { info?: { mint?: string; tokenAmount?: { amount?: string; decimals?: number } } };
  };
  const info = data.parsed?.info;
  const amount = info?.tokenAmount?.amount;
  const decimals = info?.tokenAmount?.decimals;
  if (!amount || typeof decimals !== "number") return null;
  const n = Number(amount) / 10 ** decimals;
  return Number.isFinite(n) ? n : null;
}

export async function readTokenBalance(
  connection: Connection,
  owner: string,
  mint: string,
): Promise<number> {
  const ownerKey = new PublicKey(owner);
  if (mint === WSOL_MINT) {
    return (await connection.getBalance(ownerKey)) / LAMPORTS_PER_SOL;
  }

  const mintKey = new PublicKey(mint);
  const byMint = await connection.getParsedTokenAccountsByOwner(ownerKey, { mint: mintKey });
  const minted = byMint.value.reduce((sum, account) => sum + (parsedAmount(account) ?? 0), 0);
  if (minted > 0) return minted;

  const token2022 = await connection.getParsedTokenAccountsByOwner(ownerKey, {
    programId: TOKEN_2022_PROGRAM_ID,
  });
  return token2022.value.reduce((sum, account) => {
    const data = account.account.data as { parsed?: { info?: { mint?: string } } };
    if (data.parsed?.info?.mint !== mint) return sum;
    return sum + (parsedAmount(account) ?? 0);
  }, 0);
}
