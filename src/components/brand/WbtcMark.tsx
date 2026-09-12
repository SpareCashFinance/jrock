"use client";

import { TokenBTC } from "@web3icons/react";

export function WbtcMark({
  size = 16,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return <TokenBTC variant="branded" size={size} className={className} />;
}
