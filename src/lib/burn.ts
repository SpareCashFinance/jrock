import { hasBurnTx, hasMint, initialSupply, plannedLaunchBurn, project } from "./config";
import { explorerTxUrl } from "./links";
import { serverSolanaRpcUrl } from "./solana";

export type BurnStatus = "awaiting_launch" | "armed" | "live" | "unavailable";

export type BurnEvent = {
  at: string | null;
  amount: number | null;
  source: string;
  signature: string | null;
  explorerUrl: string | null;
};

export type BurnSnapshot = {
  status: BurnStatus;
  message: string;
  mint: string;
  symbol: string;
  initialSupply: number;
  circulatingSupply: number | null;
  plannedLaunchPct: number;
  plannedLaunchAmount: number;
  launchBurned: number;
  launchFiled: boolean;
  platformBurned: number;
  platformUsd: number | null;
  platformCount: number;
  otherBurned: number;
  totalBurned: number;
  burnedPct: number;
  lastBurnAt: string | null;
  recent: BurnEvent[];
  updatedAt: string;
};

const STONKFUN = "https://www.stonkfun.xyz/api/public/v1";
const FETCH_MS = 8_000;
const LAUNCH_DETECT_RATIO = 0.85;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function num(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function looksLikeMint(value: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value.trim());
}

function snapshot(partial: Partial<BurnSnapshot> & Pick<BurnSnapshot, "status" | "message">): BurnSnapshot {
  const supply = initialSupply();
  const planned = plannedLaunchBurn();
  const launchBurned = partial.launchBurned ?? 0;
  const platformBurned = partial.platformBurned ?? 0;
  const otherBurned = partial.otherBurned ?? 0;
  const totalBurned = partial.totalBurned ?? launchBurned + platformBurned + otherBurned;
  const burnedPct = partial.burnedPct ?? (supply > 0 ? (totalBurned / supply) * 100 : 0);

  return {
    mint: project.mint,
    symbol: project.ticker,
    initialSupply: supply,
    circulatingSupply: null,
    plannedLaunchPct: project.burnPercent,
    plannedLaunchAmount: planned,
    launchFiled: hasBurnTx(),
    platformUsd: null,
    platformCount: 0,
    lastBurnAt: null,
    recent: [],
    updatedAt: new Date().toISOString(),
    ...partial,
    launchBurned,
    platformBurned,
    otherBurned,
    totalBurned,
    burnedPct,
  };
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

async function onChainSupply(mint: string): Promise<number | null> {
  try {
    const response = await fetch(serverSolanaRpcUrl(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenSupply",
        params: [mint],
      }),
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(FETCH_MS),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      result?: { value?: { uiAmount?: unknown } };
    };
    return num(body.result?.value?.uiAmount);
  } catch {
    return null;
  }
}

function mapBurns(raw: unknown): BurnEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      const item = asRecord(row);
      if (!item) return null;
      const signature = text(item.signature) || null;
      const amount = num(item.amountTokens);
      const at = text(item.burnedAt) || text(item.at) || null;
      if (amount == null && !at && !signature) return null;
      return {
        at,
        amount,
        source: text(item.source) || "flywheel",
        signature,
        explorerUrl: signature ? explorerTxUrl(signature) : null,
      } satisfies BurnEvent;
    })
    .filter((row): row is BurnEvent => Boolean(row))
    .slice(0, 8);
}

export async function getBurnSnapshot(): Promise<BurnSnapshot> {
  const supply = initialSupply();
  const planned = plannedLaunchBurn();

  if (!hasMint() || !looksLikeMint(project.mint)) {
    return snapshot({
      status: "awaiting_launch",
      message: `Launch burn is armed at ${project.burnPercent}%. stonk.fun’s fee sweep starts after the mint is live.`,
    });
  }

  const mint = project.mint.trim();

  try {
    const [burnHit, circulating] = await Promise.all([
      readJson(`${STONKFUN}/tokens/${encodeURIComponent(mint)}/burns?limit=8`),
      onChainSupply(mint),
    ]);

    if (burnHit.status === 429) {
      return snapshot({
        status: "unavailable",
        message: "stonk.fun is rate-limiting burn reads. The fire retries on the next refresh.",
        circulatingSupply: circulating,
      });
    }

    const burnBody = burnHit.ok ? asRecord(burnHit.body) : null;
    const burnData = asRecord(burnBody?.data) ?? burnBody;
    const totals = asRecord(burnData?.totals);
    const platformBurned = num(totals?.amountTokens) ?? 0;
    const platformUsd = num(totals?.valueUsdAtBurn);
    const platformCount = Math.max(0, Math.round(num(totals?.burnCount) ?? 0));
    const lastPlatformAt = text(totals?.lastBurnAt) || null;
    const recent = mapBurns(burnData?.burns);
    const indexed = burnHit.status !== 404 && Boolean(totals || recent.length);

    const onChainBurned =
      circulating != null && circulating >= 0 ? Math.max(0, supply - circulating) : null;

    let launchBurned = 0;
    if (hasBurnTx()) {
      launchBurned = planned;
    } else if (onChainBurned != null && onChainBurned - platformBurned >= planned * LAUNCH_DETECT_RATIO) {
      launchBurned = Math.min(planned, Math.max(0, onChainBurned - platformBurned));
    }

    const accounted = launchBurned + platformBurned;
    const totalBurned = onChainBurned != null ? Math.max(onChainBurned, accounted) : accounted;
    const otherBurned = Math.max(0, totalBurned - accounted);
    const burnedPct = supply > 0 ? (totalBurned / supply) * 100 : 0;
    const live = totalBurned > 0 || platformCount > 0;
    const lastBurnAt = lastPlatformAt || recent[0]?.at || null;

    return snapshot({
      status: live ? "live" : "armed",
      message: live
        ? "Live incinerator. Launch buyback plus stonk.fun’s fee-sweep burns. Amounts can move."
        : `Mint is set. ${project.burnPercent}% launch burn is armed. The flywheel lights once stonk.fun starts sweeping fees.`,
      circulatingSupply: circulating,
      launchBurned,
      platformBurned: indexed ? platformBurned : 0,
      platformUsd: indexed ? platformUsd : null,
      platformCount: indexed ? platformCount : 0,
      otherBurned,
      totalBurned,
      burnedPct,
      lastBurnAt,
      recent,
    });
  } catch {
    return snapshot({
      status: "unavailable",
      message: "Burn tape is offline. Refresh later or verify supply on Solana Explorer.",
    });
  }
}
