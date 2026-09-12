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
import { SiteTapes } from "./SiteTapes";
import { MobileAdoptBar } from "./MobileAdoptBar";
import type { BurnSnapshot } from "@/lib/burn";
import type { MarketSnapshot } from "@/lib/market";
import type { PriceTapeSnapshot } from "@/lib/tape";

export function Home({
  market,
  tape,
  burn,
}: {
  market: MarketSnapshot;
  tape: PriceTapeSnapshot;
  burn: BurnSnapshot;
}) {
  return (
    <>
      <BitcoinRain />
      <SiteTapes tape={tape} burn={burn} />
      <Header />
      <main className="pb-20 md:pb-0">
        <Hero />
        <AdoptDesk />
        <LiveRewardStrip market={market} />
        <ExhibitTape />
        <LoreSection />
        <RewardExplainer />
        <BurnReceipt burn={burn} />
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
