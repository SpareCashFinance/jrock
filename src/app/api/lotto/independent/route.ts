import { Connection } from "@solana/web3.js";
import { NextResponse } from "next/server";
import { serverSolanaRpcUrl } from "@/lib/solana";
import { verifyRoundIndependent } from "@/lib/lotto-verify";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const roundRaw = url.searchParams.get("round");
  const pda = url.searchParams.get("pda")?.trim() || undefined;
  const roundId = roundRaw != null && roundRaw !== "" ? Number.parseInt(roundRaw, 10) : undefined;
  try {
    const rpcUrl = serverSolanaRpcUrl();
    const receipt = await verifyRoundIndependent({
      roundId: Number.isFinite(roundId) ? roundId : undefined,
      roundPda: pda,
      rpc: new Connection(rpcUrl, "confirmed"),
      rpcUrl: new URL(rpcUrl).host,
    });
    return NextResponse.json(receipt, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Solana did not answer.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
