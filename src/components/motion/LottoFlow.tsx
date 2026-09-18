"use client";

import NumberFlow, { NumberFlowGroup } from "@number-flow/react";
import { cn } from "@/lib/utils";

const SOL_FORMAT = { minimumFractionDigits: 2, maximumFractionDigits: 4 } as const;
const ROLL = {
  transformTiming: { duration: 720, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
  spinTiming: { duration: 920, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
  opacityTiming: { duration: 260, easing: "ease-out" },
} as const;

export function SolFlow({
  value,
  className,
  suffix = "SOL",
  trend,
}: {
  value: number;
  className?: string;
  suffix?: string;
  trend?: number;
}) {
  return (
    <span className={cn("house-flow", className)}>
      <NumberFlow value={Number.isFinite(value) ? value : 0} format={SOL_FORMAT} trend={trend} willChange {...ROLL} />
      {suffix ? <span className="house-flow-unit">{suffix}</span> : null}
    </span>
  );
}

export function CountFlow({
  value,
  className,
  digits = 1,
  trend,
}: {
  value: number;
  className?: string;
  digits?: number;
  trend?: number;
}) {
  return (
    <NumberFlow
      value={Number.isFinite(value) ? Math.max(0, value) : 0}
      format={{ minimumIntegerDigits: digits, maximumFractionDigits: 0 }}
      trend={trend}
      willChange
      className={className}
      {...ROLL}
    />
  );
}

export { NumberFlowGroup };
