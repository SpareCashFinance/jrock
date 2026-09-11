"use client";

import { useState } from "react";

type CopyButtonProps = {
  value: string;
  label?: string;
  className?: string;
  emptyLabel?: string;
};

export function CopyButton({
  value,
  label = "Copy contract",
  className = "btn btn-ghost",
  emptyLabel = "Contract pending",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const ready = Boolean(value.trim());

  async function onCopy() {
    if (!ready) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      className={className}
      onClick={onCopy}
      disabled={!ready}
      aria-live="polite"
    >
      {ready ? (copied ? "Copied" : label) : emptyLabel}
    </button>
  );
}
