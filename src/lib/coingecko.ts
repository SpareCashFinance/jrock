import "server-only";

const FETCH_MS = 8_000;

function geckoBase() {
  return process.env.COINGECKO_API_KEY?.trim()
    ? "https://pro-api.coingecko.com/api/v3"
    : "https://api.coingecko.com/api/v3";
}

function geckoHeaders() {
  const key = process.env.COINGECKO_API_KEY?.trim();
  return key ? { "x-cg-pro-api-key": key } : undefined;
}

function num(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

async function readJson(url: string) {
  const response = await fetch(url, {
    headers: { accept: "application/json", ...geckoHeaders() },
    next: { revalidate: 30 },
    signal: AbortSignal.timeout(FETCH_MS),
  });
  const body = await response.json().catch(() => null);
  return { ok: response.ok, body };
}

export type SpotQuote = {
  priceUsd: number;
  change24hPct: number | null;
};

export async function bitcoinUsd(): Promise<SpotQuote | null> {
  try {
    const { ok, body } = await readJson(
      `${geckoBase()}/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true`,
    );
    if (!ok || !body || typeof body !== "object") return null;
    const row = (body as { bitcoin?: { usd?: unknown; usd_24h_change?: unknown } }).bitcoin;
    const priceUsd = num(row?.usd);
    if (priceUsd == null || priceUsd <= 0) return null;
    return { priceUsd, change24hPct: num(row?.usd_24h_change) };
  } catch {
    return null;
  }
}

export async function solanaTokenUsd(mint: string): Promise<SpotQuote | null> {
  const address = mint.trim();
  if (!address) return null;
  try {
    const { ok, body } = await readJson(
      `${geckoBase()}/onchain/networks/solana/tokens/${encodeURIComponent(address)}`,
    );
    if (!ok || !body || typeof body !== "object") return null;
    const data = (body as { data?: { attributes?: Record<string, unknown> } }).data;
    const attrs = data?.attributes;
    const priceUsd = num(attrs?.price_usd);
    if (priceUsd == null || priceUsd <= 0) return null;
    const change =
      attrs?.price_change_percentage && typeof attrs.price_change_percentage === "object"
        ? num((attrs.price_change_percentage as { h24?: unknown }).h24)
        : null;
    return { priceUsd, change24hPct: change };
  } catch {
    return null;
  }
}
