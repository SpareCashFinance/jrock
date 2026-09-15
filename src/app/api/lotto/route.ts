import { NextResponse } from "next/server";
import { getLottoSnapshot } from "@/lib/lotto-chain";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const fresh = new URL(request.url).searchParams.get("fresh") === "1";
  try {
    const snapshot = await getLottoSnapshot(fresh);
    return NextResponse.json(snapshot, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lotto tape unavailable";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
