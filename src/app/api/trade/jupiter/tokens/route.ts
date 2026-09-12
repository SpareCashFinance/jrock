import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    const { searchJupiterTokens, discoverJupiterTokens } = await import("@/lib/jupiter/tokens");
    const tokens = q ? await searchJupiterTokens(q) : await discoverJupiterTokens();
    return NextResponse.json(
      { tokens },
      {
        headers: {
          "cache-control": q
            ? "no-store"
            : "public, s-maxage=60, stale-while-revalidate=120",
        },
      },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Jupiter token search failed";
    return NextResponse.json({ error: message, tokens: [] }, { status: 500 });
  }
}
