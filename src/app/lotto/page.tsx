import type { Metadata } from "next";
import { BitcoinRain } from "@/components/brand/BitcoinRain";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { LottoDesk } from "@/components/site/LottoDesk";
import { SiteTapes } from "@/components/site/SiteTapes";
import { getBurnSnapshot } from "@/lib/burn";
import { project } from "@/lib/config";
import { getLottoSnapshot } from "@/lib/lotto-chain";
import { getPriceTape } from "@/lib/tape";

export const dynamic = "force-dynamic";

const title = `Kennel lotto | ${project.name}`;
const description =
  "Buy a $JROCK kennel slip in SOL. 1% of the slip price is the kennel fee. Winner takes 85% of the pot. Fifteen percent stays to seed the next round.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/lotto",
  },
  openGraph: {
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    site: "@petrockbtc",
    creator: "@petrockbtc",
    title,
    description,
  },
};

export default async function LottoPage() {
  const [tape, burn, lotto] = await Promise.all([getPriceTape(), getBurnSnapshot(), getLottoSnapshot(true)]);
  return (
    <>
      <BitcoinRain />
      <SiteTapes tape={tape} burn={burn} />
      <Header />
      <main>
        <LottoDesk initial={lotto} />
      </main>
      <Footer />
    </>
  );
}
