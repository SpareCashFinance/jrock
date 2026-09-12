import { NextResponse } from "next/server";
import { serverSolanaRpcUrl } from "@/lib/solana";

export const dynamic = "force-dynamic";

const ALLOWED = new Set([
  "getAccountInfo",
  "getBalance",
  "getBlockHeight",
  "getEpochInfo",
  "getFeeForMessage",
  "getHealth",
  "getLatestBlockhash",
  "getMinimumBalanceForRentExemption",
  "getMultipleAccounts",
  "getRecentPrioritizationFees",
  "getSignatureStatuses",
  "getSlot",
  "getTokenAccountBalance",
  "getTokenAccountsByOwner",
  "getTransaction",
  "isBlockhashValid",
  "sendTransaction",
  "simulateTransaction",
]);

function rpcMethods(body: unknown): string[] {
  if (Array.isArray(body)) {
    return body.map((item) =>
      item && typeof item === "object" && "method" in item && typeof item.method === "string"
        ? item.method
        : "",
    );
  }
  if (body && typeof body === "object" && "method" in body && typeof body.method === "string") {
    return [body.method];
  }
  return [];
}

export async function POST(req: Request) {
  const raw = await req.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid JSON-RPC body" }, { status: 400 });
  }

  const methods = rpcMethods(parsed);
  if (!methods.length || methods.some((method) => !ALLOWED.has(method))) {
    return NextResponse.json({ error: "RPC method not allowed" }, { status: 403 });
  }

  const rpc = serverSolanaRpcUrl();
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw,
    cache: "no-store",
  }).catch(() => null);
  if (!res) return NextResponse.json({ error: "Solana RPC unreachable" }, { status: 502 });
  return new NextResponse(await res.text(), {
    status: res.status,
    headers: { "content-type": res.headers.get("content-type") || "application/json" },
  });
}
