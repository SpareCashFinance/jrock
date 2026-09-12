"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { SolscanMark } from "@/components/brand/SolscanMark";
import { formatAmount, shortenAddress } from "@/lib/format";
import { explorerTxUrl } from "@/lib/links";

export function SwapToast({
  signature,
  received,
  symbol,
  onDismiss,
}: {
  signature: string;
  received: number | null;
  symbol: string;
  onDismiss: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const id = window.setTimeout(onDismiss, 12_000);
    return () => window.clearTimeout(id);
  }, [onDismiss, signature]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      <motion.aside
        key={signature}
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        className="desk-sheet fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[80] w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-white/10 bg-[#0c1320]/72 p-3.5 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex size-8 items-center justify-center rounded-full bg-emerald-400/15 text-sm text-emerald-300">
            ✓
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white">Swap landed</p>
            {received != null ? (
              <p className="mt-0.5 font-mono text-sm text-[var(--cream)]">
                +{formatAmount(received, received >= 1000 ? 2 : 4)} {symbol}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-[var(--dim)]">Confirmed on Solana</p>
            )}
            <a
              href={explorerTxUrl(signature)}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-white/90 hover:bg-white/10"
            >
              <SolscanMark size={16} />
              Solscan
              <span className="font-mono text-[var(--dim)]">{shortenAddress(signature, 4)}</span>
            </a>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-full p-1 text-[var(--dim)] hover:bg-white/8 hover:text-white"
            aria-label="Dismiss"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </motion.aside>
    </AnimatePresence>,
    document.body,
  );
}
