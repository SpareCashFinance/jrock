import type { Metadata } from "next";
import { BitcoinRain } from "@/components/brand/BitcoinRain";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { LottoVerifyDesk } from "@/components/site/LottoVerify";
import { SiteTapes } from "@/components/site/SiteTapes";
import { getBurnSnapshot } from "@/lib/burn";
import { project } from "@/lib/config";
import { getPriceTape } from "@/lib/tape";

export const dynamic = "force-dynamic";

const title = `Lotto verifier | ${project.name}`;
const description =
  "Independently read the $JROCK kennel lotto round from Solana mainnet and recompute the winning slip.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/lotto/verify" },
};

export default async function LottoVerifyPage() {
  const [tape, burn] = await Promise.all([getPriceTape(), getBurnSnapshot()]);
  return (
    <>
      <BitcoinRain />
      <SiteTapes tape={tape} burn={burn} />
      <Header />
      <main>
        <LottoVerifyDesk />
      </main>
      <Footer />
    </>
  );
}
