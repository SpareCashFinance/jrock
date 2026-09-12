import type { Metadata } from "next";
import { BitcoinRain } from "@/components/brand/BitcoinRain";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { MemeDesk } from "@/components/site/MemeDesk";
import { PriceTape } from "@/components/site/PriceTape";
import { project } from "@/lib/config";
import { getPriceTape } from "@/lib/tape";

export const revalidate = 30;

const title = `Steal these | ${project.name}`;
const description =
  "Too lazy to post? Steal official Jamie’s Pet Rock memes, copy the caption, and dump them on X or Telegram.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/memes",
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

export default async function MemesPage() {
  const tape = await getPriceTape();
  return (
    <>
      <BitcoinRain />
      <PriceTape initial={tape} />
      <Header />
      <main>
        <MemeDesk />
      </main>
      <Footer />
    </>
  );
}
