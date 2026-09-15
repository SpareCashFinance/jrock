"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type LottoClipProps = {
  className?: string;
  eager?: boolean;
};

export function LottoClip({ className, eager = false }: LottoClipProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void video.play().catch(() => undefined);
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
      className={cn("h-full w-full object-cover", className)}
      poster="/media/lotto-rock-poster.jpg"
      playsInline
      muted
      loop
      autoPlay={eager}
      preload={eager ? "auto" : "metadata"}
      aria-hidden
    >
      <source src="/media/lotto-rock.mp4" type="video/mp4" />
    </video>
  );
}
