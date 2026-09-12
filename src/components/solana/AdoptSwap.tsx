"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import NumberFlow from "@number-flow/react";
import { ArrowDownUp } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";
import { LiquidSurface } from "@/components/brand/LiquidSurface";
import { Card } from "@/components/ui/card";
import { SpringButton } from "@/components/ui/spring-button";
import { hasMint, project } from "@/lib/config";
import { formatAmount } from "@/lib/format";
import { WSOL_MINT } from "@/lib/solana";
import {
  PINNED_PAY_TOKENS,
  SOL_TOKEN,
  adoptOutputToken,
  defaultPayAmount,
  formatPreset,
  fromRawAmount,
  payPresets,
  pinnedReceiveTokens,
  toRawAmount,
  type SwapToken,
} from "@/lib/swap-tokens";
import { readTokenBalance } from "@/lib/token-balance";
import { useSolanaWallet } from "./SolanaWalletProvider";
import { AdoptButton, WalletControls } from "./AdoptButton";
import { SwapToast } from "./SwapToast";
import { TokenSelect } from "./TokenSelect";

const SLIPPAGE_BPS = 150;

type Quote = {
  outAmount?: string;
  minOutAmount?: string;
  engine?: "ultra" | "lite";
  error?: string;
  forAmount?: string;
  forMint?: string;
  forOutMint?: string;
};

function swapErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Swap failed";
  if (/expired|block height|blockhash/i.test(message)) {
    return "That quote went stale before it landed. Tap Adopt again for a fresh one.";
  }
  return message;
}

function useEnrichedToken(token: SwapToken, setToken: (next: SwapToken) => void) {
  useEffect(() => {
    const mint = token.mint;
    const ac = new AbortController();
    void fetch(`/api/trade/jupiter/tokens?q=${encodeURIComponent(mint)}`, { signal: ac.signal })
      .then((res) => res.json() as Promise<{ tokens?: SwapToken[] }>)
      .then((data) => {
        const match = (data.tokens ?? []).find((item) => item.mint === mint);
        if (!match) return;
        setToken({ ...token, ...match, icon: match.icon || token.icon });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
      });
    return () => ac.abort();
    // Enrich once per mint, not on every token object change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token.mint]);
}

export function AdoptSwap({ embedded = false }: { embedded?: boolean }) {
  const solana = useSolanaWallet();
  const [payToken, setPayToken] = useState<SwapToken>(SOL_TOKEN);
  const [receiveToken, setReceiveToken] = useState<SwapToken>(adoptOutputToken);
  const [amount, setAmount] = useState(defaultPayAmount(SOL_TOKEN));
  const [balance, setBalance] = useState(0);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState("");
  const [signature, setSignature] = useState("");
  const [received, setReceived] = useState<number | null>(null);
  const [toastOpen, setToastOpen] = useState(false);

  const amountRaw = useMemo(() => toRawAmount(amount, payToken.decimals), [amount, payToken.decimals]);
  const receivePins = useMemo(() => pinnedReceiveTokens(), []);

  useEnrichedToken(payToken, (next) => {
    setPayToken((prev) => (prev.mint === next.mint ? { ...prev, ...next, icon: next.icon || prev.icon } : prev));
  });
  useEnrichedToken(receiveToken, (next) => {
    setReceiveToken((prev) =>
      prev.mint === next.mint ? { ...prev, ...next, icon: next.icon || prev.icon } : prev,
    );
  });

  useEffect(() => {
    if (!solana.address) {
      setBalance(0);
      return;
    }
    let cancelled = false;
    void readTokenBalance(solana.connection, solana.address, payToken.mint)
      .then((value) => {
        if (!cancelled) setBalance(value ?? 0);
      })
      .catch(() => {
        if (!cancelled) setBalance(0);
      });
    return () => {
      cancelled = true;
    };
  }, [payToken.mint, solana.address, solana.connection]);

  useEffect(() => {
    if (!amountRaw || payToken.mint === receiveToken.mint) return;
    const requested = amountRaw;
    const inputMint = payToken.mint;
    const outputMint = receiveToken.mint;
    const handle = window.setTimeout(() => {
      setQuoting(true);
      void fetch("/api/trade/jupiter/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          inputMint,
          outputMint,
          amount: requested,
          slippageBps: SLIPPAGE_BPS,
        }),
      })
        .then((res) => res.json() as Promise<Quote>)
        .then((data) =>
          setQuote(
            data.outAmount
              ? { ...data, forAmount: requested, forMint: inputMint, forOutMint: outputMint }
              : { error: data.error || "No route yet", forAmount: requested, forMint: inputMint, forOutMint: outputMint },
          ),
        )
        .catch(() =>
          setQuote({ error: "Quote unavailable", forAmount: requested, forMint: inputMint, forOutMint: outputMint }),
        )
        .finally(() => setQuoting(false));
    }, 280);
    return () => window.clearTimeout(handle);
  }, [amountRaw, payToken.mint, receiveToken.mint]);

  const liveQuote =
    amountRaw &&
    quote?.forAmount === amountRaw &&
    quote.forMint === payToken.mint &&
    quote.forOutMint === receiveToken.mint
      ? quote
      : null;
  const outTokens = fromRawAmount(liveQuote?.outAmount, receiveToken.decimals);
  const minTokens = fromRawAmount(liveQuote?.minOutAmount || liveQuote?.outAmount, receiveToken.decimals);
  const payIn = Number(amount || 0);
  const rate = outTokens != null && payIn > 0 ? outTokens / payIn : null;
  const displayBal = solana.address ? balance : 0;
  const outputIsJrock = hasMint() && receiveToken.mint === project.mint;

  function resetTrade() {
    setQuote(null);
    setError("");
    setSignature("");
    setReceived(null);
    setToastOpen(false);
  }

  function choosePayToken(token: SwapToken) {
    if (token.mint === receiveToken.mint) {
      setReceiveToken(payToken);
    }
    setPayToken(token);
    setAmount(defaultPayAmount(token));
    resetTrade();
  }

  function chooseReceiveToken(token: SwapToken) {
    if (token.mint === payToken.mint) {
      setPayToken(receiveToken);
      setAmount(defaultPayAmount(receiveToken));
    }
    setReceiveToken(token);
    resetTrade();
  }

  function flipLegs() {
    const nextPay = receiveToken;
    const nextReceive = payToken;
    setPayToken(nextPay);
    setReceiveToken(nextReceive);
    setAmount(defaultPayAmount(nextPay));
    resetTrade();
  }

  const dismissToast = useCallback(() => setToastOpen(false), []);

  async function swap() {
    setError("");
    setSignature("");
    setReceived(null);
    setToastOpen(false);
    const owner = solana.requireWallet();
    if (!owner) return;
    if (!amountRaw) {
      setError(`Enter an amount of ${payToken.symbol}.`);
      return;
    }
    if (payToken.mint === receiveToken.mint) {
      setError("Pick a different asset to pay with.");
      return;
    }
    try {
      setPhase("Building a fresh Jupiter swap…");
      const hop = await fetch("/api/trade/jupiter/prepare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          owner,
          inputMint: payToken.mint,
          outputMint: receiveToken.mint,
          amount: amountRaw,
          slippageBps: SLIPPAGE_BPS,
        }),
      });
      const plan = (await hop.json()) as {
        tx?: string;
        requestId?: string;
        execute?: boolean;
        outAmount?: string;
        lastValidBlockHeight?: string;
        error?: string;
      };
      if (!hop.ok || !plan.tx) throw new Error(plan.error ?? "Jupiter prepare failed");
      setPhase("Approve in your wallet…");
      const signed = await solana.signBase64(plan.tx);
      setPhase("Landing the swap…");
      if (plan.execute && plan.requestId) {
        const landed = await fetch("/api/trade/jupiter/execute", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            signedTransaction: signed,
            requestId: plan.requestId,
            lastValidBlockHeight: plan.lastValidBlockHeight,
          }),
        });
        const exec = (await landed.json()) as { signature?: string; outAmount?: string; error?: string };
        if (!landed.ok) throw new Error(exec.error ?? "Jupiter execute failed");
        setSignature(exec.signature || "");
        setReceived(fromRawAmount(exec.outAmount || plan.outAmount || liveQuote?.outAmount, receiveToken.decimals));
      } else {
        const sig = await solana.sendSignedBase64(signed);
        setSignature(sig);
        setReceived(fromRawAmount(plan.outAmount || liveQuote?.outAmount, receiveToken.decimals));
      }
      setPhase("");
      setToastOpen(true);
    } catch (e) {
      setPhase("");
      setError(swapErrorMessage(e));
    }
  }

  const receiveLabel =
    outTokens != null
      ? `Adopt ${outTokens.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${receiveToken.symbol}`
      : quoting
        ? "Quoting…"
        : `Adopt with ${amount || "0"} ${payToken.symbol}`;

  const card = (
    <LiquidSurface intensity="panel" radius={28} className="desk h-full">
      <Card className="relative h-full overflow-hidden border-white/8 bg-[#0c1320]/45 p-4 sm:p-5 backdrop-blur-2xl">
        <div className="pointer-events-none absolute -top-16 -right-10 size-40 rounded-full bg-[radial-gradient(circle,rgba(247,147,26,0.16),transparent_68%)]" />
        <div className="pointer-events-none absolute -bottom-20 -left-8 size-44 rounded-full bg-[radial-gradient(circle,rgba(102,249,237,0.08),transparent_70%)]" />

        <div className="relative flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark
              size={40}
              className="shrink-0 border border-[rgba(247,147,26,0.35)] sm:h-11 sm:w-11"
            />
            <div className="min-w-0">
              <p className="kicker">Jupiter desk</p>
              <h2 className="display mt-1.5 text-[2rem] leading-none text-white sm:text-[2.35rem]">
                Adopt <span className="text-[var(--orange)]">$JROCK</span>
              </h2>
            </div>
          </div>
          {solana.connected ? <WalletControls compact className="justify-end pt-1" /> : null}
        </div>

        <div className="relative mt-5 space-y-2">
          <div className="desk-field rounded-2xl px-3 py-3">
            <div className="flex items-center justify-between">
              <p className="kicker">You pay</p>
              {solana.connected ? (
                <p className="text-[11px] text-[var(--dim)]">
                  {formatAmount(displayBal, displayBal >= 100 ? 2 : 4) ?? "0"} {payToken.symbol}
                </p>
              ) : null}
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                className="w-full bg-transparent font-mono text-2xl text-white outline-none"
                placeholder={defaultPayAmount(payToken)}
              />
              <TokenSelect
                title="Pay with"
                value={payToken}
                excludeMint={receiveToken.mint}
                pinned={PINNED_PAY_TOKENS}
                onChange={choosePayToken}
              />
            </div>
          </div>

          <div className="relative z-10 -my-3 flex justify-center">
            <button
              type="button"
              onClick={flipLegs}
              aria-label="Flip pay and receive"
              className="inline-flex size-9 items-center justify-center rounded-full border border-white/12 bg-[#0c1320]/80 text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)] backdrop-blur-xl hover:bg-white/10"
            >
              <ArrowDownUp className="size-4" />
            </button>
          </div>

          <div className="desk-field rounded-2xl px-3 py-3">
            <p className="kicker">You receive</p>
            <div className="mt-1.5 flex items-center justify-between gap-3">
              <p className="min-w-0 font-mono text-2xl text-white">
                {outTokens != null ? (
                  <NumberFlow
                    value={outTokens}
                    format={{ maximumFractionDigits: outTokens >= 1000 ? 2 : 4 }}
                  />
                ) : quoting ? (
                  <span className="text-[var(--stone)]">Quoting…</span>
                ) : (
                  <span className="text-[var(--stone)]">—</span>
                )}
              </p>
              <TokenSelect
                title="Receive"
                value={receiveToken}
                excludeMint={payToken.mint}
                pinned={receivePins}
                onChange={chooseReceiveToken}
              />
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {payPresets(payToken).map((value) => (
            <button
              key={value}
              type="button"
              className="rounded-full border border-white/8 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/80 hover:bg-white/10"
              onClick={() => setAmount(String(value))}
            >
              {formatPreset(value, payToken)}
            </button>
          ))}
          {displayBal > 0 ? (
            <button
              type="button"
              className="rounded-full border border-white/8 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/80 hover:bg-white/10"
              onClick={() =>
                setAmount(
                  Math.max(0, payToken.mint === WSOL_MINT ? displayBal - 0.02 : displayBal).toFixed(
                    payToken.decimals > 4 ? 3 : 2,
                  ),
                )
              }
            >
              Max
            </button>
          ) : null}
        </div>

        <p className="mt-2 text-[11px] leading-4 text-[var(--dim)]">
          {solana.connected
            ? `min ${minTokens != null ? formatAmount(minTokens, 2) : "—"} ${receiveToken.symbol} · 1.5% slip`
            : `Quote before you sign · min ${minTokens != null ? formatAmount(minTokens, 2) : "—"} · 1.5% slip`}
          {rate != null ? ` · 1 ${payToken.symbol} ≈ ${formatAmount(rate, rate >= 1000 ? 0 : 2)}` : ""}
          {` · ${liveQuote?.engine === "ultra" ? "Jupiter Ultra" : liveQuote?.engine === "lite" ? "Jupiter lite" : "Jupiter"}`}
        </p>
        {!outputIsJrock && !hasMint() ? (
          <p className="mt-1 text-[11px] leading-4 text-[var(--gold)]">
            Desk is live. $JROCK will lock in as the receive asset once the mint is published.
          </p>
        ) : null}

        {solana.connected ? (
          <SpringButton
            type="button"
            className="btn-primary mt-3 w-full"
            disabled={!amountRaw || Boolean(phase) || outTokens == null}
            onClick={() => void swap()}
          >
            {phase || receiveLabel}
          </SpringButton>
        ) : (
          <AdoptButton shine className="mt-3 w-full" idleLabel="Connect wallet to adopt" />
        )}

        {error ? <p className="mt-3 text-sm text-[#ff8a6a]">{error}</p> : null}
        {liveQuote?.error ? <p className="mt-3 text-sm text-[var(--dim)]">{liveQuote.error}</p> : null}

        {toastOpen && signature ? (
          <SwapToast
            signature={signature}
            received={received}
            symbol={receiveToken.symbol}
            onDismiss={dismissToast}
          />
        ) : null}
      </Card>
    </LiquidSurface>
  );

  if (embedded) return card;

  return (
    <section id="adopt" className="section py-6">
      <div className="mx-auto max-w-[440px]">{card}</div>
    </section>
  );
}
