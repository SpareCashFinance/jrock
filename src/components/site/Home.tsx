import { BitcoinRain } from "@/components/brand/BitcoinRain";
import { AdoptSwap } from "@/components/solana/AdoptSwap";
import { Header } from "./Header";
import { Hero } from "./Hero";
import { LiveRewardStrip } from "./LiveRewardStrip";
import { ExhibitTape } from "./ExhibitTape";
import { LoreSection } from "./LoreSection";
import { RewardExplainer } from "./RewardExplainer";
import { RewardTerminal } from "./RewardTerminal";
import { TrainYourRock } from "./TrainYourRock";
import { TokenDetails } from "./TokenDetails";
import { CommunityLinks } from "./CommunityLinks";
import { RiskDisclosure } from "./RiskDisclosure";
import { Footer } from "./Footer";
import type { MarketSnapshot } from "@/lib/market";

export function Home({ market }: { market: MarketSnapshot }) {
  return (
    <>
      <BitcoinRain />
      <Header />
      <main>
        <Hero />
        <AdoptSwap />
        <LiveRewardStrip market={market} />
        <ExhibitTape />
        <LoreSection />
        <RewardExplainer />
        <RewardTerminal market={market} />
        <TrainYourRock />
        <TokenDetails />
        <CommunityLinks />
        <RiskDisclosure />
      </main>
      <Footer />
    </>
  );
}
