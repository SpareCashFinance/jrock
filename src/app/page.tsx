import { Home } from "@/components/site/Home";
import { getMarketSnapshot } from "@/lib/market";
import { getPriceTape } from "@/lib/tape";

export const revalidate = 30;

export default async function Page() {
  const market = await getMarketSnapshot();
  const tape = await getPriceTape(market);
  return <Home market={market} tape={tape} />;
}
