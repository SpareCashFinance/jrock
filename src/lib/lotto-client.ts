"use client";

import { useEffect, useState } from "react";
import { emptyLottoSnapshot, type LottoSnapshot } from "@/lib/lotto";

const POLL_MS = 4_000;
const HIDDEN_POLL_MS = 15_000;

export type RefreshLottoOpts = {
  fresh?: boolean;
  minTickets?: number;
  attempts?: number;
};

const listeners = new Set<(tape: LottoSnapshot) => void>();
let latest: LottoSnapshot | null = null;
let timer: number | null = null;
let inflight: Promise<LottoSnapshot> | null = null;

function emit(tape: LottoSnapshot) {
  latest = tape;
  listeners.forEach((listener) => listener(tape));
}

async function fetchTape(fresh = false) {
  const url = fresh ? `/api/lotto?fresh=1&t=${Date.now()}` : `/api/lotto?t=${Date.now()}`;
  const res = await fetch(url, { cache: "no-store" });
  const next = (await res.json()) as LottoSnapshot & { error?: string };
  if (!res.ok) throw new Error(next.error || "The lotto tape refused");
  emit(next);
  return next;
}

function pollDelay() {
  return typeof document !== "undefined" && document.visibilityState === "hidden" ? HIDDEN_POLL_MS : POLL_MS;
}

function armTimer() {
  if (timer != null) window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    timer = null;
    void tick();
  }, pollDelay());
}

function tick(fresh = false) {
  if (inflight && !fresh) return inflight;
  inflight = fetchTape(fresh)
    .catch(() => latest ?? emptyLottoSnapshot("Loading the kennel pot."))
    .finally(() => {
      inflight = null;
      if (listeners.size > 0) armTimer();
    });
  return inflight;
}

function startPolling() {
  if (typeof window === "undefined") return;
  void tick();
}

function stopPolling() {
  if (timer == null) return;
  window.clearTimeout(timer);
  timer = null;
}

export async function refreshLotto(opts: RefreshLottoOpts = {}) {
  const attempts = Math.max(1, opts.attempts ?? (opts.minTickets != null ? 10 : 1));
  let tape = latest;
  for (let i = 0; i < attempts; i += 1) {
    tape = await fetchTape(opts.fresh || i > 0);
    if (opts.minTickets == null || tape.totalTickets >= opts.minTickets) return tape;
    await new Promise((resolve) => window.setTimeout(resolve, 1_200));
  }
  return tape ?? emptyLottoSnapshot("Loading the kennel pot.");
}

export function useLottoSnapshot() {
  const [tape, setTape] = useState<LottoSnapshot>(
    () => latest ?? emptyLottoSnapshot("Loading the kennel pot."),
  );

  useEffect(() => {
    listeners.add(setTape);
    if (latest) setTape(latest);
    startPolling();
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      listeners.delete(setTape);
      document.removeEventListener("visibilitychange", onVisible);
      if (listeners.size === 0) stopPolling();
    };
  }, []);

  return { tape, reload: refreshLotto };
}

export function useCountdown(iso: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const end = Date.parse(iso);
  const left = Math.max(0, (Number.isFinite(end) ? end : 0) - now);
  const total = Math.floor(left / 1000);
  return {
    done: left <= 0,
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}
