"use client";

import { useCallback, useState } from "react";
import { HouseButton } from "@/components/ui/house-button";
import { LottoAlert } from "@/components/site/LottoAlert";
import { formatAmount, formatCount, shortenAddress } from "@/lib/format";
import { explorerAccountUrl, LOTTO_SOURCE_REPO } from "@/lib/links";
import { JROCK_LOTTO_V2_PROGRAM_ID } from "@/lib/lotto-program";
import type { IndependentReceipt } from "@/lib/lotto-verify";

export function LottoVerifyDesk({ defaultRound = 0 }: { defaultRound?: number }) {
  const [round, setRound] = useState(String(defaultRound));
  const [pda, setPda] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dismissError = useCallback(() => setError(""), []);
  const [receipt, setReceipt] = useState<IndependentReceipt | null>(null);

  async function run() {
    setBusy(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (round.trim()) params.set("round", round.trim());
      if (pda.trim()) params.set("pda", pda.trim());
      const response = await fetch(`/api/lotto/independent?${params}`, { cache: "no-store" });
      const next = (await response.json()) as IndependentReceipt & { error?: string };
      if (!response.ok) throw new Error(next.error || "Solana did not answer.");
      setReceipt(next);
    } catch (err) {
      setReceipt(null);
      setError(err instanceof Error ? err.message : "Solana did not answer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section pb-16 pt-8">
      <p className="kicker">Exhibit L · Independent check</p>
      <h1 className="display mt-3 text-6xl text-white sm:text-8xl">
        Ask Solana
        <span className="block text-[var(--orange)]">not this site.</span>
      </h1>
      <p className="serif mt-5 max-w-2xl text-xl text-[var(--cream)]">
      This page asks Solana from our server and recomputes the winner index. It does not reuse the kennel
      marketing tape. For a check that never touches this site, run{" "}
      <code className="font-mono text-[var(--gold)]">npm run verify:lotto</code>.
      </p>

      <div className="glass-panel mt-8 rounded-[28px] p-5 sm:p-6">
        <p className="kicker">Public program source</p>
        <h2 className="display mt-2 text-4xl text-white sm:text-5xl">Match the ELF. Not the luck.</h2>
        <p className="serif mt-4 max-w-2xl text-lg text-[var(--cream)]">
          The live kennel uses ORAO VRF Classic. A verified build proves the deployed binary came from the public
          program repo. It does not make the upgrade authority disappear.
        </p>
        <p className="mt-4 break-all font-mono text-xs text-[var(--stone)]">{LOTTO_SOURCE_REPO}</p>
        <pre className="mt-4 overflow-x-auto rounded-2xl bg-[#080d16] p-4 font-mono text-[11px] leading-6 text-[var(--gold)]">
{`solana-verify verify-from-repo \\
  ${LOTTO_SOURCE_REPO} \\
  --program-id ${JROCK_LOTTO_V2_PROGRAM_ID} \\
  --library-name jrock_lotto_v2 \\
  --commit-hash lotto-v2-mainnet`}
        </pre>
        <div className="mt-4 flex flex-wrap gap-2">
          <HouseButton href={LOTTO_SOURCE_REPO} target="_blank">
            Program repo
          </HouseButton>
          <HouseButton href={`${LOTTO_SOURCE_REPO}/releases/tag/lotto-v2-mainnet`} target="_blank">
            Live VRF tag
          </HouseButton>
          <HouseButton href={explorerAccountUrl(JROCK_LOTTO_V2_PROGRAM_ID)} target="_blank">
            Program on Solscan
          </HouseButton>
        </div>
      </div>

      <div className="glass-panel mt-8 max-w-xl rounded-[28px] p-5 sm:p-6">
        <label className="text-[10px] tracking-[0.16em] uppercase text-[var(--gold)]">Round number</label>
        <input
          value={round}
          onChange={(event) => setRound(event.target.value)}
          className="mt-2 w-full rounded-2xl border border-[rgba(232,210,176,0.16)] bg-[#080d16] px-4 py-3 font-mono text-white"
        />
        <label className="mt-4 block text-[10px] tracking-[0.16em] uppercase text-[var(--gold)]">
          Or round PDA
        </label>
        <input
          value={pda}
          onChange={(event) => setPda(event.target.value)}
          placeholder="optional"
          className="mt-2 w-full rounded-2xl border border-[rgba(232,210,176,0.16)] bg-[#080d16] px-4 py-3 font-mono text-sm text-white"
        />
        <HouseButton variant="primary" className="mt-5 w-full" disabled={busy} onClick={() => void run()}>
          {busy ? "Reading Solana…" : "Recompute from chain"}
        </HouseButton>
        {error ? <LottoAlert text={error} onDismiss={dismissError} /> : null}
      </div>

      {receipt ? <ReceiptCard receipt={receipt} /> : null}
    </section>
  );
}

function ReceiptCard({ receipt }: { receipt: IndependentReceipt }) {
  const ledger = receipt.ledger;
  return (
    <div className="glass-panel mt-8 rounded-[28px] p-5 sm:p-7">
      <p className="kicker">
        Round {String(receipt.roundId + 1).padStart(2, "0")} · {receipt.status}
        {receipt.matches == null ? "" : receipt.matches ? " · math matches" : " · math failed"}
      </p>
      <p className="mt-3 break-all font-mono text-xs text-[var(--stone)]">RPC {receipt.rpc}</p>
      <p className="mt-2 break-all font-mono text-xs text-[var(--stone)]">
        Program {receipt.programId}
      </p>
      <p className="mt-2 break-all font-mono text-xs text-[var(--stone)]">Round {receipt.roundPda}</p>
      {receipt.vrfRequest ? (
        <p className="mt-2 break-all font-mono text-xs text-[var(--stone)]">VRF {receipt.vrfRequest}</p>
      ) : null}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Tickets" value={formatCount(receipt.totalTickets) ?? "0"} />
        <Stat label="Prize pool" value={`${formatAmount(ledger.distributablePotLamports / 1e9, 4)} SOL`} />
        <Stat label="Winner 85%" value={`${formatAmount(ledger.winnerPayoutLamports / 1e9, 4)} SOL`} />
        <Stat label="Next seed" value={`${formatAmount(ledger.nextRoundSeedLamports / 1e9, 4)} SOL`} />
      </div>
      <p className="mt-3 text-xs tracking-[0.14em] uppercase text-[var(--gold)]">
        Account {formatAmount(ledger.accountBalanceLamports / 1e9, 4)} SOL · rent{" "}
        {formatAmount(ledger.rentExemptReserveLamports / 1e9, 4)} SOL · conserved {receipt.conserved ? "yes" : "no"}
      </p>
      <p className="mt-4 text-sm text-[var(--cream)]">
        {receipt.totalTickets === 0
          ? "Nobody has bought this round yet. After a slip is filed, settle always picks one of those wallets."
          : receipt.matches == null
            ? "This round is not settled yet. After ORAO answers, this page recomputes the winner from the stored bytes."
            : `Stored winner ${receipt.storedWinner ? shortenAddress(receipt.storedWinner, 6) : "none"} · slip ${receipt.storedWinnerIndex ?? "—"}`}
      </p>
      {receipt.totalTickets > 0 ? (
        <p className="mt-1 text-sm text-[var(--cream)]">
          Recomputed {receipt.computedWinner ? shortenAddress(receipt.computedWinner, 6) : "n/a"} · slip{" "}
          {receipt.computedWinnerIndex ?? "—"}
        </p>
      ) : null}
      <p className="mt-4 text-xs leading-6 text-[var(--dim)]">{receipt.mapping}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <HouseButton href={explorerAccountUrl(receipt.programId)} target="_blank">
          Program
        </HouseButton>
        <HouseButton href={explorerAccountUrl(receipt.roundPda)} target="_blank">
          Round account
        </HouseButton>
      </div>
      <ul className="mt-5 list-disc space-y-2 pl-5 text-sm text-[var(--dim)]">
        {receipt.limitations.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {receipt.buyers.length > 0 ? (
        <div className="mt-6 space-y-2 font-mono text-xs text-[var(--stone)]">
          {receipt.buyers.map((row) => (
            <p key={`${row.wallet}-${row.fromIndex}`}>
              slips {row.fromIndex}
              {row.tickets > 1 ? `–${row.fromIndex + row.tickets - 1}` : ""} · {row.wallet}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[rgba(232,210,176,0.12)] bg-[#080d16] px-4 py-3">
      <p className="text-[10px] tracking-[0.16em] uppercase text-[var(--gold)]">{label}</p>
      <p className="display mt-1 text-3xl text-white">{value}</p>
    </div>
  );
}
