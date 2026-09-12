export const WSOL_MINT = "So11111111111111111111111111111111111111112";
export const JUPITER_REFERRAL_ACCOUNT = "BnyrJ2GRVo3JrnUwvFsDjUVKtBY9Qo3JZ32ayLLu2yS3";
export const HOUSE_SWAP_FEE_BPS = 50;

export function publicSolanaRpcUrl() {
  return process.env.NEXT_PUBLIC_SOLANA_RPC_URL?.trim() || "https://api.mainnet-beta.solana.com";
}

/** Paid RPC only. Keyed URLs stay on the server behind /api/solana/rpc. */
export function serverSolanaRpcUrl() {
  return process.env.SOLANA_RPC_URL?.trim() || publicSolanaRpcUrl();
}
