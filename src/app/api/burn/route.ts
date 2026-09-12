import { getBurnSnapshot } from "@/lib/burn";

export const revalidate = 30;

export async function GET() {
  const burn = await getBurnSnapshot();
  return Response.json(burn, {
    headers: {
      "cache-control": "public, s-maxage=30, stale-while-revalidate=60",
    },
  });
}
