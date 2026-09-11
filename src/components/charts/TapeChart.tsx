"use client";

import { useEffect, useRef } from "react";
import { AreaSeries, ColorType, createChart } from "lightweight-charts";
import type { RewardEvent } from "@/lib/market";

export function TapeChart({ history }: { history: RewardEvent[] }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = host.current;
    if (!node) return;

    const chart = createChart(node, {
      height: 220,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#b8b3a8",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(232,210,176,0.06)" },
        horzLines: { color: "rgba(232,210,176,0.06)" },
      },
      rightPriceScale: { borderColor: "rgba(232,210,176,0.12)" },
      timeScale: { borderColor: "rgba(232,210,176,0.12)", timeVisible: true },
      crosshair: { vertLine: { color: "rgba(247,147,26,0.45)" } },
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: "#f7931a",
      topColor: "rgba(247,147,26,0.28)",
      bottomColor: "rgba(247,147,26,0.02)",
      lineWidth: 2,
    });

    const points = history
      .filter((row) => row.at && row.amount != null)
      .map((row) => ({
        time: Math.floor(new Date(row.at as string).getTime() / 1000) as never,
        value: row.amount as number,
      }))
      .sort((a, b) => Number(a.time) - Number(b.time));

    if (points.length > 0) series.setData(points);
    chart.timeScale().fitContent();

    const resize = () => chart.applyOptions({ width: node.clientWidth });
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(node);

    return () => {
      observer.disconnect();
      chart.remove();
    };
  }, [history]);

  const empty = history.filter((row) => row.at && row.amount != null).length < 2;

  return (
    <div className="relative min-h-[220px]">
      <div ref={host} className="h-[220px] w-full" />
      {empty ? (
        <div className="absolute inset-0 grid place-items-center rounded-2xl border border-dashed border-[rgba(232,210,176,0.16)] bg-[#060a12]/40 text-center">
          <p className="max-w-xs text-sm text-[var(--dim)]">
            Trading tape locked. Verified WBTC distributions will plot here after launch — no simulated candles.
          </p>
        </div>
      ) : null}
    </div>
  );
}
