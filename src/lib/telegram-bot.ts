import "server-only";

import {
  TELEGRAM_LOTTO_CLIP,
  TELEGRAM_LOTTO_STICKER,
  type TelegramGuest,
} from "@/lib/telegram-copy";

const TELEGRAM_API = "https://api.telegram.org";

export type TelegramChat = {
  id: number;
  type: string;
  title?: string;
  username?: string;
};

export type TelegramUser = TelegramGuest;

export type TelegramMessage = {
  message_id: number;
  text?: string;
  chat: TelegramChat;
  new_chat_members?: TelegramUser[];
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

type TelegramApiResult<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

export function telegramBotToken() {
  return (process.env.TELEGRAM_BOT_TOKEN ?? "").trim();
}

export function telegramChatId() {
  const raw = (process.env.TELEGRAM_CHAT_ID ?? "").trim();
  return raw || "@Jamiespetrock";
}

export function telegramWebhookSecret() {
  return (process.env.TELEGRAM_WEBHOOK_SECRET ?? "").trim();
}

export function telegramConfigured() {
  return telegramBotToken().length > 0;
}

export function telegramWebhookUrl() {
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://petrock.fun").replace(/\/$/, "");
  return `${site}/api/telegram`;
}

function apiUrl(method: string) {
  const token = telegramBotToken();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set.");
  return `${TELEGRAM_API}/bot${token}/${method}`;
}

async function telegramCall<T>(method: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(apiUrl(method), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = (await res.json()) as TelegramApiResult<T>;
  if (!data.ok) throw new Error(data.description || `Telegram ${method} failed.`);
  return data.result as T;
}

export function webhookSecretMatches(request: Request) {
  const expected = telegramWebhookSecret();
  if (!expected) return false;
  const got = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  return got === expected;
}

export function chatAllowed(chat: TelegramChat) {
  if (chat.type === "private") return true;
  const allowed = telegramChatId();
  if (allowed.startsWith("@")) {
    return (chat.username ?? "").toLowerCase() === allowed.slice(1).toLowerCase();
  }
  return String(chat.id) === allowed;
}

export async function sendTelegramMessage(
  chatId: string | number,
  html: string,
  replyTo?: number,
) {
  return telegramCall<{ message_id: number }>("sendMessage", {
    chat_id: chatId,
    text: html,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_to_message_id: replyTo,
    allow_sending_without_reply: true,
  });
}

export async function sendKennelMessage(html: string) {
  if (!telegramConfigured()) return { skipped: true as const, reason: "TELEGRAM_BOT_TOKEN is not set." };
  const sent = await sendTelegramMessage(telegramChatId(), html);
  return { skipped: false as const, messageId: sent.message_id };
}

export async function sendKennelPhoto(html: string, photoUrl: string) {
  if (!telegramConfigured()) return { skipped: true as const, reason: "TELEGRAM_BOT_TOKEN is not set." };
  try {
    await telegramCall<{ message_id: number }>("sendSticker", {
      chat_id: telegramChatId(),
      sticker: photoUrl,
      disable_notification: true,
    });
  } catch {
    return sendKennelMessage(html);
  }
  const sent = await sendKennelMessage(html);
  return sent.skipped ? sent : { ...sent, photo: true as const };
}

export async function sendKennelCard(html: string, photoUrl?: string | null) {
  if (photoUrl) return sendKennelPhoto(html, photoUrl);
  return sendKennelMessage(html);
}

export async function sendKennelClip(html: string, chatId?: string | number) {
  if (!telegramConfigured()) return { skipped: true as const, reason: "TELEGRAM_BOT_TOKEN is not set." };
  const dest = chatId ?? telegramChatId();
  try {
    await telegramCall<{ message_id: number }>("sendSticker", {
      chat_id: dest,
      sticker: TELEGRAM_LOTTO_STICKER,
      disable_notification: true,
    });
    const sent = await sendTelegramMessage(dest, html);
    return { skipped: false as const, messageId: sent.message_id, photo: true as const };
  } catch {
    try {
      const sent = await telegramCall<{ message_id: number }>("sendAnimation", {
        chat_id: dest,
        animation: TELEGRAM_LOTTO_CLIP,
        caption: html.slice(0, 1024),
        parse_mode: "HTML",
      });
      return { skipped: false as const, messageId: sent.message_id, photo: true as const };
    } catch {
      const sent = await sendTelegramMessage(dest, html);
      return { skipped: false as const, messageId: sent.message_id };
    }
  }
}

export async function setTelegramWebhook() {
  if (!telegramConfigured()) return { ok: false, reason: "TELEGRAM_BOT_TOKEN is not set." };
  const secret = telegramWebhookSecret();
  if (!secret) return { ok: false, reason: "TELEGRAM_WEBHOOK_SECRET is not set." };
  await telegramCall("setWebhook", {
    url: telegramWebhookUrl(),
    secret_token: secret,
    allowed_updates: ["message"],
    drop_pending_updates: false,
  });
  await telegramCall("setMyCommands", {
    commands: [
      { command: "jackpot", description: "Current pot, slips, time left" },
      { command: "verify", description: "Last paid rock rematch" },
      { command: "help", description: "Kennel desk commands" },
    ],
  });
  return { ok: true, url: telegramWebhookUrl() };
}

export function parseTelegramUpdate(body: unknown): TelegramUpdate | null {
  if (!body || typeof body !== "object") return null;
  const update = body as TelegramUpdate;
  if (typeof update.update_id !== "number") return null;
  return update;
}
