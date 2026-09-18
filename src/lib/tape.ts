import { hasMint, project } from "./config";
import { bitcoinUsd, solanaTokenUsd } from "./coingecko";
import { getMarketSnapshot, type MarketSnapshot } from "./market";

export type TapeQuote = {
  symbol: string;
  label: string;
  priceUsd: number | null;
  change24hPct: number | null;
  status: "live" | "awaiting_launch" | "unavailable";
};

export type PriceTapeSnapshot = {
  btc: TapeQuote;
  jrock: TapeQuote;
  updatedAt: string;
};

const FETCH_MS = 8_000;

function num(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

async function dexScreenerUsd(mint: string) {
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(mint)}`,
      {
        headers: { accept: "application/json" },
        next: { revalidate: 30 },
        signal: AbortSignal.timeout(FETCH_MS),
      },
    );
    if (!response.ok) return null;
    const body = (await response.json()) as {
      pairs?: { priceUsd?: unknown; priceChange?: { h24?: unknown } }[];
    };
    const pair = body.pairs?.[0];
    const priceUsd = num(pair?.priceUsd);
    if (priceUsd == null || priceUsd <= 0) return null;
    return { priceUsd, change24hPct: num(pair?.priceChange?.h24) };
  } catch {
    return null;
  }
}

function emptyJrock(status: TapeQuote["status"]): TapeQuote {
  return {
    symbol: project.ticker,
    label: project.name,
    priceUsd: null,
    change24hPct: null,
    status,
  };
}

export async function getPriceTape(market?: MarketSnapshot): Promise<PriceTapeSnapshot> {
  const snap = market ?? (await getMarketSnapshot());
  const minted = hasMint();

  const [btc, geckoJrock] = await Promise.all([
    bitcoinUsd(),
    minted && snap.priceUsd == null ? solanaTokenUsd(project.mint) : Promise.resolve(null),
  ]);

  let priceUsd = snap.priceUsd;
  let change24hPct = snap.priceChange24hPct;

  if (priceUsd == null && geckoJrock) {
    priceUsd = geckoJrock.priceUsd;
    change24hPct = geckoJrock.change24hPct;
  }

  if (minted && (priceUsd == null || change24hPct == null)) {
    const dex = await dexScreenerUsd(project.mint);
    if (dex) {
      priceUsd = priceUsd ?? dex.priceUsd;
      change24hPct = change24hPct ?? dex.change24hPct;
    }
  }

  const jrock: TapeQuote =
    priceUsd != null && priceUsd > 0
      ? {
          symbol: project.ticker,
          label: project.name,
          priceUsd,
          change24hPct,
          status: "live",
        }
      : emptyJrock("awaiting_launch");

  return {
    btc: btc
      ? {
          symbol: "BTC",
          label: "Bitcoin",
          priceUsd: btc.priceUsd,
          change24hPct: btc.change24hPct,
          status: "live",
        }
      : {
          symbol: "BTC",
          label: "Bitcoin",
          priceUsd: null,
          change24hPct: null,
          status: "unavailable",
        },
    jrock,
    updatedAt: new Date().toISOString(),
  };
}
