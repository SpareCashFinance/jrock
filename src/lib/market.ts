import { hasMint, project } from "./config";
import { explorerTxUrl } from "./links";

export type MarketStatus =
  | "awaiting_launch"
  | "no_distribution"
  | "unavailable"
  | "live";

export type RewardEvent = {
  at: string | null;
  amount: number | null;
  symbol: string;
  signature: string | null;
  explorerUrl: string | null;
};

export type MarketSnapshot = {
  status: MarketStatus;
  message: string;
  mint: string;
  rewardMint: string;
  priceUsd: number | null;
  marketCapUsd: number | null;
  volume24hUsd: number | null;
  liquidityUsd: number | null;
  holders: number | null;
  totalDistributed: number | null;
  totalDistributedSymbol: string;
  payoutCount: number | null;
  lastDistribution: RewardEvent | null;
  nextRewardStatus: string;
  history: RewardEvent[];
  updatedAt: string | null;
};

const STONKFUN = "https://www.stonkfun.xyz/api/public/v1";

function emptySnapshot(status: MarketStatus, message: string): MarketSnapshot {
  return {
    status,
    message,
    mint: project.mint,
    rewardMint: project.rewardMint,
    priceUsd: null,
    marketCapUsd: null,
    volume24hUsd: null,
    liquidityUsd: null,
    holders: null,
    totalDistributed: null,
    totalDistributedSymbol: project.rewardAsset,
    payoutCount: null,
    lastDistribution: null,
    nextRewardStatus: status === "awaiting_launch" ? "Awaiting launch" : "Unknown",
    history: [],
    updatedAt: null,
  };
}

function num(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

async function readJson(url: string) {
  const response = await fetch(url, {
    next: { revalidate: 30 },
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Request failed ${response.status}`);
  }
  return response.json();
}

function mapHistory(raw: unknown, symbol: string): RewardEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const item = asRecord(row);
      if (!item) return null;
      const signature =
        (typeof item.signature === "string" && item.signature) ||
        (typeof item.tx === "string" && item.tx) ||
        (typeof item.txid === "string" && item.txid) ||
        null;
      const amount =
        num(item.amountTokens) ??
        num(item.amount) ??
        num(item.distributedTokens) ??
        null;
      const at =
        (typeof item.at === "string" && item.at) ||
        (typeof item.createdAt === "string" && item.createdAt) ||
        (typeof item.lastPayoutAt === "string" && item.lastPayoutAt) ||
        null;
      return {
        at,
        amount,
        symbol,
        signature,
        explorerUrl: signature ? explorerTxUrl(signature) : null,
      } satisfies RewardEvent;
    })
    .filter((row): row is RewardEvent => Boolean(row))
    .slice(0, 8);
}

export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  if (!hasMint()) {
    return emptySnapshot(
      "awaiting_launch",
      "Awaiting launch. Live market and reward figures will appear after the official $JROCK mint is published.",
    );
  }

  try {
    const [tokenRes, rewardRes] = await Promise.allSettled([
      readJson(`${STONKFUN}/tokens/${project.mint}`),
      readJson(`${STONKFUN}/tokens/${project.mint}/rewards`),
    ]);

    const tokenBody =
      tokenRes.status === "fulfilled" ? asRecord(tokenRes.value) : null;
    const rewardBody =
      rewardRes.status === "fulfilled" ? asRecord(rewardRes.value) : null;

    const tokenData = asRecord(tokenBody?.data) ?? tokenBody;
    const token = asRecord(tokenData?.token) ?? tokenData;
    const market = asRecord(token?.market);
    const rewardData = asRecord(rewardBody?.data) ?? rewardBody;
    const rewards = asRecord(rewardData?.rewards) ?? rewardData;

    const quote = asRecord(rewards?.quote) ?? asRecord(token?.quote);
    const symbol =
      (typeof quote?.symbol === "string" && quote.symbol) ||
      project.rewardAsset;

    const totalDistributed =
      num(rewards?.distributedTokens) ??
      num(rewards?.totalDistributed) ??
      num(rewards?.distributed);
    const holders = num(rewards?.holderCount) ?? num(token?.holders);
    const payoutCount = num(rewards?.payoutCount);
    const lastPayoutAt =
      (typeof rewards?.lastPayoutAt === "string" && rewards.lastPayoutAt) ||
      null;

    const history = mapHistory(
      rewards?.history ?? rewards?.distributions ?? rewards?.payouts,
      symbol,
    );

    const lastDistribution =
      history[0] ??
      (lastPayoutAt || totalDistributed != null
        ? {
            at: lastPayoutAt,
            amount: totalDistributed,
            symbol,
            signature: null,
            explorerUrl: null,
          }
        : null);

    const hasMarket =
      Boolean(market) ||
      totalDistributed != null ||
      holders != null ||
      payoutCount != null;

    if (!hasMarket) {
      return emptySnapshot(
        "unavailable",
        "Live data unavailable. The mint is set, but stonk.fun has not returned a verified market record yet.",
      );
    }

    const noPayouts = !totalDistributed && !payoutCount && !lastPayoutAt;

    return {
      status: noPayouts ? "no_distribution" : "live",
      message: noPayouts
        ? "No verified distribution yet. The terminal will light up when the first on-chain WBTC payout is confirmed."
        : "Verified figures from stonk.fun. Amounts can change and are not a promise of future rewards.",
      mint: project.mint,
      rewardMint:
        project.rewardMint ||
        (typeof quote?.mint === "string" ? quote.mint : ""),
      priceUsd: num(market?.priceUsd),
      marketCapUsd: num(market?.marketCapUsd) ?? num(market?.fdvUsd),
      volume24hUsd: num(market?.volume24hUsd),
      liquidityUsd: num(market?.liquidityUsd),
      holders,
      totalDistributed,
      totalDistributedSymbol: symbol,
      payoutCount,
      lastDistribution,
      nextRewardStatus: noPayouts
        ? "Waiting on trading activity"
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
