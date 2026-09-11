"use client";

import { useState } from "react";
import { HouseButton } from "@/components/ui/house-button";

type CopyButtonProps = {
  value: string;
  label?: string;
  className?: string;
  emptyLabel?: string;
};

export function CopyButton({
  value,
  label = "Copy contract",
  className,
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
    <HouseButton className={className} onClick={onCopy} disabled={!ready} aria-live="polite">
      {ready ? (copied ? "Copied" : label) : emptyLabel}
    </HouseButton>
  );
}
