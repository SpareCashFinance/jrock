"use client";

import { useSyncExternalStore } from "react";
import { NetworkSolana } from "@web3icons/react";
import { useSolanaWallet } from "./SolanaWalletProvider";
import { shortenAddress } from "@/lib/format";
import { HouseButton } from "@/components/ui/house-button";
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
  compact = false,
}: {
  className?: string;
  connectedLabel?: string;
  idleLabel?: string;
  shine?: boolean;
  compact?: boolean;
}) {
  const { connected, connecting, openModal } = useSolanaWallet();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const liveConnected = mounted && connected;
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
      return;
    }
    scrollToAdopt();
  }

  return (
    <HouseButton
      variant={liveConnected ? "primary" : "ghost"}
      className={cn(
        liveConnected ? "" : "btn-connect",
        shine ? "h-11 px-5" : "min-h-9 px-2.5 text-xs sm:px-3",
        className,
      )}
      onClick={onClick}
    >
      {liveConnected ? <NetworkSolana variant="branded" size={16} /> : null}
      {compact ? (
        <>
          <span className="sm:hidden">{connected ? "Adopt" : connecting ? "…" : "Connect"}</span>
          <span className="hidden sm:inline">{label}</span>
        </>
      ) : (
        label
      )}
    </HouseButton>
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
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <SpringButton type="button" className="btn-ghost px-3 text-xs" onClick={openModal}>
        <NetworkSolana variant="branded" size={14} />
        <span className="font-mono">{shortenAddress(address || "")}</span>
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
