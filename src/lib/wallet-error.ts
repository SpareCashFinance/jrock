export function isWalletCancel(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /reject|denied|cancelled|canceled|user reject|approval.*denied/i.test(message);
}

export function walletActionMessage(error: unknown, fallback = "The rock refused.") {
  if (isWalletCancel(error)) return "You cancelled. Nothing was sent.";
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/blockhash|block height|expired/i.test(message)) {
    return "Solana dropped that blockhash. Try once more.";
  }
  if (/insufficient|no record of a prior credit|0x1\b/i.test(message)) {
    return "Not enough SOL in the wallet for this slip plus fees.";
  }
  if (
    /invalid instruction|InstructionFallbackNotFound|FallbackNotFound|simulation failed|custom program error/i.test(
      message,
    )
  ) {
    if (/48|clock|round_secs|set_round/i.test(fallback)) return fallback;
    return "Solana rejected that transaction before it was sent. Nothing landed on chain.";
  }
  if (/WalletSendTransactionError|WalletSign/i.test(message) && message.length > 140) {
    return fallback;
  }
  return message.trim() || fallback;
}
