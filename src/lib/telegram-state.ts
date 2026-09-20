import "server-only";

const KEY = "lotto:tg:last-win";

let memoryAnnounced: number | null = null;

function kvConfigured() {
  return Boolean((process.env.KV_REST_API_URL ?? "").trim() && (process.env.KV_REST_API_TOKEN ?? "").trim());
}

async function kv<T>(path: string): Promise<T | null> {
  const url = (process.env.KV_REST_API_URL ?? "").trim();
  const token = (process.env.KV_REST_API_TOKEN ?? "").trim();
  if (!url || !token) return null;
  const res = await fetch(`${url.replace(/\/$/, "")}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { result?: T | null };
  return data.result ?? null;
}

export function telegramStatePersistent() {
  return kvConfigured();
}

export async function lastAnnouncedRound() {
  if (memoryAnnounced != null) return memoryAnnounced;
  const raw = await kv<string | number>(`/get/${encodeURIComponent(KEY)}`);
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n)) return null;
  memoryAnnounced = n;
  return n;
}

export async function markAnnouncedRound(round: number) {
  memoryAnnounced = round;
  if (!kvConfigured()) return false;
  const url = (process.env.KV_REST_API_URL ?? "").trim().replace(/\/$/, "");
  const token = (process.env.KV_REST_API_TOKEN ?? "").trim();
  const res = await fetch(`${url}/set/${encodeURIComponent(KEY)}/${encodeURIComponent(String(round))}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return res.ok;
}

export function rememberedRound() {
  return memoryAnnounced;
}
