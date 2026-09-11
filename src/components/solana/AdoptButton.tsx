"use client";

import { useSyncExternalStore } from "react";
import { NetworkSolana } from "@web3icons/react";
import { useSolanaWallet } from "./SolanaWalletProvider";
import { shortenAddress } from "@/lib/format";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { SpringButton } from "@/components/ui/spring-button";
import { cn } from "@/lib/utils";

export function scrollToAdopt() {
  document.getElementById("adopt")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function AdoptButton({
  className,
  connectedLabel = "Adopt $JROCK",
  idleLabel = "Connect wallet",
  shine = false,
}: {
  className?: string;
  connectedLabel?: string;
  idleLabel?: string;
  shine?: boolean;
}) {
  const { connected, connecting, openModal } = useSolanaWallet();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const label = !mounted
    ? idleLabel
    : connecting
      ? "Connecting…"
      : connected
        ? connectedLabel
        : idleLabel;

  function onClick() {
    if (!connected) {
      openModal();
      window.setTimeout(scrollToAdopt, 250);
      return;
    }
    scrollToAdopt();
  }

  if (shine) {
    return (
      <ShimmerButton
        background="#f7931a"
        shimmerColor="#fff4d6"
        className={cn("h-11 px-5 text-sm font-semibold text-[#1a0f04] shadow-[0_8px_18px_rgba(247,147,26,0.24)]", className)}
        onClick={onClick}
      >
        <span className="relative z-10 inline-flex items-center gap-2">
          <NetworkSolana variant="branded" size={16} />
          {label}
        </span>
      </ShimmerButton>
    );
  }

  return (
    <SpringButton type="button" className={cn("btn-primary", className)} onClick={onClick}>
      <NetworkSolana variant="branded" size={16} />
      {label}
    </SpringButton>
  );
}

export function WalletControls({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { address, connected, connecting, openModal, disconnect } = useSolanaWallet();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  if (!mounted) {
    return compact ? null : (
      <SpringButton type="button" className={cn("btn-ghost px-3 text-xs", className)} disabled>
        <NetworkSolana variant="branded" size={14} />
        Connect wallet
      </SpringButton>
    );
  }

  if (!connected) {
    if (compact) return null;
    return (
      <SpringButton
        type="button"
        className={cn("btn-ghost px-3 text-xs", className)}
        disabled={connecting}
        onClick={openModal}
      >
        <NetworkSolana variant="branded" size={14} />
        {connecting ? "Connecting…" : "Connect wallet"}
      </SpringButton>
    );
  }

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <SpringButton type="button" className="btn-ghost hidden px-3 text-xs sm:inline-flex" onClick={openModal}>
        <NetworkSolana variant="branded" size={14} />
        {shortenAddress(address)}
      </SpringButton>
      <SpringButton type="button" className="btn-ghost px-3 text-xs" onClick={() => void disconnect()}>
        Disconnect
      </SpringButton>
    </div>
  );
}

export function WalletChip({ className }: { className?: string }) {
  return <WalletControls className={className} />;
}
