"use client";

import { useSyncExternalStore } from "react";
import SlotCounter from "react-slot-counter";
import { cn } from "@/lib/utils";

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

  if (!ready) {
    return <span className={cn("font-mono", className)}>{value}</span>;
  }

  return (
    <span className={cn("font-mono", className)}>
      <span className="sr-only">{value}</span>
      <span aria-hidden>
        <SlotCounter
          value={value}
          startValue={entrance ? "0".repeat(Math.max(value.replace(/\D/g, "").length, 1)) : value}
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
      </span>
    </span>
  );
}
