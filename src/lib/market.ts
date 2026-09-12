import { hasMint, project } from "./config";
import { explorerTxUrl } from "./links";

export type MarketStatus =
  | "awaiting_launch"
  | "awaiting_index"
  | "standard_mode"
  | "no_distribution"
  | "unavailable"
  | "live";

export type RewardEvent = {
  at: string | null;
  amount: number | null;
  symbol: string;
  signature: string | null;
  explorerUrl: string | null;
  holdersPaid: number | null;
};

export type MarketSnapshot = {
  status: MarketStatus;
  message: string;
  mint: string;
  rewardMint: string;
  rewardSymbol: string;
  mode: "reward" | "standard" | "";
  transferFeeBps: number | null;
  priceUsd: number | null;
  marketCapUsd: number | null;
  volume24hUsd: number | null;
  liquidityUsd: number | null;
  holders: number | null;
  totalDistributed: number | null;
  pendingDistributed: number | null;
  totalDistributedSymbol: string;
  payoutCount: number | null;
  lastDistribution: RewardEvent | null;
  nextRewardStatus: string;
  history: RewardEvent[];
  updatedAt: string | null;
};

const STONKFUN = "https://www.stonkfun.xyz/api/public/v1";
const FETCH_MS = 8_000;

function emptySnapshot(status: MarketStatus, message: string): MarketSnapshot {
  return {
    status,
    message,
    mint: project.mint,
    rewardMint: project.rewardMint,
    rewardSymbol: project.rewardAsset,
    mode: "",
    transferFeeBps: null,
    priceUsd: null,
    marketCapUsd: null,
    volume24hUsd: null,
    liquidityUsd: null,
    holders: null,
    totalDistributed: null,
    pendingDistributed: null,
    totalDistributedSymbol: project.rewardAsset,
    payoutCount: null,
    lastDistribution: null,
    nextRewardStatus:
      status === "awaiting_launch" || status === "awaiting_index"
        ? "Awaiting launch"
        : "Unknown",
    history: [],
    updatedAt: null,
  };
}

function num(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function looksLikeMint(value: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value.trim());
}

async function readJson(url: string) {
  const response = await fetch(url, {
    next: { revalidate: 30 },
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(FETCH_MS),
  });
  const body = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, body };
}

function mapHistory(raw: unknown, symbol: string, mint: string): RewardEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const item = asRecord(row);
      if (!item) return null;
      const rowMint = text(item.mint);
      if (rowMint && mint && rowMint !== mint) return null;
      const signature = text(item.signature) || text(item.tx) || text(item.txid) || null;
      const amount =
        num(item.amountTokens) ??
        num(item.amount) ??
        num(item.distributedTokens) ??
        null;
      const at =
        text(item.distributedAt) ||
        text(item.lastPayoutAt) ||
        text(item.at) ||
        text(item.createdAt) ||
        null;
      if (amount == null && !at && !signature) return null;
      return {
        at,
        amount,
        symbol,
        signature,
        explorerUrl: signature ? explorerTxUrl(signature) : null,
        holdersPaid: num(item.holderCount),
      } satisfies RewardEvent;
    })
    .filter((row): row is RewardEvent => Boolean(row))
    .slice(0, 12);
}

export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  if (!hasMint() || !looksLikeMint(project.mint)) {
    return emptySnapshot(
      "awaiting_launch",
      "Awaiting launch. Live market and reward figures will appear after the official $JROCK mint is published.",
    );
  }

  try {
    const mint = project.mint.trim();
    const [tokenHit, rewardHit] = await Promise.all([
      readJson(`${STONKFUN}/tokens/${encodeURIComponent(mint)}`),
      readJson(`${STONKFUN}/tokens/${encodeURIComponent(mint)}/rewards`),
    ]);

    if (tokenHit.status === 429 || rewardHit.status === 429) {
      return emptySnapshot(
        "unavailable",
        "Market data is rate-limiting reads. The terminal will retry on the next refresh.",
      );
    }

    if (tokenHit.status === 404) {
      return emptySnapshot(
        "awaiting_index",
        "Mint is set. Waiting for pump.fun Holder Rewards to index $JROCK.",
      );
    }

    if (!tokenHit.ok) {
      return emptySnapshot(
        "unavailable",
        "Live data unavailable. Refresh later or verify the mint on Solana Explorer.",
      );
    }

    const tokenBody = asRecord(tokenHit.body);
    const tokenData = asRecord(tokenBody?.data) ?? tokenBody;
    const token = asRecord(tokenData?.token) ?? tokenData;
    if (!token) {
      return emptySnapshot(
        "awaiting_index",
        "Mint is set. The official market has not returned a token record yet.",
      );
    }

    const market = asRecord(token.market);
    const tokenQuote = asRecord(token.quote);
    const transferFee = asRecord(token.transferFee);
    const mode = text(token.mode) === "standard" ? "standard" : text(token.mode) === "reward" ? "reward" : "";

    const rewardBody = rewardHit.ok ? asRecord(rewardHit.body) : null;
    const rewardData = asRecord(rewardBody?.data) ?? rewardBody;
    const rewardQuote = asRecord(rewardData?.quote) ?? tokenQuote;
    const rewards = asRecord(rewardData?.rewards);
    const rewardMode = text(rewardData?.mode) || mode;

    if (rewardMode === "standard" || (rewardHit.ok && rewardData && rewards == null)) {
      return {
        ...emptySnapshot(
          "standard_mode",
          "This mint is live without Holder Rewards. WBTC distributions will not appear unless the coin launched in Holder Rewards mode.",
        ),
        mode: "standard",
        priceUsd: num(market?.priceUsd),
        marketCapUsd: num(market?.marketCapUsd) ?? num(market?.fdvUsd),
        volume24hUsd: num(market?.volume24hUsd),
        liquidityUsd: num(market?.liquidityUsd),
        updatedAt: new Date().toISOString(),
      };
    }

    const symbol =
      text(rewardQuote?.symbol) ||
      text(tokenQuote?.symbol) ||
      project.rewardAsset;
    const rewardMint =
      project.rewardMint ||
      text(rewardQuote?.mint) ||
      text(tokenQuote?.mint);

    const totalDistributed =
      num(rewards?.distributedTokens) ??
      num(rewards?.totalDistributed) ??
      num(rewards?.distributed);
    const pendingDistributed = num(rewards?.undistributedTokens);
    const holders = num(rewards?.holderCount) ?? num(token.holders);
    const payoutCount = num(rewards?.payoutCount);
    const lastPayoutAt = text(rewards?.lastPayoutAt) || null;

    const history = mapHistory(
      rewards?.history ?? rewards?.distributions ?? rewards?.recentDistributions ?? rewards?.payouts,
      symbol,
      mint,
    );

    const lastDistribution =
      history[0] ??
      (lastPayoutAt || (totalDistributed != null && totalDistributed > 0)
        ? {
            at: lastPayoutAt,
            amount: totalDistributed,
            symbol,
            signature: null,
            explorerUrl: null,
            holdersPaid: holders,
          }
        : null);

    const noPayouts = !payoutCount && !(totalDistributed && totalDistributed > 0) && !lastPayoutAt;

    return {
      status: noPayouts ? "no_distribution" : "live",
      message: noPayouts
        ? "Pool is live. No verified distribution yet — the terminal lights up when the first on-chain payout is confirmed."
        : "Verified on-chain figures. Amounts can change and are not a promise of future rewards.",
      mint,
      rewardMint,
      rewardSymbol: symbol,
      mode: "reward",
      transferFeeBps: num(transferFee?.bps),
      priceUsd: num(market?.priceUsd),
      marketCapUsd: num(market?.marketCapUsd) ?? num(market?.fdvUsd),
      volume24hUsd: num(market?.volume24hUsd),
      liquidityUsd: num(market?.liquidityUsd),
      holders,
      totalDistributed,
      pendingDistributed,
      totalDistributedSymbol: symbol,
      payoutCount,
      lastDistribution,
      nextRewardStatus: noPayouts
        ? pendingDistributed && pendingDistributed > 0
          ? "Pot filling — waiting on the next payout"
          : "Waiting on trading activity"
        : "Variable — depends on live volume",
      history,
      updatedAt: new Date().toISOString(),
    };
  } catch {
    return emptySnapshot(
      "unavailable",
      "Live data unavailable. Refresh later or verify the mint on Solana Explorer.",
    );
  }
}
