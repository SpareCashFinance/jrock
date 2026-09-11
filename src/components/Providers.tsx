"use client";

import { TooltipProvider } from "@/components/ui/tooltip";
import { SolanaWalletProvider } from "@/components/solana/SolanaWalletProvider";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      <SolanaWalletProvider>{children}</SolanaWalletProvider>
    </TooltipProvider>
  );
}
