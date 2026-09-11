"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { RewardEvent } from "@/lib/market";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

export function RewardAnalytics({ history }: { history: RewardEvent[] }) {
  const points = history.filter((row) => row.amount != null);
  const option = useMemo(
    () => ({
      backgroundColor: "transparent",
      tooltip: { trigger: "axis" },
      grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
      xAxis: {
        type: "category",
        data: points.map((row, index) => row.at?.slice(5, 10) || `#${index + 1}`),
        axisLine: { lineStyle: { color: "rgba(232,210,176,0.2)" } },
        axisLabel: { color: "#b8b3a8" },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "rgba(232,210,176,0.08)" } },
        axisLabel: { color: "#b8b3a8" },
      },
      series: [
        {
          type: "bar",
          data: points.map((row) => row.amount),
          itemStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "#ffb347" },
                { offset: 1, color: "#f7931a" },
              ],
            },
            borderRadius: [8, 8, 0, 0],
          },
        },
      ],
    }),
    [points],
  );

  if (points.length === 0) {
    return (
      <div className="grid min-h-[220px] place-items-center text-center text-sm text-[var(--dim)]">
        Protocol analytics stay blank until a verified payout lands on-chain.
      </div>
    );
  }

  return <ReactECharts option={option} style={{ height: 220, width: "100%" }} />;
}
