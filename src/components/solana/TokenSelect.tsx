"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PINNED_PAY_TOKENS, type SwapToken } from "@/lib/swap-tokens";

function TokenIcon({ token, size = 20 }: { token: SwapToken; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!token.icon || failed) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#1a1f2b] text-[10px] font-semibold text-[var(--gold)]"
        style={{ width: size, height: size }}
      >
        {token.symbol.slice(0, 1)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={token.icon}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-full"
      onError={() => setFailed(true)}
    />
  );
}

export function TokenSelect({
  value,
  excludeMint,
  onChange,
}: {
  value: SwapToken;
  excludeMint?: string;
  onChange: (token: SwapToken) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SwapToken[]>([...PINNED_PAY_TOKENS]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const requested = query.trim();
    const ac = new AbortController();
    const handle = window.setTimeout(() => {
      setLoading(true);
      void fetch(`/api/trade/jupiter/tokens?q=${encodeURIComponent(requested)}`, {
        signal: ac.signal,
      })
        .then((res) => res.json() as Promise<{ tokens?: SwapToken[] }>)
        .then((data) => {
          const tokens = (data.tokens ?? []).filter((token) => token.mint !== excludeMint);
          setResults(
            tokens.length ? tokens : PINNED_PAY_TOKENS.filter((token) => token.mint !== excludeMint),
          );
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
        })
        .finally(() => setLoading(false));
    }, requested ? 220 : 0);
    return () => {
      window.clearTimeout(handle);
      ac.abort();
    };
  }, [excludeMint, open, query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const id = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(id);
  }, [open]);

  const shown = useMemo(() => {
    const filtered = results.filter((token) => token.mint !== excludeMint);
    if (query.trim()) return filtered;
    const pinned = PINNED_PAY_TOKENS.filter((token) => token.mint !== excludeMint);
    const rest = filtered.filter((token) => !pinned.some((item) => item.mint === token.mint));
    return [...pinned, ...rest];
  }, [excludeMint, query, results]);

  function pick(token: SwapToken) {
    onChange(token);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[rgba(232,210,176,0.18)] bg-[#141c2c] px-2 py-1 text-xs font-semibold text-[var(--gold)] hover:border-[rgba(247,147,26,0.45)] hover:text-white"
      >
        <TokenIcon key={value.mint} token={value} size={16} />
        {value.symbol}
        <ChevronDown className="size-3 opacity-70" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-[rgba(232,210,176,0.16)] bg-[#0c1320] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Pay with</DialogTitle>
            <DialogDescription>
              Search Jupiter for any Solana mint, ticker, or name.
            </DialogDescription>
          </DialogHeader>

          <label className="flex items-center gap-2 rounded-xl border border-[rgba(232,210,176,0.14)] bg-[#060a12] px-3 py-2">
            <Search className="size-4 text-[var(--dim)]" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="USDC, BONK, or paste a mint"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[var(--stone)]"
            />
          </label>

          <div className="flex flex-wrap gap-1.5">
            {PINNED_PAY_TOKENS.filter((token) => token.mint !== excludeMint).map((token) => (
              <button
                key={token.mint}
                type="button"
                className="chip"
                onClick={() => pick(token)}
              >
                {token.symbol}
              </button>
            ))}
          </div>

          <div className="max-h-64 overflow-y-auto">
            {loading && !shown.length ? (
              <p className="px-2 py-6 text-center text-sm text-[var(--dim)]">Searching Jupiter…</p>
            ) : shown.length ? (
              shown.map((token) => {
                const active = token.mint === value.mint;
                return (
                  <button
                    key={token.mint}
                    type="button"
                    onClick={() => pick(token)}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/5"
                  >
                    <TokenIcon key={token.mint} token={token} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-white">
                        {token.symbol}
                        {token.verified ? (
                          <span className="ml-1.5 text-[10px] font-semibold text-[var(--gold)]">VRFD</span>
                        ) : null}
                      </span>
                      <span className="block truncate text-[11px] text-[var(--dim)]">{token.name}</span>
                    </span>
                    {active ? <Check className="size-4 text-[var(--orange)]" /> : null}
                  </button>
                );
              })
            ) : (
              <p className="px-2 py-6 text-center text-sm text-[var(--dim)]">No Jupiter match.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
