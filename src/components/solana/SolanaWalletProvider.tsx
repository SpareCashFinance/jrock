"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { WalletReadyState, type WalletName } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider, useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { clusterApiUrl, VersionedTransaction } from "@solana/web3.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { decodeTx, encodeTx } from "@/lib/tx";

const SolanaWalletUi = createContext<{ openModal: () => void } | null>(null);

export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);
  const rpc = useMemo(() => {
    if (process.env.NEXT_PUBLIC_SOLANA_RPC_URL) return process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    if (typeof window !== "undefined") return `${window.location.origin}/api/solana/rpc`;
    return clusterApiUrl("mainnet-beta");
  }, []);

  return (
    <ConnectionProvider endpoint={rpc}>
      <WalletProvider wallets={wallets} autoConnect localStorageKey="jrock-solana-wallet">
        <SolanaWalletModalHost>{children}</SolanaWalletModalHost>
      </WalletProvider>
    </ConnectionProvider>
  );
}

function SolanaWalletModalHost({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openModal = useCallback(() => setOpen(true), []);
  const value = useMemo(() => ({ openModal }), [openModal]);
  return (
    <SolanaWalletUi.Provider value={value}>
      {children}
      <SolanaWalletModal open={open} onOpenChange={setOpen} />
    </SolanaWalletUi.Provider>
  );
}

function isPhone() {
  return typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

function browseInWallet(name: string) {
  const href = window.location.href;
  if (name === "Phantom") {
    window.location.assign(
      `https://phantom.app/ul/browse/${encodeURIComponent(href)}?ref=${encodeURIComponent(window.location.origin)}`,
    );
    return;
  }
  if (name === "Solflare") {
    window.location.assign(`https://solflare.com/ul/v1/browse/${encodeURIComponent(href)}`);
  }
}

function SolanaWalletModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { wallets, select, wallet, connected, disconnect, connecting, connect } = useWallet();
  const pending = useRef<WalletName | null>(null);
  const listed = wallets
    .filter((item) => item.readyState !== WalletReadyState.Unsupported)
    .slice()
    .sort((a, b) => rankWallet(a.readyState) - rankWallet(b.readyState));

  useEffect(() => {
    if (!pending.current || !wallet || wallet.adapter.name !== pending.current) return;
    pending.current = null;
    void connect()
      .catch(() => undefined)
      .finally(() => onOpenChange(false));
  }, [wallet, connect, onOpenChange]);

  async function pick(name: WalletName, readyState: WalletReadyState, url: string) {
    if (readyState === WalletReadyState.NotDetected) {
      if (isPhone()) {
        browseInWallet(name);
        return;
      }
      window.open(url, "_blank", "noreferrer");
      return;
    }
    try {
      if (wallet?.adapter.name === name && !connected) {
        await connect();
        onOpenChange(false);
        return;
      }
      pending.current = name;
      select(name);
    } catch {
      /* wallet adapter surfaces its own errors */
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[rgba(232,210,176,0.16)] bg-[#0c1320] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect a Solana wallet</DialogTitle>
          <DialogDescription>
            Adopt $JROCK from the wallet you already use. Installed wallets are listed first.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1">
          {listed.length ? (
            listed.map((item) => {
              const installed =
                item.readyState === WalletReadyState.Installed ||
                item.readyState === WalletReadyState.Loadable;
              const active = wallet?.adapter.name === item.adapter.name && connected;
              return (
                <button
                  key={item.adapter.name}
                  type="button"
                  disabled={connecting}
                  onClick={() => void pick(item.adapter.name, item.readyState, item.adapter.url)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/5"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.adapter.icon} alt="" className="h-8 w-8 rounded-lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{item.adapter.name}</span>
                    <span className="block text-[11px] text-[var(--dim)]">
                      {active ? "Connected" : installed ? "Detected" : "Install"}
                    </span>
                  </span>
                </button>
              );
            })
          ) : (
            <p className="px-3 py-4 text-sm text-[var(--dim)]">
              No Solana wallets found. Install Phantom or Solflare, then refresh.
            </p>
          )}
        </div>
        {connected ? (
          <button
            type="button"
            className="btn btn-ghost lh-shine mt-2 w-full"
            onClick={() => {
              void disconnect();
              onOpenChange(false);
            }}
          >
            Disconnect wallet
          </button>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function rankWallet(state: WalletReadyState) {
  if (state === WalletReadyState.Installed) return 0;
  if (state === WalletReadyState.Loadable) return 1;
  return 2;
}

export function useSolanaWallet() {
  const ui = useContext(SolanaWalletUi);
  const { publicKey, connected, connecting, disconnect, sendTransaction, signTransaction, wallet } = useWallet();
  const { connection } = useConnection();
  const openModal = ui?.openModal ?? (() => undefined);
  const address = publicKey?.toBase58() ?? "";

  function requireWallet() {
    if (address) return address;
    openModal();
    return "";
  }

  async function signBase64(b64: string) {
    if (!publicKey || !signTransaction) throw new Error("Connect a Solana wallet first");
    const signed = await signTransaction(decodeTx(b64));
    return encodeTx(signed);
  }

  async function signAndSendBase64(b64: string) {
    if (!publicKey) throw new Error("Connect a Solana wallet first");
    const tx = decodeTx(b64);
    const latest = await connection.getLatestBlockhash("confirmed");
    if (tx instanceof VersionedTransaction) {
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction({ signature, ...latest }, "confirmed");
      return signature;
    }
    tx.feePayer = publicKey;
    tx.recentBlockhash = latest.blockhash;
    tx.lastValidBlockHeight = latest.lastValidBlockHeight;
    const signature = await sendTransaction(tx, connection);
    await connection.confirmTransaction({ signature, ...latest }, "confirmed");
    return signature;
  }

  return {
    address,
    connected,
    connecting,
    walletName: wallet?.adapter.name,
    disconnect,
    openModal,
    requireWallet,
    signBase64,
    signAndSendBase64,
    connection,
  };
}
