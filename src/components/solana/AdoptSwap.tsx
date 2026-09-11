"use client";

import { useEffect, useMemo, useState } from "react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { NetworkSolana, TokenWBTC } from "@web3icons/react";
import { BorderBeam } from "@/components/ui/border-beam";
import { Card } from "@/components/ui/card";
import { hasMint, project } from "@/lib/config";
import { WSOL_MINT } from "@/lib/solana";
import { explorerTxUrl } from "@/lib/links";
import { useSolanaWallet } from "./SolanaWalletProvider";
import { AdoptButton } from "./AdoptButton";

const PRESETS = [0.1, 0.25, 0.5, 1];
const TOKEN_DECIMALS = Number(process.env.NEXT_PUBLIC_JROCK_DECIMALS || 6);

type Quote = {
  outAmount?: string;
  minOutAmount?: string;
  quoteResponse?: Record<string, unknown>;
  error?: string;
};

export function AdoptSwap() {
  const solana = useSolanaWallet();
  const [amount, setAmount] = useState("0.25");
  const [solBal, setSolBal] = useState(0);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState("");
  const [signature, setSignature] = useState("");

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
    if (!hasMint() || !amountRaw || !solana.address) return;
    const handle = window.setTimeout(() => {
      void fetch("/api/trade/jupiter/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          inputMint: WSOL_MINT,
          outputMint: project.mint,
          amount: amountRaw,
          slippageBps: 150,
        }),
      })
        .then((res) => res.json() as Promise<Quote>)
        .then((data) => setQuote(data.outAmount ? data : { error: data.error || "No route yet" }))
        .catch(() => setQuote({ error: "Quote unavailable" }));
    }, 280);
    return () => window.clearTimeout(handle);
  }, [amountRaw, solana.address]);

  const liveQuote = hasMint() && amountRaw && solana.address ? quote : null;
  const outTokens = liveQuote?.outAmount
    ? Number(liveQuote.outAmount) / 10 ** TOKEN_DECIMALS
    : null;
  const displayBal = solana.address ? solBal : 0;

  async function swap() {
    setError("");
    setSignature("");
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
          slippageBps: 150,
          quoteResponse: liveQuote?.quoteResponse,
        }),
      });
      const plan = (await hop.json()) as {
        tx?: string;
        requestId?: string;
        execute?: boolean;
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
        const exec = (await landed.json()) as { signature?: string; error?: string };
        if (!landed.ok) throw new Error(exec.error ?? "Jupiter execute failed");
        setSignature(exec.signature || "");
      } else {
        const sig = await solana.signAndSendBase64(plan.tx);
        setSignature(sig);
      }
      setPhase("");
    } catch (e) {
      setPhase("");
      setError(e instanceof Error ? e.message : "Swap failed");
    }
  }

  return (
    <section id="adopt" className="section pt-6">
      <Card className="relative overflow-hidden border-[rgba(232,210,176,0.14)] bg-[#0c1320]/80 p-6 sm:p-8">
        <BorderBeam colorFrom="#f7931a" colorTo="#d4b46a" size={110} duration={8} />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="kicker">Kennel desk · Jupiter</p>
            <h2 className="display mt-3 text-5xl text-white sm:text-7xl">Adopt $JROCK</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--dim)]">
              Connect a Solana wallet and swap SOL straight into the rock. Same Jupiter
              routing we run on LaunchHouse. Not a stonk.fun detour.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs tracking-[0.16em] uppercase text-[var(--dim)]">
            <NetworkSolana variant="branded" size={16} />
            SOL
            <span className="text-[var(--gold)]">→</span>
            {project.ticker}
            <TokenWBTC variant="branded" size={16} />
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <label className="block">
              <span className="kicker">You pay</span>
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                className="mt-2 w-full rounded-2xl border border-[rgba(232,210,176,0.16)] bg-[#060a12] px-4 py-4 font-mono text-2xl text-white outline-none focus:border-[var(--orange)]"
                placeholder="0.25"
              />
            </label>
            <div className="flex flex-wrap gap-2">
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
                : "Connect to see your SOL balance."}
            </p>
          </div>

          <div className="rounded-2xl border border-[rgba(232,210,176,0.12)] bg-[#060a12]/70 p-5">
            <p className="kicker">You receive</p>
            <p className="mt-3 font-mono text-3xl text-white">
              {outTokens != null
                ? `${outTokens.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${project.ticker}`
                : hasMint()
                  ? "—"
                  : "Mint pending"}
            </p>
            <p className="mt-2 text-xs text-[var(--dim)]">
              Quote via Jupiter. 1.5% slippage. Amounts move with the live route.
            </p>
            {solana.connected ? (
              <button
                type="button"
                className="btn btn-primary mt-6 w-full"
                disabled={!hasMint() || !amountRaw || Boolean(phase)}
                onClick={() => void swap()}
              >
                {phase || `Adopt with ${amount || "0"} SOL`}
              </button>
            ) : (
              <AdoptButton className="btn btn-primary mt-6 w-full" idleLabel="Connect wallet to adopt" />
            )}
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-[#ff8a6a]">{error}</p> : null}
        {liveQuote?.error && hasMint() ? (
          <p className="mt-4 text-sm text-[var(--dim)]">{liveQuote.error}</p>
        ) : null}
        {signature ? (
          <a className="mt-4 inline-block text-sm text-[var(--orange)]" href={explorerTxUrl(signature)}>
            Swap landed · view on Explorer
          </a>
        ) : null}
      </Card>
    </section>
  );
}
