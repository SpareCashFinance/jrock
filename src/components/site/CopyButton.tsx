"use client";

import { useState } from "react";
import { HouseButton } from "@/components/ui/house-button";
import { copyText } from "@/lib/clipboard";

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
  const [status, setStatus] = useState<"idle" | "copied" | "empty" | "fail">("idle");
  const ready = Boolean(value.trim());

  function flash(next: "copied" | "empty" | "fail") {
    setStatus(next);
    window.setTimeout(() => setStatus("idle"), 1800);
  }

  async function onCopy() {
    if (!ready) {
      flash("empty");
      return;
    }
    const ok = await copyText(value);
    flash(ok ? "copied" : "fail");
  }

  const text =
    status === "copied"
      ? "Copied"
      : status === "fail"
        ? "Copy failed"
        : status === "empty"
          ? "Mint not live"
          : ready
            ? label
            : emptyLabel;

  return (
    <HouseButton className={className} onClick={() => void onCopy()} aria-live="polite">
      {text}
    </HouseButton>
  );
}
