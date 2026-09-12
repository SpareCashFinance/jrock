import { BitcoinRain } from "@/components/brand/BitcoinRain";
import { Header } from "./Header";
import { Hero } from "./Hero";
import { AdoptDesk } from "./AdoptDesk";
import { LiveRewardStrip } from "./LiveRewardStrip";
import { ExhibitTape } from "./ExhibitTape";
import { LoreSection } from "./LoreSection";
import { RewardExplainer } from "./RewardExplainer";
import { BurnReceipt } from "./BurnReceipt";
import { RewardTerminal } from "./RewardTerminal";
import { TrainYourRock } from "./TrainYourRock";
import { TokenDetails } from "./TokenDetails";
import { CommunityLinks } from "./CommunityLinks";
import { RiskDisclosure } from "./RiskDisclosure";
import { Footer } from "./Footer";
import { PriceTape } from "./PriceTape";
import { MobileAdoptBar } from "./MobileAdoptBar";
import type { MarketSnapshot } from "@/lib/market";
import type { PriceTapeSnapshot } from "@/lib/tape";

export function Home({
  market,
  tape,
}: {
  market: MarketSnapshot;
  tape: PriceTapeSnapshot;
}) {
  return (
    <>
      <BitcoinRain />
      <PriceTape initial={tape} />
      <Header />
      <main className="pb-20 md:pb-0">
        <Hero />
        <AdoptDesk />
        <LiveRewardStrip market={market} />
        <ExhibitTape />
        <LoreSection />
        <RewardExplainer />
        <BurnReceipt />
        <RewardTerminal market={market} />
        <TrainYourRock />
        <TokenDetails />
        <CommunityLinks />
        <RiskDisclosure />
      </main>
      <Footer />
      <MobileAdoptBar />
    </>
  );
}
