import { NextResponse } from "next/server";
import { runLottoCrank } from "@/lib/lotto-crank";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const cronSecret = (process.env.CRON_SECRET ?? "").trim();
  const auth = request.headers.get("authorization") ?? "";
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;
  if (request.headers.get("x-vercel-cron") === "1") return true;
  return false;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runLottoCrank();
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Crank failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
