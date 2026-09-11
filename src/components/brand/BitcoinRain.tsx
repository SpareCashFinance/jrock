"use client";

import { useMemo, useSyncExternalStore } from "react";

const COINS = [
  { left: 4, size: 14, delay: 0, duration: 16, drift: 12, opacity: 0.22 },
  { left: 11, size: 18, delay: 2.4, duration: 19, drift: -10, opacity: 0.18 },
  { left: 18, size: 12, delay: 6.1, duration: 14, drift: 8, opacity: 0.16 },
  { left: 26, size: 20, delay: 1.1, duration: 21, drift: -14, opacity: 0.2 },
  { left: 33, size: 15, delay: 8.2, duration: 17, drift: 9, opacity: 0.15 },
  { left: 41, size: 13, delay: 3.7, duration: 15, drift: -7, opacity: 0.19 },
  { left: 49, size: 17, delay: 5.5, duration: 20, drift: 11, opacity: 0.17 },
  { left: 57, size: 12, delay: 9.4, duration: 13, drift: -9, opacity: 0.14 },
  { left: 64, size: 19, delay: 0.8, duration: 18, drift: 6, opacity: 0.21 },
  { left: 72, size: 14, delay: 7.0, duration: 16, drift: -12, opacity: 0.16 },
  { left: 79, size: 16, delay: 4.2, duration: 22, drift: 10, opacity: 0.18 },
  { left: 86, size: 13, delay: 10.1, duration: 15, drift: -8, opacity: 0.15 },
  { left: 93, size: 18, delay: 2.9, duration: 19, drift: 7, opacity: 0.2 },
];

function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export function BitcoinRain() {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const reduce = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
  const coins = useMemo(() => COINS, []);
  if (!mounted || reduce) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {coins.map((coin, index) => (
        <span
          key={index}
          className="bitcoin-rain absolute top-[-8%] grid place-items-center rounded-full bg-[#f7931a] font-black text-[#1a0f04] shadow-[0_0_16px_rgba(247,147,26,0.28)]"
          style={{
            left: `${coin.left}%`,
            width: coin.size,
            height: coin.size,
            fontSize: Math.max(8, coin.size * 0.58),
            opacity: coin.opacity,
            animationDelay: `${coin.delay}s`,
            animationDuration: `${coin.duration}s`,
            ["--drift" as string]: `${coin.drift}px`,
          }}
        >
          ₿
        </span>
      ))}
    </div>
  );
}
