import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function LiquidSurface({
  children,
  className,
  radius = 28,
}: {
  children: ReactNode;
  className?: string;
  radius?: number;
  intensity?: "dock" | "panel" | "button";
}) {
  return (
    <div className={cn("glass-panel", className)} style={{ borderRadius: radius }}>
      {children}
    </div>
  );
}
