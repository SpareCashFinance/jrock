import { NextResponse } from "next/server";
import { serverSolanaRpcUrl } from "@/lib/solana";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const rpc = serverSolanaRpcUrl();
  const body = await req.text();
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    cache: "no-store",
  }).catch(() => null);
  if (!res) return NextResponse.json({ error: "Solana RPC unreachable" }, { status: 502 });
  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") || "application/json" },
  });
}
