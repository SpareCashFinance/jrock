import { NextResponse } from "next/server";
import { verifyDraw, verifyProgramDraw } from "@/lib/lotto";
import { getLottoSnapshot } from "@/lib/lotto-chain";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  try {
    const snapshot = await getLottoSnapshot(true);
    const checked =
      snapshot.engine === "program"
        ? snapshot.draw && snapshot.slips.length > 0
          ? await verifyProgramDraw(snapshot.draw, snapshot.slips, snapshot.round)
          : snapshot.status !== "drawn"
        : snapshot.draw && snapshot.slips.length > 0
          ? await verifyDraw(snapshot.draw, snapshot.slips)
          : snapshot.status !== "drawn";
    return NextResponse.json({
      ok: checked,
      status: snapshot.status,
      proof: snapshot.proof,
      draw: snapshot.draw,
      last: snapshot.last,
      tickets: snapshot.totalTickets,
      book: snapshot.slips,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lotto proof unavailable";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
