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
  launchpadName: "stonk.fun",
  rewardAsset: "WBTC",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "",
  mint: process.env.NEXT_PUBLIC_JROCK_MINT ?? "",
  rewardMint: process.env.NEXT_PUBLIC_WBTC_MINT ?? "",
  totalSupply: process.env.NEXT_PUBLIC_TOTAL_SUPPLY ?? "",
  transferFee: process.env.NEXT_PUBLIC_TRANSFER_FEE ?? "",
  eligibility: process.env.NEXT_PUBLIC_ELIGIBILITY ?? "",
  liquidityStatus: process.env.NEXT_PUBLIC_LIQUIDITY_STATUS ?? "",
  authorityStatus: process.env.NEXT_PUBLIC_AUTHORITY_STATUS ?? "",
  shareText:
    "Jamie said Bitcoin was a pet rock. Mine pays me in WBTC. 🪨₿",
} as const;

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
      body: "Eligible holders may receive variable WBTC through stonk.fun’s reward mechanics. Same rock. Higher standards.",
    },
  ],
  steps: [
    {
      n: "01",
      title: "Adopt the rock",
      body: "Buy $JROCK through the official stonk.fun market. No substitute pet rocks.",
    },
    {
      n: "02",
      title: "Hold the rock",
      body: "Keep an eligible balance in a supported self-custody wallet. The rock does not do brokerage accounts.",
    },
    {
      n: "03",
      title: "Get fed WBTC",
      body: "Eligible holders may receive variable WBTC distributions generated through stonk.fun’s reward mechanics.",
    },
  ],
  caveats: [
    "Rewards depend on actual trading activity.",
    "Amounts and timing can vary.",
    "Rewards may be small or zero.",
    "Eligibility and distribution rules are controlled by the live stonk.fun implementation.",
    "Verify transactions and reward distributions on-chain.",
    "A transfer tax or other platform fees may apply if configured at launch.",
  ],
  disclaimer:
    "Jamie’s Pet Rock is an independent parody memecoin created for entertainment. It is not affiliated with, sponsored by or endorsed by Jamie Dimon, JPMorgan Chase, Bitcoin, Wrapped Bitcoin or stonk.fun. Holder rewards are variable, depend on platform activity and are not guaranteed. Cryptocurrency is highly speculative and may lose all value.",
} as const;

export function displayValue(value: string, fallback = "To be confirmed") {
  return value.trim() ? value : fallback;
}

export function hasMint() {
  return project.mint.trim().length > 0;
}
