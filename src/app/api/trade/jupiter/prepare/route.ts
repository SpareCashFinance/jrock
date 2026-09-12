import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      owner?: string;
      inputMint?: string;
      outputMint?: string;
      amount?: string;
      slippageBps?: number;
      quoteResponse?: Record<string, unknown>;
    };
    if (!body.owner || !body.inputMint || !body.outputMint || !body.amount) {
      return NextResponse.json({ error: "Missing Jupiter swap fields" }, { status: 400 });
    }
    if (body.inputMint === body.outputMint) {
      return NextResponse.json({ error: "Pick two different assets." }, { status: 400 });
    }
    const { prepareJupiterSwap } = await import("@/lib/jupiter/swap");
    const plan = await prepareJupiterSwap({
      owner: body.owner,
      inputMint: body.inputMint,
      outputMint: body.outputMint,
      amount: body.amount,
      slippageBps: body.slippageBps,
      quoteResponse: body.quoteResponse,
    });
    return NextResponse.json(plan);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Jupiter prepare failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
