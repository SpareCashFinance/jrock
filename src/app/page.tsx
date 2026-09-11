import { Home } from "@/components/site/Home";
import { getMarketSnapshot } from "@/lib/market";

export const revalidate = 30;

export default async function Page() {
  const market = await getMarketSnapshot();
  return <Home market={market} />;
}
