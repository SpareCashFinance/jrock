"use client";

import { useSyncExternalStore } from "react";
import { NetworkSolana } from "@web3icons/react";
import { useSolanaWallet } from "./SolanaWalletProvider";
import { shortenAddress } from "@/lib/format";

export function scrollToAdopt() {
  document.getElementById("adopt")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function AdoptButton({
  className = "btn btn-primary",
  connectedLabel = "Adopt $JROCK",
  idleLabel = "Connect wallet",
}: {
  className?: string;
  connectedLabel?: string;
  idleLabel?: string;
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

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (!connected) {
          openModal();
          window.setTimeout(scrollToAdopt, 250);
          return;
        }
        scrollToAdopt();
      }}
    >
      <NetworkSolana variant="branded" size={16} />
      {label}
    </button>
  );
}

export function WalletChip({ className = "btn btn-ghost min-h-11 px-4 text-[11px]" }: { className?: string }) {
  const { address, connected, connecting, openModal, disconnect } = useSolanaWallet();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const label = !mounted
    ? "Connect"
    : connecting
      ? "…"
      : connected && address
        ? shortenAddress(address)
        : "Connect";

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        if (connected) {
          void disconnect();
          return;
        }
        openModal();
      }}
    >
      <NetworkSolana variant="branded" size={14} />
      {label}
    </button>
  );
}
