import "server-only";

export type TelegramMark = "win" | "hour" | "open" | "roll" | "tickets" | "mile";

const KEYS: Record<TelegramMark, string> = {
  win: "lotto:tg:last-win",
  hour: "lotto:tg:last-hour",
  open: "lotto:tg:last-open",
  roll: "lotto:tg:last-roll",
  tickets: "lotto:tg:last-tickets",
  mile: "lotto:tg:last-mile",
};

const memory: Record<TelegramMark, number | null> = {
  win: null,
  hour: null,
  open: null,
  roll: null,
  tickets: null,
  mile: null,
};

function kvConfigured() {
  return Boolean((process.env.KV_REST_API_URL ?? "").trim() && (process.env.KV_REST_API_TOKEN ?? "").trim());
}

async function kvGet(key: string) {
  const url = (process.env.KV_REST_API_URL ?? "").trim();
  const token = (process.env.KV_REST_API_TOKEN ?? "").trim();
  if (!url || !token) return null;
  const res = await fetch(`${url.replace(/\/$/, "")}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { result?: string | number | null };
  return data.result ?? null;
}

async function kvSet(key: string, value: string | number) {
  const url = (process.env.KV_REST_API_URL ?? "").trim().replace(/\/$/, "");
  const token = (process.env.KV_REST_API_TOKEN ?? "").trim();
  if (!url || !token) return false;
  const res = await fetch(`${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(String(value))}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return res.ok;
}

const TEXT_KEYS = { x: "lotto:tg:last-x" };
const textMemory: Record<keyof typeof TEXT_KEYS, string | null> = { x: null };

export async function markedText(kind: keyof typeof TEXT_KEYS) {
  if (textMemory[kind]) return textMemory[kind];
  const raw = await kvGet(TEXT_KEYS[kind]);
  if (raw == null || raw === "") return null;
  const value = String(raw);
  textMemory[kind] = value;
  return value;
}

export async function markText(kind: keyof typeof TEXT_KEYS, value: string) {
  textMemory[kind] = value;
  return kvSet(TEXT_KEYS[kind], value);
}

export function telegramStatePersistent() {
  return kvConfigured();
}

export async function markedRound(kind: TelegramMark) {
  if (memory[kind] != null) return memory[kind];
  const raw = await kvGet(KEYS[kind]);
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n)) return null;
  memory[kind] = n;
  return n;
}

export async function markRound(kind: TelegramMark, round: number) {
  memory[kind] = round;
  return kvSet(KEYS[kind], round);
}

export async function lastAnnouncedRound() {
  return markedRound("win");
}

export async function markAnnouncedRound(round: number) {
  return markRound("win", round);
}

export function rememberedRound() {
  return memory.win;
}
