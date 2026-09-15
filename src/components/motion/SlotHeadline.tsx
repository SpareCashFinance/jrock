"use client";

import { useSyncExternalStore } from "react";
import SlotCounter from "react-slot-counter";
import { cn } from "@/lib/utils";

const MAX_SLOT_DIGITS = 16;
const SLOT_CORE = /^(\$?)([0-9][0-9,.]*)(%?)$/;

function parseSlotValue(raw: string) {
  const value = String(raw ?? "");
  const match = value.match(SLOT_CORE);
  const prefix = match?.[1] ?? "";
  const core = match?.[2] ?? "";
  const suffix = match?.[3] ?? "";
  const numeric = Number(core.replace(/,/g, ""));
  const slot = Boolean(match) && Number.isFinite(numeric);
  const digitCount = slot ? Math.min(MAX_SLOT_DIGITS, Math.max(core.replace(/\D/g, "").length, 1)) : 0;
  return { value, prefix, core, suffix, slot, digitCount };
}

export function SlotHeadline({
  value,
  className,
  entrance = true,
}: {
  value: string;
  className?: string;
  entrance?: boolean;
}) {
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const parsed = parseSlotValue(value);

  if (!ready || !parsed.slot) {
    return <span className={cn("font-mono", className)}>{parsed.value}</span>;
  }

  return (
    <span className={cn("font-mono", className)}>
      <span className="sr-only">{parsed.value}</span>
      <span aria-hidden>
        {parsed.prefix}
        <SlotCounter
          value={parsed.core}
          startValue={entrance ? "0".repeat(parsed.digitCount) : parsed.core}
          startValueOnce
          duration={0.82}
          dummyCharacterCount={entrance ? 6 : 3}
          sequentialAnimationMode
          useMonospaceWidth
          startFromLastDigit
          autoAnimationStart
          animateUnchanged={false}
          containerClassName="house-slot"
          numberClassName="house-slot-num"
          charClassName="house-slot-char"
          separatorClassName="house-slot-sep"
        />
        {parsed.suffix}
      </span>
    </span>
  );
}
