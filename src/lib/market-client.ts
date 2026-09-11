"use client";

import { useEffect, useState } from "react";
import type { MarketSnapshot } from "./market";

const POLL_MS = 30_000;
const listeners = new Set<(market: MarketSnapshot) => void>();
let timer: number | null = null;
let inflight: Promise<void> | null = null;

function startPolling() {
  if (timer != null || typeof window === "undefined") return;
  const tick = () => {
    if (inflight) return;
    inflight = fetch("/api/market")
      .then((res) => (res.ok ? (res.json() as Promise<MarketSnapshot>) : null))
      .then((market) => {
        if (!market) return;
        listeners.forEach((listener) => listener(market));
      })
      .catch(() => undefined)
      .finally(() => {
        inflight = null;
      });
  };
  void tick();
  timer = window.setInterval(tick, POLL_MS);
}

function stopPolling() {
  if (timer == null) return;
  window.clearInterval(timer);
  timer = null;
}

export function useMarketSnapshot(initial: MarketSnapshot) {
  const [market, setMarket] = useState(initial);

  useEffect(() => {
    listeners.add(setMarket);
    if (initial.mint) startPolling();
    return () => {
      listeners.delete(setMarket);
      if (listeners.size === 0) stopPolling();
    };
  }, [initial.mint]);

  return market;
}
