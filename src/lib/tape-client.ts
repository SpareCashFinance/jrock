"use client";

import { useEffect, useState } from "react";
import type { PriceTapeSnapshot } from "./tape";

const POLL_MS = 30_000;
const listeners = new Set<(tape: PriceTapeSnapshot) => void>();
let timer: number | null = null;
let inflight: Promise<void> | null = null;

function startPolling() {
  if (timer != null || typeof window === "undefined") return;
  const tick = () => {
    if (inflight) return;
    inflight = fetch("/api/tape")
      .then((res) => (res.ok ? (res.json() as Promise<PriceTapeSnapshot>) : null))
      .then((tape) => {
        if (!tape) return;
        listeners.forEach((listener) => listener(tape));
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

export function usePriceTape(initial: PriceTapeSnapshot) {
  const [tape, setTape] = useState(initial);

  useEffect(() => {
    listeners.add(setTape);
    startPolling();
    return () => {
      listeners.delete(setTape);
      if (listeners.size === 0) stopPolling();
    };
  }, []);

  return tape;
}
