import { NextResponse } from "next/server";
import { pulseKennel, runKennelDesk } from "@/lib/telegram-announce";
import { setTelegramWebhook, telegramConfigured } from "@/lib/telegram-bot";

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
  if (!telegramConfigured()) {
    return NextResponse.json({ ok: true, skipped: true, reason: "TELEGRAM_BOT_TOKEN is not set." });
  }

  const url = new URL(request.url);
  const pulse = url.searchParams.get("pulse") !== "0";
  try {
    let webhook: Awaited<ReturnType<typeof setTelegramWebhook>> | { ok: false; reason: string } = {
      ok: false,
      reason: "not attempted",
    };
    try {
      webhook = await setTelegramWebhook();
    } catch (error) {
      webhook = { ok: false, reason: error instanceof Error ? error.message : "webhook failed" };
    }
    const result = pulse ? await pulseKennel() : await runKennelDesk();
    return NextResponse.json({ ok: true, webhook, result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Telegram cron failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
