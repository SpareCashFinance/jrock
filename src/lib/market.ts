import { hasMint, holderFeePercent, project } from "./config";
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
  quoteOnlyFees: boolean;
  flywheelActive: boolean;
  launchpad: string;
  launchStatus: string;
  priceUsd: number | null;
  priceChange24hPct: number | null;
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
const WBTC_MINT = "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh";

function emptySnapshot(status: MarketStatus, message: string): MarketSnapshot {
  return {
    status,
    message,
    mint: project.mint,
    rewardMint: project.rewardMint,
    rewardSymbol: project.rewardAsset,
    mode: "",
    transferFeeBps: null,
    quoteOnlyFees: true,
    flywheelActive: false,
    launchpad: "",
    launchStatus: "",
    priceUsd: null,
    priceChange24hPct: null,
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

function expectedRewardMint() {
  return project.rewardMint.trim() || WBTC_MINT;
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
    .sort((a, b) => {
      const aTime = a.at ? Date.parse(a.at) : 0;
      const bTime = b.at ? Date.parse(b.at) : 0;
      return bTime - aTime;
    })
    .slice(0, 24);
}

export async function getMarketSnapshot(): Promise<MarketSnapshot> {
  if (!hasMint() || !looksLikeMint(project.mint)) {
    return emptySnapshot(
      "awaiting_launch",
      "Awaiting launch. Live market and WBTC reward figures will appear after the official $JROCK mint is published on StonkFun.",
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
        "Mint is set. Waiting for StonkFun to adopt the $JROCK LaunchLab pool and start the WBTC reward cycle.",
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
        "Mint is set. StonkFun has not returned a token record yet.",
      );
    }

    const market = asRecord(token.market);
    const tokenQuote = asRecord(token.quote);
    const transferFee = asRecord(token.transferFee);
    const flywheel = asRecord(token.flywheel);
    const mode = text(token.mode) === "standard" ? "standard" : text(token.mode) === "reward" ? "reward" : "";
    const quoteOnlyFees = token.quoteOnlyFees !== false;
    const flywheelActive = flywheel?.active === true;
    const launchpad = text(token.launchpad);
    const launchStatus = text(token.status);

    const rewardBody = rewardHit.ok ? asRecord(rewardHit.body) : null;
    const rewardData = asRecord(rewardBody?.data) ?? rewardBody;
    const rewardQuote = asRecord(rewardData?.quote) ?? tokenQuote;
    const rewards = asRecord(rewardData?.rewards);
    const rewardMode = text(rewardData?.mode) || mode;

    const liveQuoteMint = text(rewardQuote?.mint) || text(tokenQuote?.mint);
    const symbol =
      text(rewardQuote?.symbol) ||
      text(tokenQuote?.symbol) ||
      project.rewardAsset;
    const rewardMint = liveQuoteMint || expectedRewardMint();
    const quoteMismatch =
      Boolean(liveQuoteMint) &&
      liveQuoteMint.toLowerCase() !== expectedRewardMint().toLowerCase();

    if (rewardMode === "standard" || (rewardHit.ok && rewardData && rewards == null)) {
      return {
        ...emptySnapshot(
          "standard_mode",
          "This mint is live as a standard StonkFun launch. WBTC holder rewards only run on a reward-mode Token-2022 tax.",
        ),
        mode: "standard",
        transferFeeBps: num(transferFee?.bps),
        quoteOnlyFees,
        flywheelActive,
        launchpad,
        launchStatus,
        rewardMint,
        rewardSymbol: symbol,
        totalDistributedSymbol: symbol,
        priceUsd: num(market?.priceUsd),
        priceChange24hPct: num(market?.priceChange24h),
        marketCapUsd: num(market?.marketCapUsd) ?? num(market?.fdvUsd),
        volume24hUsd: num(market?.volume24hUsd),
        liquidityUsd: num(market?.liquidityUsd),
        updatedAt: new Date().toISOString(),
      };
    }

    const totalDistributed =
      num(rewards?.distributedTokens) ??
      num(rewards?.totalDistributed) ??
      num(rewards?.distributed);
    const pendingDistributed = num(rewards?.undistributedTokens);
    const holders = num(rewards?.holderCount) ?? num(token.holders);
    const payoutCount = num(rewards?.payoutCount);
    const lastPayoutAt = text(rewards?.lastPayoutAt) || null;

    const history = mapHistory(
      rewards?.history ??
        rewards?.distributions ??
        rewards?.recentDistributions ??
        rewards?.payouts,
      symbol,
      mint,
    );

    const lastDistribution =
      history[0] ??
      (lastPayoutAt
        ? {
            at: lastPayoutAt,
            amount: null,
            symbol,
            signature: null,
            explorerUrl: null,
            holdersPaid: holders,
          }
        : null);

    const taxPct =
      num(transferFee?.bps) != null
        ? `${((num(transferFee?.bps) as number) / 100).toFixed(0)}%`
        : `${holderFeePercent}%`;
    const noPayouts = !payoutCount && !(totalDistributed && totalDistributed > 0) && !lastPayoutAt;

    const mismatchNote = quoteMismatch
      ? ` This pool is paying ${symbol}, not WBTC. JROCK should launch against Wrapped BTC (Wormhole).`
      : "";
    const taxNote = quoteOnlyFees
      ? ` ${taxPct} Token-2022 tax is collected in ${symbol}.`
      : ` ${taxPct} Token-2022 tax is collected in $JROCK.`;

    return {
      status: noPayouts ? "no_distribution" : "live",
      message: noPayouts
        ? `Pool is live on StonkFun. No verified distribution yet — the terminal lights up when the first on-chain ${symbol} payout is confirmed.${taxNote}${mismatchNote}`
        : `Verified StonkFun figures. Amounts can change and are not a promise of future rewards.${taxNote}${mismatchNote}`,
      mint,
      rewardMint,
      rewardSymbol: symbol,
      mode: "reward",
      transferFeeBps: num(transferFee?.bps),
      quoteOnlyFees,
      flywheelActive,
      launchpad,
      launchStatus,
      priceUsd: num(market?.priceUsd),
      priceChange24hPct: num(market?.priceChange24h),
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
