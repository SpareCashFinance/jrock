"use client";

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

function MascotEyes({ eager = false }: { eager?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const play = () => {
      void video.play().catch(() => undefined);
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) play();
        else video.pause();
      },
      { threshold: 0.2 },
    );
    io.observe(video);
    return () => io.disconnect();
  }, []);

  return (
    <video
      ref={videoRef}
      className="pointer-events-none h-[78%] w-[78%] select-none object-contain"
      poster="/mascot.jpg"
      playsInline
      muted
      loop
      autoPlay
      preload={eager ? "auto" : "metadata"}
      aria-label="Jamie’s Pet Rock mascot sitting in a cardboard carrier, wearing a navy tie and a Bitcoin medallion"
    >
      <source src="/media/mascot-eyes.mp4" type="video/mp4" />
    </video>
  );
}

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

  return (
    <div
      ref={wrap}
      className="relative mx-auto grid place-items-center"
      style={{ width: size === "hero" ? "min(100%, 520px)" : "min(100%, 380px)", aspectRatio: "1" }}
    >
      <CircularText
        pathId={ringId}
        text="THE PET ROCK THAT PAYS IN BITCOIN • JROCK • WBTC • STONK.FUN"
        className="pointer-events-none absolute inset-0 text-[rgba(232,210,176,0.42)]"
      />
      <div
        className={`mascot-idle relative grid place-items-center transition-transform duration-500 ${trickClass[trick]}`}
        style={{
          width: "70%",
          transform: `perspective(900px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)`,
        }}
      >
        <div className="absolute inset-[-8%] rounded-full bg-[radial-gradient(circle,rgba(247,147,26,0.28),transparent_68%)] blur-2xl" />
        <div className="relative z-10 grid aspect-square w-full place-items-center overflow-hidden rounded-full border border-[rgba(247,147,26,0.35)] bg-[#060a12]">
          <MascotEyes eager={size === "hero"} />
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
