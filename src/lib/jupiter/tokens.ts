import "server-only";

import {
  SOL_TOKEN,
  USDC_TOKEN,
  USDT_TOKEN,
  normalizeTokenIcon,
  type SwapToken,
} from "@/lib/swap-tokens";

const PAID = "https://api.jup.ag/tokens/v2";
const LITE = "https://lite-api.jup.ag/tokens/v2";
const FETCH_MS = 8_000;

type JupiterMint = {
  id?: string;
  name?: string;
  symbol?: string;
  icon?: string | null;
  decimals?: number;
  isVerified?: boolean | null;
  audit?: { isSus?: boolean | null } | null;
};

function jupiterKey() {
  return process.env.JUPITER_API_KEY?.trim() || "";
}

function headers(): Record<string, string> {
  const key = jupiterKey();
  return key ? { "x-api-key": key, accept: "application/json" } : { accept: "application/json" };
}

async function jupGet(path: string): Promise<JupiterMint[]> {
  const signal = AbortSignal.timeout(FETCH_MS);
  const opts = { headers: headers(), cache: "no-store" as const, signal };
  let res = await fetch(`${PAID}${path}`, opts).catch(() => null);
  if (!res?.ok) {
    res = await fetch(`${LITE}${path}`, opts).catch(() => null);
  }
  if (!res?.ok) return [];
  const body = (await res.json().catch(() => null)) as JupiterMint[] | { error?: string } | null;
  return Array.isArray(body) ? body : [];
}

export function toSwapToken(row: JupiterMint): SwapToken | null {
  if (!row.id || !row.symbol || typeof row.decimals !== "number") return null;
  if (row.audit && "isSus" in row.audit) return null;
  return {
    mint: row.id,
    symbol: row.symbol,
    name: row.name || row.symbol,
    decimals: row.decimals,
    icon: normalizeTokenIcon(row.icon),
    verified: Boolean(row.isVerified),
  };
}

function dedupe(tokens: SwapToken[]) {
  const map = new Map<string, SwapToken>();
  for (const token of tokens) {
    const prev = map.get(token.mint);
    if (!prev) {
      map.set(token.mint, token);
      continue;
    }
    map.set(token.mint, {
      ...prev,
      ...token,
      icon: token.icon || prev.icon,
      verified: Boolean(prev.verified || token.verified),
    });
  }
  return [...map.values()];
}

/** Tokens API v2 mint lookup — comma-separated ids, max 100. This is the enrich path. */
async function enrichJupiterTokens(tokens: SwapToken[]) {
  if (!tokens.length) return tokens;
  const mints = [...new Set(tokens.map((token) => token.mint))].slice(0, 100);
  const rows = await jupGet(`/search?query=${encodeURIComponent(mints.join(","))}`);
  const byMint = new Map(
    rows
      .map(toSwapToken)
      .filter((row): row is SwapToken => Boolean(row))
      .map((row) => [row.mint, row] as const),
  );
  return tokens.map((token) => {
    const enriched = byMint.get(token.mint);
    if (!enriched) return token;
    return {
      ...token,
      ...enriched,
      icon: enriched.icon || token.icon,
      verified: Boolean(token.verified || enriched.verified),
    };
  });
}

const STRICT_TICKERS = new Set(["usdc", "usdt", "sol", "btc", "wbtc", "eth", "jup"]);

function rankToken(token: SwapToken, query: string) {
  const q = query.toLowerCase();
  const exact = token.symbol.toLowerCase() === q ? 2 : 0;
  const verified = token.verified ? 1 : 0;
  return exact + verified;
}

export async function searchJupiterTokens(query: string) {
  const q = query.trim();
  if (!q) return discoverJupiterTokens();
  const rows = await jupGet(`/search?query=${encodeURIComponent(q)}`);
  let tokens = dedupe(rows.map(toSwapToken).filter((row): row is SwapToken => Boolean(row)));
  if (STRICT_TICKERS.has(q.toLowerCase())) {
    const verified = tokens.filter((token) => token.verified);
    if (verified.length) tokens = verified;
  }
  return enrichJupiterTokens(tokens.sort((a, b) => rankToken(b, q) - rankToken(a, q)));
}

export async function discoverJupiterTokens() {
  const known = `${SOL_TOKEN.mint},${USDC_TOKEN.mint},${USDT_TOKEN.mint}`;
  const [pinned, trending] = await Promise.all([
    jupGet(`/search?query=${encodeURIComponent(known)}`),
    jupGet("/toporganicscore/24h?limit=24"),
  ]);
  const fromJupiter = [...pinned, ...trending]
    .map(toSwapToken)
    .filter((row): row is SwapToken => Boolean(row));
  return enrichJupiterTokens(dedupe([SOL_TOKEN, USDC_TOKEN, USDT_TOKEN, ...fromJupiter]));
}
