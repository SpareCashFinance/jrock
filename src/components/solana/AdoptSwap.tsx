"use client";

import { useEffect, useMemo, useState } from "react";
import NumberFlow from "@number-flow/react";
import { LiquidSurface } from "@/components/brand/LiquidSurface";
import { BorderBeam } from "@/components/ui/border-beam";
import { Card } from "@/components/ui/card";
import { SpringButton } from "@/components/ui/spring-button";
import { hasMint, project } from "@/lib/config";
import { formatAmount } from "@/lib/format";
import { explorerTxUrl } from "@/lib/links";
import { WSOL_MINT } from "@/lib/solana";
import {
  SOL_TOKEN,
  adoptOutputToken,
  defaultPayAmount,
  formatPreset,
  fromRawAmount,
  payPresets,
  toRawAmount,
  type SwapToken,
} from "@/lib/swap-tokens";
import { readTokenBalance } from "@/lib/token-balance";
import { useSolanaWallet } from "./SolanaWalletProvider";
import { AdoptButton, WalletControls } from "./AdoptButton";
import { TokenSelect } from "./TokenSelect";

const SLIPPAGE_BPS = 150;

type Quote = {
  outAmount?: string;
  minOutAmount?: string;
  engine?: "ultra" | "lite";
  error?: string;
  forAmount?: string;
  forMint?: string;
};

function swapErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Swap failed";
  if (/expired|block height|blockhash/i.test(message)) {
    return "That quote went stale before it landed. Tap Adopt again for a fresh one.";
  }
  return message;
}

export function AdoptSwap({ embedded = false }: { embedded?: boolean }) {
  const solana = useSolanaWallet();
  const output = adoptOutputToken();
  const [payToken, setPayToken] = useState<SwapToken>(SOL_TOKEN);
  const [amount, setAmount] = useState(defaultPayAmount(SOL_TOKEN));
  const [balance, setBalance] = useState(0);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState("");
  const [signature, setSignature] = useState("");
  const [received, setReceived] = useState<number | null>(null);

  const amountRaw = useMemo(() => toRawAmount(amount, payToken.decimals), [amount, payToken.decimals]);

  useEffect(() => {
    const mint = payToken.mint;
    const ac = new AbortController();
    void fetch(`/api/trade/jupiter/tokens?q=${encodeURIComponent(mint)}`, { signal: ac.signal })
      .then((res) => res.json() as Promise<{ tokens?: SwapToken[] }>)
      .then((data) => {
        const match = (data.tokens ?? []).find((token) => token.mint === mint);
        if (!match) return;
        setPayToken((prev) =>
          prev.mint !== mint
            ? prev
            : { ...prev, ...match, icon: match.icon || prev.icon },
        );
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
      });
    return () => ac.abort();
  }, [payToken.mint]);

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
    if (!amountRaw || payToken.mint === output.mint) return;
    const requested = amountRaw;
    const inputMint = payToken.mint;
    const handle = window.setTimeout(() => {
      setQuoting(true);
      void fetch("/api/trade/jupiter/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          inputMint,
          outputMint: output.mint,
          amount: requested,
          slippageBps: SLIPPAGE_BPS,
        }),
      })
        .then((res) => res.json() as Promise<Quote>)
        .then((data) =>
          setQuote(
            data.outAmount
              ? { ...data, forAmount: requested, forMint: inputMint }
              : { error: data.error || "No route yet", forAmount: requested, forMint: inputMint },
          ),
        )
        .catch(() => setQuote({ error: "Quote unavailable", forAmount: requested, forMint: inputMint }))
        .finally(() => setQuoting(false));
    }, 280);
    return () => window.clearTimeout(handle);
  }, [amountRaw, output.mint, payToken.mint]);

  const liveQuote =
    amountRaw && quote?.forAmount === amountRaw && quote.forMint === payToken.mint ? quote : null;
  const outTokens = fromRawAmount(liveQuote?.outAmount, output.decimals);
  const minTokens = fromRawAmount(liveQuote?.minOutAmount || liveQuote?.outAmount, output.decimals);
  const payIn = Number(amount || 0);
  const rate = outTokens != null && payIn > 0 ? outTokens / payIn : null;
  const displayBal = solana.address ? balance : 0;
  const outputIsJrock = hasMint();

  function choosePayToken(token: SwapToken) {
    setPayToken(token);
    setAmount(defaultPayAmount(token));
    setQuote(null);
    setError("");
    setSignature("");
    setReceived(null);
  }

  async function swap() {
    setError("");
    setSignature("");
    setReceived(null);
    const owner = solana.requireWallet();
    if (!owner) return;
    if (!amountRaw) {
      setError(`Enter an amount of ${payToken.symbol}.`);
      return;
    }
    if (payToken.mint === output.mint) {
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
          outputMint: output.mint,
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
        setReceived(fromRawAmount(exec.outAmount || plan.outAmount || liveQuote?.outAmount, output.decimals));
      } else {
        const sig = await solana.sendSignedBase64(signed);
        setSignature(sig);
        setReceived(fromRawAmount(plan.outAmount || liveQuote?.outAmount, output.decimals));
      }
      setPhase("");
    } catch (e) {
      setPhase("");
      setError(swapErrorMessage(e));
    }
  }

  const receiveLabel =
    outTokens != null
      ? `Adopt ${outTokens.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${output.symbol}`
      : quoting
        ? "Quoting…"
        : `Adopt with ${amount || "0"} ${payToken.symbol}`;

  const card = (
    <LiquidSurface intensity="panel" radius={24} className="h-full">
      <Card className="relative h-full overflow-hidden border-[rgba(232,210,176,0.14)] bg-[#0c1320]/70 p-4 sm:p-5">
        <BorderBeam colorFrom="#f7931a" colorTo="#d4b46a" size={80} duration={8} />
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="kicker">Jupiter desk</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-white">Adopt $JROCK</h2>
          </div>
          {solana.connected ? (
            <WalletControls compact className="justify-end" />
          ) : (
            <p className="text-[11px] text-[var(--dim)]">
              {payToken.symbol} → {output.symbol}
            </p>
          )}
        </div>

        <div className="mt-4 space-y-2">
          <label className="block rounded-xl border border-[rgba(232,210,176,0.14)] bg-[#060a12] px-3 py-2.5">
            <span className="kicker">You pay</span>
            <div className="mt-1 flex items-center justify-between gap-3">
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                className="w-full bg-transparent font-mono text-2xl text-white outline-none"
                placeholder={defaultPayAmount(payToken)}
              />
              <TokenSelect value={payToken} excludeMint={output.mint} onChange={choosePayToken} />
            </div>
          </label>

          <label className="block rounded-xl border border-[rgba(247,147,26,0.28)] bg-[#0a1008] px-3 py-2.5">
            <span className="kicker">You receive</span>
            <div className="mt-1 flex items-center justify-between gap-3">
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
              <span className="shrink-0 text-xs font-semibold text-[var(--orange)]">{output.symbol}</span>
            </div>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {payPresets(payToken).map((value) => (
            <button key={value} type="button" className="chip" onClick={() => setAmount(String(value))}>
              {formatPreset(value, payToken)}
            </button>
          ))}
          {displayBal > 0 ? (
            <button
              type="button"
              className="chip"
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
            ? `Balance ${formatAmount(displayBal, displayBal >= 100 ? 2 : 4) ?? "0"} ${payToken.symbol} · min ${minTokens != null ? formatAmount(minTokens, 2) : "—"} ${output.symbol} · 1.5% slip`
            : `Quote before you sign · min ${minTokens != null ? formatAmount(minTokens, 2) : "—"} · 1.5% slip`}
          {rate != null ? ` · 1 ${payToken.symbol} ≈ ${formatAmount(rate, rate >= 1000 ? 0 : 2)}` : ""}
          {` · ${liveQuote?.engine === "ultra" ? "Jupiter Ultra · Pad referral" : liveQuote?.engine === "lite" ? "Jupiter lite" : "Jupiter"}`}
        </p>
        {!outputIsJrock ? (
          <p className="mt-1 text-[11px] leading-4 text-[var(--gold)]">
            Desk is live. Output is USDC until the $JROCK mint is published.
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
        {signature ? (
          <div className="mt-3 space-y-1">
            {received != null ? (
              <p className="text-sm text-white">
                You received{" "}
                <span className="font-mono text-[var(--orange)]">
                  {formatAmount(received, received >= 1000 ? 2 : 4)} {output.symbol}
                </span>
              </p>
            ) : null}
            <a className="inline-block text-sm text-[var(--orange)]" href={explorerTxUrl(signature)}>
              Swap landed · view on Explorer
            </a>
          </div>
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
