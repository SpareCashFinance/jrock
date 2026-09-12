"use client";

import { useSyncExternalStore } from "react";
import NumberFlow from "@number-flow/react";
import { formatCompact, formatUsd, timeAgo } from "@/lib/format";
import { useBurnSnapshot } from "@/lib/burn-client";
import type { BurnSnapshot } from "@/lib/burn";
import { project } from "@/lib/config";

function heatFor(burn: BurnSnapshot) {
  if (burn.totalBurned <= 0) return "armed";
  if (burn.burnedPct >= 50 || burn.launchBurned > 0) return "roaring";
  return "lit";
}

function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function FireMark({ heat, size = "sm" }: { heat: ReturnType<typeof heatFor>; size?: "sm" | "lg" }) {
  const reduce = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
  const px = size === "lg" ? 56 : 26;

  return (
    <span className={`burn-fire burn-fire-${heat} ${size === "lg" ? "burn-fire-lg" : ""}`} aria-hidden>
      <span className="burn-fire-glow" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={reduce ? "/media/burn-fire-still.png" : "/media/burn-fire.gif"}
        alt=""
        width={px}
        height={px}
        className="burn-fire-gif"
      />
    </span>
  );
}

export function BurnRibbon({ initial }: { initial: BurnSnapshot }) {
  const burn = useBurnSnapshot(initial);
  const heat = heatFor(burn);
  const pct = Math.max(0, Math.min(100, burn.burnedPct));
  const gone = formatCompact(burn.totalBurned);
  const launchPct = burn.initialSupply > 0 ? (burn.launchBurned / burn.initialSupply) * 100 : 0;
  const flyPct = burn.initialSupply > 0 ? (burn.platformBurned / burn.initialSupply) * 100 : 0;

  return (
    <a
      href="/#burn"
      className="burn-ribbon"
      data-heat={heat}
      aria-label={`${pct.toFixed(2)} percent of ${project.ticker} supply burned`}
    >
      <FireMark heat={heat} />
      <span className="min-w-0">
        <span className="flex items-baseline gap-1.5">
          <span className="font-mono text-[13px] font-semibold tabular-nums text-white sm:text-sm">
            <NumberFlow value={pct} format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} />
            <span className="text-[var(--orange)]">%</span>
          </span>
          <span className="hidden text-[10px] tracking-[0.16em] uppercase text-[var(--gold)] sm:inline">
            burned
          </span>
        </span>
        <span className="block text-[10px] leading-none text-[var(--stone)] sm:hidden">
          {burn.status === "live" ? "live fire" : `${burn.plannedLaunchPct}% armed`}
        </span>
      </span>
      <span className="burn-track" aria-hidden>
        <span className="burn-track-fill" style={{ width: `${pct}%` }} />
        <span
          className="burn-track-mark"
          style={{ left: `${burn.plannedLaunchPct}%` }}
          title={`${burn.plannedLaunchPct}% launch burn`}
        />
      </span>
      <span className="hidden min-w-0 items-center gap-3 text-[10px] font-semibold tracking-[0.14em] uppercase sm:flex">
        <span className="text-[var(--orange-2)]">{gone ? `${gone} gone` : `${burn.plannedLaunchPct}% armed`}</span>
        <span className="hidden text-[var(--stone)] lg:inline">
          Launch {launchPct.toFixed(launchPct >= 10 ? 0 : 2)}%
          <span className="mx-1.5 text-[var(--graphite)]">·</span>
          Flywheel {flyPct.toFixed(2)}%
        </span>
      </span>
    </a>
  );
}

export function BurnIncinerator({ initial }: { initial: BurnSnapshot }) {
  const burn = useBurnSnapshot(initial);
  const heat = heatFor(burn);
  const pct = Math.max(0, Math.min(100, burn.burnedPct));
  const gone = formatCompact(burn.totalBurned);
  const remaining = formatCompact(
    burn.circulatingSupply ?? Math.max(0, burn.initialSupply - burn.totalBurned),
  );
  const last = timeAgo(burn.lastBurnAt);

  return (
    <div className="burn-incinerator" data-heat={heat}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <FireMark heat={heat} size="lg" />
          <div>
            <p className="kicker">Live incinerator</p>
            <p className="display mt-1 text-5xl text-white sm:text-6xl">
              <NumberFlow value={pct} format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} />
              <span className="text-[var(--orange)]">%</span>
            </p>
          </div>
        </div>
        <p className="max-w-sm text-sm leading-6 text-[var(--dim)]">{burn.message}</p>
      </div>

      <div className="burn-track burn-track-lg mt-5" aria-hidden>
        <span className="burn-track-fill" style={{ width: `${pct}%` }} />
        <span className="burn-track-mark" style={{ left: `${burn.plannedLaunchPct}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-[10px] tracking-[0.16em] uppercase text-[var(--stone)]">
        <span>0%</span>
        <span className="text-[var(--orange)]">{burn.plannedLaunchPct}% launch</span>
        <span>100%</span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="kicker">Launch burn</p>
          <p className="mt-2 font-mono text-2xl text-white">
            {burn.launchBurned > 0 ? `${formatCompact(burn.launchBurned)}` : "Armed"}
          </p>
          <p className="mt-1 text-xs text-[var(--dim)]">
            {burn.launchFiled
              ? `${burn.plannedLaunchPct}% purchased and destroyed`
              : `${burn.plannedLaunchPct}% queued at launch`}
          </p>
        </div>
        <div>
          <p className="kicker">On-chain burns</p>
          <p className="mt-2 font-mono text-2xl text-white">
            {burn.platformBurned > 0 ? formatCompact(burn.platformBurned) : "—"}
          </p>
          <p className="mt-1 text-xs text-[var(--dim)]">
            {burn.platformCount > 0
              ? `${burn.platformCount.toLocaleString()} sweeps${last ? ` · ${last}` : ""}`
              : "Extra burns after the launch buyback"}
          </p>
        </div>
        <div>
          <p className="kicker">Still circulating</p>
          <p className="mt-2 font-mono text-2xl text-white">{remaining ?? "—"}</p>
          <p className="mt-1 text-xs text-[var(--dim)]">
            {gone ? `${gone} ${project.ticker} gone` : `of ${formatCompact(burn.initialSupply)} minted`}
            {burn.platformUsd != null && burn.platformUsd > 0
              ? ` · ${formatUsd(burn.platformUsd)} flywheel`
              : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
