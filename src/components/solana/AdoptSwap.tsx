"use client";

import { useEffect, useMemo, useState } from "react";
import NumberFlow from "@number-flow/react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { NetworkSolana } from "@web3icons/react";
import { BorderBeam } from "@/components/ui/border-beam";
import { Card } from "@/components/ui/card";
import { hasMint, project } from "@/lib/config";
import { formatAmount } from "@/lib/format";
import { WSOL_MINT } from "@/lib/solana";
import { explorerTxUrl } from "@/lib/links";
import { useSolanaWallet } from "./SolanaWalletProvider";
import { AdoptButton } from "./AdoptButton";

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

export function AdoptSwap() {
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

  return (
    <section id="adopt" className="section pt-6">
      <Card className="relative overflow-hidden border-[rgba(232,210,176,0.14)] bg-[#0c1320]/80 p-6 sm:p-8">
        <BorderBeam colorFrom="#f7931a" colorTo="#d4b46a" size={110} duration={8} />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="kicker">Kennel desk · Jupiter</p>
            <h2 className="display mt-3 text-5xl text-white sm:text-7xl">Adopt $JROCK</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--dim)]">
              Enter SOL and we quote the $JROCK you get before you sign. Same Jupiter
              routing we run on LaunchHouse.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs tracking-[0.16em] uppercase text-[var(--dim)]">
            <NetworkSolana variant="branded" size={16} />
            SOL
            <span className="text-[var(--gold)]">→</span>
            {project.ticker}
          </div>
        </div>

        <div className="mt-8 grid gap-3">
          <label className="block rounded-2xl border border-[rgba(232,210,176,0.16)] bg-[#060a12] p-4">
            <span className="kicker">You pay</span>
            <div className="mt-2 flex items-end justify-between gap-3">
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                className="w-full bg-transparent font-mono text-3xl text-white outline-none sm:text-4xl"
                placeholder="0.25"
              />
              <span className="shrink-0 font-mono text-sm tracking-[0.16em] text-[var(--gold)]">SOL</span>
            </div>
          </label>

          <div className="flex justify-center">
            <span className="grid h-9 w-9 place-items-center rounded-full border border-[rgba(232,210,176,0.16)] bg-[#0c1320] text-[var(--gold)]">
              ↓
            </span>
          </div>

          <div className="rounded-2xl border border-[rgba(247,147,26,0.28)] bg-[#0a1008] p-4">
            <p className="kicker">You receive</p>
            <div className="mt-2 flex items-end justify-between gap-3">
              <p className="min-w-0 font-mono text-3xl text-white sm:text-4xl">
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
              <span className="shrink-0 font-mono text-sm tracking-[0.16em] text-[var(--orange)]">
                {project.ticker}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--dim)]">
              <span>
                Min received{" "}
                <span className="text-white">
                  {minTokens != null
                    ? `${formatAmount(minTokens, minTokens >= 1000 ? 2 : 4)} ${project.ticker}`
                    : "—"}
                </span>
              </span>
              <span>
                Rate{" "}
                <span className="text-white">
                  {rate != null
                    ? `1 SOL ≈ ${formatAmount(rate, rate >= 1000 ? 0 : 2)} ${project.ticker}`
                    : "—"}
                </span>
              </span>
              <span>1.5% slippage</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {PRESETS.map((value) => (
              <button
                key={value}
                type="button"
                className="btn btn-ghost min-h-10 px-3 text-[11px]"
                onClick={() => setAmount(String(value))}
              >
                {value} SOL
              </button>
            ))}
            {displayBal > 0 ? (
              <button
                type="button"
                className="btn btn-ghost min-h-10 px-3 text-[11px]"
                onClick={() => setAmount(Math.max(0, displayBal - 0.02).toFixed(3))}
              >
                Max
              </button>
            ) : null}
          </div>
          <p className="text-xs text-[var(--dim)]">
            {solana.connected
              ? `Wallet balance ${displayBal.toFixed(3)} SOL`
              : "Connect a wallet to sign. The quote above does not need a wallet."}
          </p>

          {solana.connected ? (
            <button
              type="button"
              className="btn btn-primary mt-2 w-full"
              disabled={!hasMint() || !amountRaw || Boolean(phase) || outTokens == null}
              onClick={() => void swap()}
            >
              {phase || receiveLabel}
            </button>
          ) : (
            <AdoptButton className="btn btn-primary mt-2 w-full" idleLabel="Connect wallet to adopt" />
          )}
        </div>

        {error ? <p className="mt-4 text-sm text-[#ff8a6a]">{error}</p> : null}
        {liveQuote?.error && hasMint() ? (
          <p className="mt-4 text-sm text-[var(--dim)]">{liveQuote.error}</p>
        ) : null}
        {signature ? (
          <div className="mt-4 space-y-1">
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
    </section>
  );
}
