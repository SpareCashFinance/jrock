"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { CircularText } from "@/components/react-bits/CircularText";

type Trick = "idle" | "sit" | "stay" | "rollover" | "fetch" | "stack";

type MascotProps = {
  size?: "hero" | "stage";
  trick?: Trick;
  dropping?: boolean;
  stacked?: number;
};

const trickClass: Record<Trick, string> = {
  idle: "",
  sit: "translate-y-6",
  stay: "",
  rollover: "rotate-[360deg]",
  fetch: "-translate-x-8 -translate-y-3",
  stack: "translate-x-3",
};

export function Mascot({
  size = "hero",
  trick = "idle",
  dropping = false,
  stacked = 0,
}: MascotProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const ringId = `jrock-ring-${useId().replace(/:/g, "")}`;
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const node = wrap.current?.closest("[data-mascot-stage]") ?? wrap.current;
    if (!node) return;

    const onMove = (event: Event) => {
      const pointer = event as PointerEvent;
      const box = node.getBoundingClientRect();
      const x = ((pointer.clientX - box.left) / box.width - 0.5) * 10;
      const y = ((pointer.clientY - box.top) / box.height - 0.5) * -8;
      setTilt({ x, y });
    };
    const reset = () => setTilt({ x: 0, y: 0 });

    node.addEventListener("pointermove", onMove);
    node.addEventListener("pointerleave", reset);
    return () => {
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerleave", reset);
    };
  }, []);

  const dim = size === "hero" ? 460 : 320;

  return (
    <div
      ref={wrap}
      className="relative mx-auto grid place-items-center"
      style={{ width: "min(100%, 520px)", aspectRatio: "1" }}
    >
      <CircularText
        pathId={ringId}
        text="THE PET ROCK THAT PAYS IN BITCOIN  $JROCK  WBTC  STONK.FUN"
        className="pointer-events-none absolute inset-[-8%] text-[rgba(232,210,176,0.42)]"
      />
      <div
        className={`mascot-idle relative transition-transform duration-500 ${trickClass[trick]}`}
        style={{
          transform: `perspective(900px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)`,
        }}
      >
        <div className="absolute inset-6 rounded-full bg-[radial-gradient(circle,rgba(247,147,26,0.28),transparent_68%)] blur-2xl" />
        <div
          className="relative z-10 overflow-hidden rounded-full border border-[rgba(247,147,26,0.35)]"
          style={{ width: `min(100%, ${dim}px)`, aspectRatio: "1" }}
        >
          <Image
            src="/mascot.jpg"
            alt="Jamie’s Pet Rock mascot sitting in a cardboard carrier, wearing a navy tie and a Bitcoin medallion"
            width={dim}
            height={dim}
            priority={size === "hero"}
            className="h-full w-full select-none object-cover"
          />
        </div>
        {dropping ? (
          <span className="coin-drop absolute left-1/2 top-[18%] z-20 grid h-10 w-10 place-items-center rounded-full bg-[#f7931a] text-lg font-black text-[#1a0f04] shadow-[0_0_24px_rgba(247,147,26,0.65)]">
            ₿
          </span>
        ) : null}
        {stacked > 0 ? (
          <div className="absolute right-[8%] bottom-[18%] z-20 flex flex-col-reverse items-center">
            {Array.from({ length: stacked }).map((_, index) => (
              <span
                key={index}
                className="mb-[-8px] grid h-8 w-8 place-items-center rounded-full bg-[#f7931a] text-xs font-black text-[#1a0f04] shadow-lg"
              >
                ₿
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
