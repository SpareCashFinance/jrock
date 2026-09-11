"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { DexTape } from "./DexTape";
import { Mascot } from "./Mascot";

const captions = [
  "He called it a pet rock.",
  "The market kept the receipt.",
  "The rock filed a response.",
];

export function ExhibitTape() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [caption, setCaption] = useState(0);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio > 0.35),
      { threshold: [0.35, 0.6] },
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
    video.muted = !video.muted;
    setMuted(video.muted);
  }

  return (
    <section ref={stageRef} id="tape" className="section">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="kicker">Exhibit A · Origin tape</p>
          <h2 className="display mt-3 max-w-3xl text-6xl text-white [word-spacing:0.16em] sm:text-8xl">
            He said it on television.
            <span className="block text-[var(--orange)]">We incorporated the rock.</span>
          </h2>
        </div>
        <p className="max-w-sm text-sm leading-6 text-[var(--dim)]">
          The insult is the lore. This clip is filed as evidence, not endorsement.
          Independent parody. No affiliation with the people or networks shown.
        </p>
      </div>

      <div className="grid items-center gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="cardboard relative overflow-hidden rounded-[32px] p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between px-2 text-[11px] tracking-[0.2em] uppercase">
            <span>Board reel 01</span>
            <span>00:14 · classified adjacent</span>
          </div>
          <div className="tape-scanlines relative overflow-hidden rounded-[22px] bg-black shadow-[inset_0_0_0_1px_rgba(0,0,0,0.35)]">
            <video
              ref={videoRef}
              className="aspect-video w-full object-cover"
              poster="/media/pet-rock-poster.jpg"
              playsInline
              loop
              muted
              preload="metadata"
            >
              <source src="/media/pet-rock.mp4" type="video/mp4" />
            </video>
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(6,10,18,0.08),transparent_30%,rgba(6,10,18,0.35))]" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(transparent,rgba(6,10,18,0.72))]" />
            <AnimatePresence mode="wait">
              <motion.p
                key={captions[caption]}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="pointer-events-none absolute bottom-14 left-5 right-5 display text-3xl text-white sm:text-5xl"
              >
                {captions[caption]}
              </motion.p>
            </AnimatePresence>
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
              <button type="button" className="btn btn-ghost min-h-10 px-3 text-[11px]" onClick={togglePlay}>
                {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
                {playing ? "Hold tape" : "Play tape"}
              </button>
              <button type="button" className="btn btn-ghost min-h-10 px-3 text-[11px]" onClick={toggleMute}>
                {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                {muted ? "Muted" : "Sound on"}
              </button>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -left-2 top-6 hidden rotate-[-8deg] rounded bg-[#c0392b] px-3 py-1 text-[11px] font-bold tracking-[0.18em] text-white shadow-lg lg:block">
            ENTERED
          </div>
          <Mascot size="stage" />
          <div className="cardboard mt-4 rounded-3xl p-5">
            <p className="text-[11px] tracking-[0.2em] uppercase">Rock&apos;s filing</p>
            <p className="serif mt-2 text-2xl">Same rock. Higher standards.</p>
            <p className="mt-2 text-sm leading-6 text-[#4a3b28]">
              They said Bitcoin does nothing. Eligible $JROCK holders may receive
              variable WBTC through stonk.fun. That is the entire punchline.
            </p>
          </div>
        </div>
      </div>

      <DexTape />
    </section>
  );
}
