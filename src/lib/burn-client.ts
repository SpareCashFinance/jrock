"use client";

import { useEffect, useState } from "react";
import type { BurnSnapshot } from "./burn";

const POLL_MS = 30_000;
const listeners = new Set<(burn: BurnSnapshot) => void>();
let timer: number | null = null;
let inflight: Promise<void> | null = null;

function startPolling() {
  if (timer != null || typeof window === "undefined") return;
  const tick = () => {
    if (inflight) return;
    inflight = fetch("/api/burn")
      .then((res) => (res.ok ? (res.json() as Promise<BurnSnapshot>) : null))
      .then((burn) => {
        if (!burn) return;
        listeners.forEach((listener) => listener(burn));
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

export function useBurnSnapshot(initial: BurnSnapshot) {
  const [burn, setBurn] = useState(initial);

  useEffect(() => {
    listeners.add(setBurn);
    startPolling();
    return () => {
      listeners.delete(setBurn);
      if (listeners.size === 0) stopPolling();
    };
  }, []);

  return burn;
}
