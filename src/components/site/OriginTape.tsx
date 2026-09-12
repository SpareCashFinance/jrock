"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { HouseButton } from "@/components/ui/house-button";

const captions = [
  "He called it a pet rock.",
  "The market kept the receipt.",
  "The rock filed a response.",
];

export function OriginTape() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [caption, setCaption] = useState(0);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio > 0.28),
      { threshold: [0.28, 0.55] },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    if (inView && !reduce) {
      void video.play().catch(() => undefined);
    } else {
      video.pause();
    }
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
    };
  }, [inView]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setCaption((value) => (value + 1) % captions.length);
    }, 3200);
    return () => window.clearInterval(id);
  }, []);

  async function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      await video.play();
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setMuted(nextMuted);
    if (nextMuted) return;
    video.currentTime = 0;
    void video.play().catch(() => undefined);
    setPlaying(true);
  }

  return (
    <div
      ref={stageRef}
      id="tape"
      className="cardboard relative flex h-full flex-col overflow-hidden rounded-[28px] p-3 sm:p-4"
    >
      <div className="mb-3 flex items-center justify-between px-1 text-[11px] tracking-[0.2em] uppercase">
        <span>Exhibit A · Origin tape</span>
        <span>01:14</span>
      </div>
      <div className="tape-scanlines relative min-h-0 flex-1 overflow-hidden rounded-[20px] bg-black shadow-[inset_0_0_0_1px_rgba(0,0,0,0.35)]">
        <video
          ref={videoRef}
          className="aspect-video h-full w-full object-cover lg:aspect-auto lg:min-h-[280px]"
          poster="/media/pet-rock-poster.jpg?v=3512"
          playsInline
          loop
          muted={muted}
          preload="metadata"
        >
          <source src="/media/pet-rock.mp4?v=3512" type="video/mp4" />
        </video>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(6,10,18,0.08),transparent_30%,rgba(6,10,18,0.35))]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(transparent,rgba(6,10,18,0.72))]" />
        <AnimatePresence mode="wait">
          <motion.p
            key={captions[caption]}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="pointer-events-none absolute bottom-14 left-4 right-4 display text-2xl text-white sm:text-4xl"
          >
            {captions[caption]}
          </motion.p>
        </AnimatePresence>
        {muted ? (
          <button
            type="button"
            onClick={toggleMute}
            className="absolute inset-0 z-10 grid place-items-center bg-[#060a12]/35"
          >
            <span className="btn btn-primary px-5 text-sm">
              <Volume2 className="size-4" />
              Unmute
            </span>
          </button>
        ) : null}
        <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-between">
          <HouseButton className="min-h-9 px-3 text-[11px]" onClick={togglePlay}>
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            {playing ? "Hold tape" : "Play tape"}
          </HouseButton>
          <HouseButton className="min-h-9 px-3 text-[11px]" onClick={toggleMute}>
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            {muted ? "Muted" : "Sound on"}
          </HouseButton>
        </div>
      </div>
    </div>
  );
}
