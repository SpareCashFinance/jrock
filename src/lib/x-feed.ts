import "server-only";

import { expandTweetLinks, TELEGRAM_X_HANDLE, type KennelTweet, type TweetUrlEntity } from "@/lib/telegram-copy";

const X_API = "https://api.twitter.com/2";

export function xBearerToken() {
  return (process.env.X_BEARER_TOKEN ?? "").trim();
}

export function xConfigured() {
  return xBearerToken().length > 20;
}

type XUserResponse = { data?: { id?: string } };
type XTweetsResponse = {
  data?: { id: string; text: string; entities?: { urls?: TweetUrlEntity[] } }[];
};

let cachedUserId: string | null = null;

async function xGet<T>(path: string): Promise<{ ok: boolean; status: number; data: T | null }> {
  const token = xBearerToken();
  if (!token) return { ok: false, status: 0, data: null };
  const res = await fetch(`${X_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return { ok: false, status: res.status, data: null };
  return { ok: true, status: res.status, data: (await res.json()) as T };
}

export async function kennelXUserId() {
  if (cachedUserId) return cachedUserId;
  const result = await xGet<XUserResponse>(`/users/by/username/${TELEGRAM_X_HANDLE}`);
  const id = result.data?.data?.id;
  if (id) cachedUserId = id;
  return id ?? null;
}

export async function latestKennelTweets(sinceId?: string | null) {
  if (!xConfigured()) return { tweets: [] as KennelTweet[], latestId: sinceId ?? null, reason: "X_BEARER_TOKEN is not set." };
  const userId = await kennelXUserId();
  if (!userId) return { tweets: [] as KennelTweet[], latestId: sinceId ?? null, reason: "could not load the X account" };

  const params = new URLSearchParams({
    max_results: "5",
    exclude: "replies,retweets",
    "tweet.fields": "created_at,entities",
  });
  if (sinceId) params.set("since_id", sinceId);

  const result = await xGet<XTweetsResponse>(`/users/${userId}/tweets?${params.toString()}`);
  if (result.status === 429) {
    return { tweets: [] as KennelTweet[], latestId: sinceId ?? null, reason: "x rate limit" };
  }
  if (!result.ok) {
    return { tweets: [] as KennelTweet[], latestId: sinceId ?? null, reason: `x ${result.status}` };
  }

  const tweets = (result.data?.data ?? [])
    .filter((row) => row.id && row.text)
    .map((row) => ({ id: row.id, text: expandTweetLinks(row.text, row.entities?.urls ?? []) }))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const latestId = tweets.at(-1)?.id ?? sinceId ?? null;
  return { tweets, latestId };
}
