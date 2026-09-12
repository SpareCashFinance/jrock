import { NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      signedTransaction?: string;
      requestId?: string;
      lastValidBlockHeight?: string;
    };
    if (!body.signedTransaction || !body.requestId) {
      return NextResponse.json({ error: "Missing Jupiter execute fields" }, { status: 400 });
    }
    const { executeJupiterSwap } = await import("@/lib/jupiter/swap");
    const result = await executeJupiterSwap({
      signedTransaction: body.signedTransaction,
      requestId: body.requestId,
      lastValidBlockHeight: body.lastValidBlockHeight,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Jupiter execute failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
