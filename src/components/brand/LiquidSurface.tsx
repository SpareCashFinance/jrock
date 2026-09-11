"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const LiquidGlass = dynamic(() => import("liquid-glass-react"), { ssr: false });

export function LiquidSurface({
  children,
  className,
  radius = 28,
  intensity = "panel",
}: {
  children: ReactNode;
  className?: string;
  radius?: number;
  intensity?: "dock" | "panel" | "button";
}) {
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const fallback = cn("glass-panel", className);

  if (!ready) return <div className={fallback}>{children}</div>;

  return (
    <LiquidGlass
      displacementScale={intensity === "button" ? 36 : intensity === "dock" ? 22 : 30}
      blurAmount={intensity === "button" ? 0.06 : 0.08}
      saturation={128}
      aberrationIntensity={0.55}
      elasticity={0.08}
      cornerRadius={radius}
      overLight={false}
      className={className}
    >
      {children}
    </LiquidGlass>
  );
}
