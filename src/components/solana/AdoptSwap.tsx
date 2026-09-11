"use client";

import { useEffect, useMemo, useState } from "react";
import NumberFlow from "@number-flow/react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { NetworkSolana } from "@web3icons/react";
import { LiquidSurface } from "@/components/brand/LiquidSurface";
import { BorderBeam } from "@/components/ui/border-beam";
import { Card } from "@/components/ui/card";
import { SpringButton } from "@/components/ui/spring-button";
import { hasMint, project } from "@/lib/config";
import { formatAmount } from "@/lib/format";
import { WSOL_MINT } from "@/lib/solana";
import { explorerTxUrl } from "@/lib/links";
import { useSolanaWallet } from "./SolanaWalletProvider";
import { AdoptButton, WalletControls } from "./AdoptButton";

const PRESETS = [0.1, 0.25, 0.5, 1];
const TOKEN_DECIMALS = Number(process.env.NEXT_PUBLIC_JROCK_DECIMALS || 6);
const SLIPPAGE_BPS = 150;

type Quote = {
  outAmount?: string;
  minOutAmount?: string;
  quoteResponse?: Record<string, unknown>;
  error?: string;
  forAmount?: string;
};

function toTokens(raw?: string) {
  if (!raw) return null;
  const n = Number(raw) / 10 ** TOKEN_DECIMALS;
  return Number.isFinite(n) ? n : null;
}

export function AdoptSwap({ embedded = false }: { embedded?: boolean }) {
  const solana = useSolanaWallet();
  const [amount, setAmount] = useState("0.25");
  const [solBal, setSolBal] = useState(0);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState("");
  const [signature, setSignature] = useState("");
  const [received, setReceived] = useState<number | null>(null);

  const amountRaw = useMemo(() => {
    const n = Number(amount || 0);
    if (!Number.isFinite(n) || n <= 0) return "";
    return String(Math.round(n * LAMPORTS_PER_SOL));
  }, [amount]);

  useEffect(() => {
    if (!solana.address) return;
    let cancelled = false;
    void solana.connection
      .getBalance(new PublicKey(solana.address))
      .then((lamports) => {
        if (!cancelled) setSolBal(lamports / LAMPORTS_PER_SOL);
      })
      .catch(() => {
        if (!cancelled) setSolBal(0);
      });
    return () => {
      cancelled = true;
    };
  }, [solana.address, solana.connection]);

  useEffect(() => {
    if (!hasMint() || !amountRaw) return;
    const requested = amountRaw;
    const handle = window.setTimeout(() => {
      setQuoting(true);
      void fetch("/api/trade/jupiter/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          inputMint: WSOL_MINT,
          outputMint: project.mint,
          amount: requested,
          slippageBps: SLIPPAGE_BPS,
        }),
      })
        .then((res) => res.json() as Promise<Quote>)
        .then((data) =>
          setQuote(
            data.outAmount
              ? { ...data, forAmount: requested }
              : { error: data.error || "No route yet", forAmount: requested },
          ),
        )
        .catch(() => setQuote({ error: "Quote unavailable", forAmount: requested }))
        .finally(() => setQuoting(false));
    }, 280);
    return () => window.clearTimeout(handle);
  }, [amountRaw]);

  const liveQuote = hasMint() && amountRaw && quote?.forAmount === amountRaw ? quote : null;
  const outTokens = toTokens(liveQuote?.outAmount);
  const minTokens = toTokens(liveQuote?.minOutAmount || liveQuote?.outAmount);
  const solIn = Number(amount || 0);
  const rate = outTokens != null && solIn > 0 ? outTokens / solIn : null;
  const displayBal = solana.address ? solBal : 0;

  async function swap() {
    setError("");
    setSignature("");
    setReceived(null);
    const owner = solana.requireWallet();
    if (!owner) return;
    if (!hasMint()) {
      setError("The $JROCK mint is not published yet.");
      return;
    }
    if (!amountRaw) {
      setError("Enter an amount of SOL.");
      return;
    }
    try {
      setPhase("Building the Jupiter swap…");
      const hop = await fetch("/api/trade/jupiter/prepare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          owner,
          inputMint: WSOL_MINT,
          outputMint: project.mint,
          amount: amountRaw,
          slippageBps: SLIPPAGE_BPS,
          quoteResponse: liveQuote?.quoteResponse,
        }),
      });
      const plan = (await hop.json()) as {
        tx?: string;
        requestId?: string;
        execute?: boolean;
        outAmount?: string;
        error?: string;
      };
      if (!hop.ok || !plan.tx) throw new Error(plan.error ?? "Jupiter prepare failed");
      setPhase("Sign in your wallet…");
      if (plan.execute && plan.requestId) {
        const signed = await solana.signBase64(plan.tx);
        const landed = await fetch("/api/trade/jupiter/execute", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ signedTransaction: signed, requestId: plan.requestId }),
        });
        const exec = (await landed.json()) as { signature?: string; outAmount?: string; error?: string };
        if (!landed.ok) throw new Error(exec.error ?? "Jupiter execute failed");
        setSignature(exec.signature || "");
        setReceived(toTokens(exec.outAmount || plan.outAmount || liveQuote?.outAmount));
      } else {
        const sig = await solana.signAndSendBase64(plan.tx);
        setSignature(sig);
        setReceived(toTokens(plan.outAmount || liveQuote?.outAmount));
      }
      setPhase("");
    } catch (e) {
      setPhase("");
      setError(e instanceof Error ? e.message : "Swap failed");
    }
  }

  const receiveLabel =
    outTokens != null
      ? `Adopt ${outTokens.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${project.ticker}`
      : quoting
        ? "Quoting…"
        : `Adopt with ${amount || "0"} SOL`;

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
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--dim)]">
              <NetworkSolana variant="branded" size={14} />
              SOL → {project.ticker}
            </div>
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
                placeholder="0.25"
              />
              <span className="shrink-0 text-xs font-semibold text-[var(--gold)]">SOL</span>
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
                ) : hasMint() ? (
                  <span className="text-[var(--stone)]">—</span>
                ) : (
                  <span className="text-[var(--stone)]">Mint pending</span>
                )}
              </p>
              <span className="shrink-0 text-xs font-semibold text-[var(--orange)]">{project.ticker}</span>
            </div>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {PRESETS.map((value) => (
            <button key={value} type="button" className="chip" onClick={() => setAmount(String(value))}>
              {value} SOL
            </button>
          ))}
          {displayBal > 0 ? (
            <button
              type="button"
              className="chip"
              onClick={() => setAmount(Math.max(0, displayBal - 0.02).toFixed(3))}
            >
              Max
            </button>
          ) : null}
        </div>

        <p className="mt-2 text-[11px] leading-4 text-[var(--dim)]">
          {solana.connected
            ? `Balance ${displayBal.toFixed(3)} SOL · min ${minTokens != null ? formatAmount(minTokens, 2) : "—"} ${project.ticker} · 1.5% slip`
            : `Quote before you sign · min ${minTokens != null ? formatAmount(minTokens, 2) : "—"} · 1.5% slip`}
          {rate != null ? ` · 1 SOL ≈ ${formatAmount(rate, rate >= 1000 ? 0 : 2)}` : ""}
        </p>

        {solana.connected ? (
          <SpringButton
            type="button"
            className="btn-primary mt-3 w-full"
            disabled={!hasMint() || !amountRaw || Boolean(phase) || outTokens == null}
            onClick={() => void swap()}
          >
            {phase || receiveLabel}
          </SpringButton>
        ) : (
          <AdoptButton
            shine
            className="mt-3 w-full"
            idleLabel="Connect wallet to adopt"
          />
        )}

        {error ? <p className="mt-3 text-sm text-[#ff8a6a]">{error}</p> : null}
        {liveQuote?.error && hasMint() ? (
          <p className="mt-3 text-sm text-[var(--dim)]">{liveQuote.error}</p>
        ) : null}
        {signature ? (
          <div className="mt-3 space-y-1">
            {received != null ? (
              <p className="text-sm text-white">
                You received{" "}
                <span className="font-mono text-[var(--orange)]">
                  {formatAmount(received, received >= 1000 ? 2 : 4)} {project.ticker}
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
