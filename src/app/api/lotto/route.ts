import { NextResponse } from "next/server";
import { getLottoSnapshot } from "@/lib/lotto-chain";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  try {
    const snapshot = await getLottoSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lotto tape unavailable";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
