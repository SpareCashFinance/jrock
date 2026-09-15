import { Home } from "@/components/site/Home";
import { getBurnSnapshot } from "@/lib/burn";
import { getLottoSnapshot } from "@/lib/lotto-chain";
import { getMarketSnapshot } from "@/lib/market";
import { getPriceTape } from "@/lib/tape";

export const revalidate = 30;

export default async function Page() {
  const market = await getMarketSnapshot();
  const [tape, burn, lotto] = await Promise.all([getPriceTape(market), getBurnSnapshot(), getLottoSnapshot(true)]);
  return <Home market={market} tape={tape} burn={burn} lotto={lotto} />;
}
