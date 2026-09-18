import { hasMint, project } from "./config";

const STONKFUN_ORIGIN = "https://www.stonkfun.xyz";
const SOLSCAN_ORIGIN = "https://solscan.io";
const DEXSCREENER_ORIGIN = "https://dexscreener.com/solana";

function envLink(key: string) {
  return (process.env[key] ?? "").trim();
}

function withMint(template: string, mint: string) {
  return template.replace("{mint}", mint);
}

export const links = {
  stonkfun: envLink("NEXT_PUBLIC_STONKFUN_URL") || STONKFUN_ORIGIN,
  twitter: envLink("NEXT_PUBLIC_X_URL") || "https://x.com/petrockbtc",
  telegram:
    envLink("NEXT_PUBLIC_TELEGRAM_URL") || "https://t.me/Jamiespetrock",
  dexscreenerOverride: envLink("NEXT_PUBLIC_DEXSCREENER_URL"),
  explorerOverride: envLink("NEXT_PUBLIC_EXPLORER_URL"),
};

export function stonkfunTokenUrl() {
  if (!hasMint()) return links.stonkfun;
  return (
    envLink("NEXT_PUBLIC_STONKFUN_TOKEN_URL") ||
    `${STONKFUN_ORIGIN}/token/${project.mint}`
  );
}

export function dexscreenerChartId() {
  return envLink("NEXT_PUBLIC_DEXSCREENER_PAIR") || project.mint.trim();
}

export function dexscreenerUrl() {
  if (links.dexscreenerOverride) return links.dexscreenerOverride;
  const id = dexscreenerChartId();
  if (!id) return "";
  return `${DEXSCREENER_ORIGIN}/${id}`;
}

export function dexscreenerEmbedUrl() {
  const custom = envLink("NEXT_PUBLIC_DEXSCREENER_EMBED_URL");
  if (custom) return custom;
  const id = dexscreenerChartId();
  if (!id) return "";
  const qs = new URLSearchParams({
    embed: "1",
    theme: "dark",
    chartTheme: "dark",
    trades: "0",
    info: "0",
    chartLeftToolbar: "0",
  });
  return `${DEXSCREENER_ORIGIN}/${encodeURIComponent(id)}?${qs}`;
}

export function explorerUrl(address = project.mint) {
  if (!address) return "";
  if (links.explorerOverride && address === project.mint) {
    return links.explorerOverride;
  }
  return `${SOLSCAN_ORIGIN}/token/${address}`;
}

export function explorerTxUrl(signature: string) {
  return `${SOLSCAN_ORIGIN}/tx/${signature}`;
}

export function explorerAccountUrl(address: string) {
  return address ? `${SOLSCAN_ORIGIN}/account/${address}` : "";
}

export function tweetIntentUrl(text: string, pageUrl = project.siteUrl) {
  const url = new URL("https://twitter.com/intent/tweet");
  url.searchParams.set("text", text);
  if (pageUrl) url.searchParams.set("url", pageUrl);
  return url.toString();
}

export function shareOnXUrl() {
  return tweetIntentUrl(project.shareText);
}

export function shareMemeOnXUrl(caption: string) {
  return tweetIntentUrl(`${caption}\n\n${project.ticker}`, "");
}

export type SocialKind = "telegram" | "x";

export type SiteLink = {
  label: string;
  href: string;
  kind?: SocialKind;
};

export function socialLinks(): { kind: SocialKind; href: string; label: string }[] {
  return [
    links.telegram ? { kind: "telegram" as const, href: links.telegram, label: "Telegram" } : null,
    links.twitter ? { kind: "x" as const, href: links.twitter, label: "X" } : null,
  ].filter((item): item is { kind: SocialKind; href: string; label: string } => Boolean(item));
}

export function visibleLinks(): SiteLink[] {
  return [
    { label: "stonk.fun", href: stonkfunTokenUrl() },
    links.twitter ? { label: "X", href: links.twitter, kind: "x" } : null,
    links.telegram ? { label: "Telegram", href: links.telegram, kind: "telegram" } : null,
    dexscreenerUrl()
      ? { label: "DexScreener", href: dexscreenerUrl() }
      : null,
    explorerUrl() ? { label: "Solscan", href: explorerUrl() } : null,
  ].filter((item): item is SiteLink => Boolean(item));
}

export { withMint };
