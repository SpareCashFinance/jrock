export type ConfirmedValue = {
  value: string;
  confirmed: boolean;
};

export const project = {
  name: "Jamie's Pet Rock",
  ticker: "$JROCK",
  tickerBare: "JROCK",
  coreLine: "The pet rock that pays in Bitcoin.",
  quote:
    "They said Bitcoin does nothing. We taught the rock to stack WBTC.",
  network: "Solana",
  launchpad: "stonk.fun",
  launchpadName: "StonkFun",
  rewardAsset: "WBTC",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://petrock.fun",
  mint: process.env.NEXT_PUBLIC_JROCK_MINT ?? "",
  rewardMint:
    process.env.NEXT_PUBLIC_WBTC_MINT?.trim() ||
    "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh",
  totalSupply: process.env.NEXT_PUBLIC_TOTAL_SUPPLY ?? "",
  burnPercent: Number(process.env.NEXT_PUBLIC_BURN_PERCENT || 70.05) || 70.05,
  burnTx: (process.env.NEXT_PUBLIC_BURN_TX ?? "").trim(),
  transferFee: process.env.NEXT_PUBLIC_TRANSFER_FEE ?? "",
  eligibility: process.env.NEXT_PUBLIC_ELIGIBILITY ?? "",
  liquidityStatus: process.env.NEXT_PUBLIC_LIQUIDITY_STATUS ?? "",
  authorityStatus: process.env.NEXT_PUBLIC_AUTHORITY_STATUS ?? "",
  shareText: "Jamie said Bitcoin was a pet rock. Mine pays me in WBTC. 🪨",
} as const;

export const holderFeePercent = Number(process.env.NEXT_PUBLIC_HOLDER_FEE_PERCENT || 3) || 3;

const defaultEligibility =
  "StonkFun typically requires about $20 of $JROCK to receive payouts. A slice of each distribution covers their costs. Exact rules live on the token page.";

export const copy = {
  heroKicker: "Official parody pet. Unofficial Bitcoin attitude.",
  story: [
    {
      stamp: "01",
      title: "He said it does nothing.",
      body: "Jamie called Bitcoin a pet rock. We filed the complaint as a compliment.",
    },
    {
      stamp: "02",
      title: "So we made the rock tradable.",
      body: "Same smug face. Same navy tie. Now it has a Solana mint and a cardboard desk.",
    },
    {
      stamp: "03",
      title: "This rock pays in Bitcoin.",
      body: "Eligible holders may receive variable WBTC from StonkFun holder rewards. Same rock. Higher standards.",
    },
  ],
  steps: [
    {
      n: "01",
      title: "Adopt the rock",
      body: "Connect a Solana wallet and swap SOL, USDC, or any Solana asset into $JROCK through our Jupiter desk.",
    },
    {
      n: "02",
      title: "Hold the rock",
      body: "Keep an eligible balance in a supported self-custody wallet. The rock does not do brokerage accounts.",
    },
    {
      n: "03",
      title: "Get fed WBTC",
      body: `${holderFeePercent}% Token-2022 transfer tax is collected in WBTC and paid to eligible holders on StonkFun. Same rock. Higher standards.`,
    },
  ],
  caveats: [
    "Rewards depend on actual trading activity.",
    "Amounts and timing can vary.",
    "Rewards may be small or zero.",
    "Eligibility, tax, and payout timing follow the live StonkFun reward implementation, not this site.",
    "JROCK launches as a StonkFun reward coin paired with WBTC (Wormhole). The tax is paid in that quote token.",
    "Verify transactions and reward distributions on-chain.",
    `${holderFeePercent}% of each transfer is planned to go toward eligible holders in WBTC. Amounts follow live volume and are not a yield.`,
    `At launch, ${project.burnPercent}% of supply is planned to be purchased and burned. Verify that transaction on-chain when the receipt is filed.`,
    "A smaller float does not guarantee larger or faster WBTC payouts.",
  ],
  disclaimer:
    "Jamie’s Pet Rock is an independent parody memecoin created for entertainment. It is not affiliated with, sponsored by or endorsed by Jamie Dimon, JPMorgan Chase, Bitcoin, Wrapped Bitcoin or StonkFun. Holder rewards are variable, depend on platform activity and are not guaranteed. Cryptocurrency is highly speculative and may lose all value.",
} as const;

export function displayValue(value: string, fallback = "To be confirmed") {
  return value.trim() ? value : fallback;
}

export function eligibilityCopy() {
  return displayValue(project.eligibility, defaultEligibility);
}

export function hasMint() {
  return project.mint.trim().length > 0;
}

export function hasBurnTx() {
  return project.burnTx.length > 0;
}

const DEFAULT_LAUNCH_SUPPLY = 1_000_000_000;

/** LaunchLab default is 1B. Override with NEXT_PUBLIC_TOTAL_SUPPLY (1B, 1,000,000,000, etc). */
export function initialSupply() {
  const raw = project.totalSupply.trim().replace(/,/g, "").toUpperCase();
  if (!raw) return DEFAULT_LAUNCH_SUPPLY;
  const match = raw.match(/^([0-9]*\.?[0-9]+)\s*([KMB])?$/);
  if (!match) {
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_LAUNCH_SUPPLY;
  }
  const n = Number(match[1]);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LAUNCH_SUPPLY;
  const unit = match[2];
  return n * (unit === "B" ? 1e9 : unit === "M" ? 1e6 : unit === "K" ? 1e3 : 1);
}

export function plannedLaunchBurn() {
  return (initialSupply() * project.burnPercent) / 100;
}
