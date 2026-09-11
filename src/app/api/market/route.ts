import { getMarketSnapshot } from "@/lib/market";

export async function GET() {
  const market = await getMarketSnapshot();
  return Response.json(market);
}
