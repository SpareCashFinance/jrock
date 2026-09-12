import { Home } from "@/components/site/Home";
import { getBurnSnapshot } from "@/lib/burn";
import { getMarketSnapshot } from "@/lib/market";
import { getPriceTape } from "@/lib/tape";

export const revalidate = 30;

export default async function Page() {
  const market = await getMarketSnapshot();
  const [tape, burn] = await Promise.all([getPriceTape(market), getBurnSnapshot()]);
  return <Home market={market} tape={tape} burn={burn} />;
}
