import { NextResponse } from "next/server";
import { jackpotText, verifyText, welcomeJoiners } from "@/lib/telegram-announce";
import {
  chatAllowed,
  parseTelegramUpdate,
  sendTelegramMessage,
  setTelegramWebhook,
  telegramConfigured,
  webhookSecretMatches,
} from "@/lib/telegram-bot";
import { formatHelp, formatStart, humanJoiners, parseTelegramCommand } from "@/lib/telegram-copy";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function cronAuthorized(request: Request) {
  const cronSecret = (process.env.CRON_SECRET ?? "").trim();
  const auth = request.headers.get("authorization") ?? "";
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true;
  if (request.headers.get("x-vercel-cron") === "1") return true;
  return false;
}

export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!telegramConfigured()) {
    return NextResponse.json({ ok: false, reason: "TELEGRAM_BOT_TOKEN is not set." });
  }
  try {
    const webhook = await setTelegramWebhook();
    return NextResponse.json({ ok: true, webhook }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook setup failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!telegramConfigured()) {
    return NextResponse.json({ ok: true, skipped: true });
  }
  if (!webhookSecretMatches(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const update = parseTelegramUpdate(body);
  const message = update?.message;
  if (!message) {
    return NextResponse.json({ ok: true });
  }
  if (!chatAllowed(message.chat)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const joiners = humanJoiners(message.new_chat_members);
  if (joiners.length) {
    try {
      const welcome = await welcomeJoiners({ chatId: message.chat.id, guests: joiners });
      return NextResponse.json({ ok: true, welcome });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Welcome failed";
      return NextResponse.json({ ok: false, error: messageText }, { status: 500 });
    }
  }

  const command = parseTelegramCommand(message.text);
  if (!command) {
    return NextResponse.json({ ok: true });
  }

  try {
    const text =
      command === "jackpot"
        ? await jackpotText()
        : command === "verify"
          ? await verifyText()
          : command === "start"
            ? formatStart()
            : formatHelp();
    await sendTelegramMessage(message.chat.id, text, message.message_id);
    return NextResponse.json({ ok: true, command });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Telegram reply failed";
    return NextResponse.json({ ok: false, error: messageText }, { status: 500 });
  }
}
