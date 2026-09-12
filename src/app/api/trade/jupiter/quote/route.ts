import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      inputMint?: string;
      outputMint?: string;
      amount?: string;
      slippageBps?: number;
    };
    if (!body.inputMint || !body.outputMint || !body.amount) {
      return NextResponse.json({ error: "Missing Jupiter quote fields" }, { status: 400 });
    }
    if (body.inputMint === body.outputMint) {
      return NextResponse.json({ error: "Pick two different assets." }, { status: 400 });
    }
    const { quoteJupiterSwap } = await import("@/lib/jupiter/swap");
    const quote = await quoteJupiterSwap({
      inputMint: body.inputMint,
      outputMint: body.outputMint,
      amount: body.amount,
      slippageBps: body.slippageBps,
    });
    return NextResponse.json(quote);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Jupiter quote failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
