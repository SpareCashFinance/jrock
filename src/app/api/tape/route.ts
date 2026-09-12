import { getPriceTape } from "@/lib/tape";

export const revalidate = 30;

export async function GET() {
  const tape = await getPriceTape();
  return Response.json(tape, {
    headers: {
      "cache-control": "public, s-maxage=30, stale-while-revalidate=60",
    },
  });
}
