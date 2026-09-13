"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { HouseButton } from "@/components/ui/house-button";
import { TelegramMark, XMark } from "@/components/brand/SocialMarks";
import { project } from "@/lib/config";
import { links, shareMemeOnXUrl } from "@/lib/links";
import { memes, type MemeCard } from "@/lib/memes";

type Flash = "caption" | "image" | "saved" | "fail" | null;

const CARD_STEP = 212;
const ROLL_PX_PER_MS = 0.034;

async function toPngBlob(blob: Blob) {
  if (blob.type === "image/png") return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0);
  const png = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((next) => (next ? resolve(next) : reject(new Error("png"))), "image/png");
  });
  bitmap.close();
  return png;
}

async function fetchMeme(src: string) {
  const response = await fetch(src);
  if (!response.ok) throw new Error("fetch");
  return response.blob();
}

function splitTape(items: MemeCard[]) {
  const top = items.filter((_, index) => index % 2 === 0);
  const bottom = items.filter((_, index) => index % 2 === 1);
  return {
    top,
    bottom,
    topFill: Math.max(0, bottom.length - top.length),
    bottomFill: Math.max(0, top.length - bottom.length),
  };
}

function MemeActions({ meme }: { meme: MemeCard }) {
  const [flash, setFlash] = useState<Flash>(null);

  function ping(next: Flash) {
    setFlash(next);
    window.setTimeout(() => setFlash(null), 1600);
  }

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(`${meme.caption} ${project.ticker}`);
      ping("caption");
    } catch {
      ping("fail");
    }
  }

  async function copyImage() {
    try {
      const blob = await fetchMeme(meme.src);
      const png = await toPngBlob(blob);
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      ping("image");
    } catch {
      ping("fail");
    }
  }

  async function saveImage() {
    try {
      const blob = await fetchMeme(meme.src);
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = meme.file;
      link.click();
      URL.revokeObjectURL(href);
      ping("saved");
    } catch {
      ping("fail");
    }
  }

  const status =
    flash === "caption"
      ? "Caption copied"
      : flash === "image"
        ? "Image copied"
        : flash === "saved"
          ? "Saved"
          : flash === "fail"
            ? "The rock refused"
            : "\u00a0";

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-2 gap-1.5">
        <HouseButton onClick={copyCaption} className="!h-8 !min-h-8 !px-2 !text-[10px]">
          {flash === "caption" ? "Copied" : "Copy"}
        </HouseButton>
        <HouseButton onClick={copyImage} className="!h-8 !min-h-8 !px-2 !text-[10px]">
          {flash === "image" ? "Copied" : "Image"}
        </HouseButton>
        <HouseButton onClick={saveImage} className="!h-8 !min-h-8 !px-2 !text-[10px]">
          {flash === "saved" ? "Saved" : "Save"}
        </HouseButton>
        <HouseButton
          href={shareMemeOnXUrl(meme.caption)}
          target="_blank"
          className="!h-8 !min-h-8 !px-2 !text-[10px]"
        >
          <XMark size={11} />
          Post
        </HouseButton>
      </div>
      <p className="h-4 text-[10px] tracking-[0.12em] uppercase text-[var(--gold)]" aria-live="polite">
        {status}
      </p>
    </div>
  );
}

function MemeTile({ meme }: { meme: MemeCard }) {
  return (
    <article className="glass-panel flex h-[24.75rem] w-[12.5rem] shrink-0 flex-col overflow-hidden rounded-[20px]">
      <div className="relative h-[12.5rem] shrink-0 bg-[#070b12]">
        <span className="absolute left-2 top-2 z-10 rounded-full bg-[#c0392b] px-2 py-0.5 text-[9px] font-bold tracking-[0.16em] text-white">
          {meme.stamp}
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={meme.src}
          alt={meme.alt}
          width={512}
          height={512}
          className="size-full object-cover"
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
        <p className="serif h-10 line-clamp-2 text-sm leading-5 text-[var(--cream)]">{meme.caption}</p>
        <p className="text-[10px] tracking-[0.16em] uppercase text-[var(--gold)]">{project.ticker}</p>
        <div className="mt-auto">
          <MemeActions meme={meme} />
        </div>
      </div>
    </article>
  );
}

function MemeRow({
  items,
  copy,
  fill,
}: {
  items: MemeCard[];
  copy: number;
  fill: number;
}) {
  const half = (pass: number) => (
    <>
      {items.map((meme, index) => (
        <MemeTile key={`${copy}-${pass}-${meme.id}-${index}`} meme={meme} />
      ))}
      {Array.from({ length: fill }, (_, index) => (
        <div
          key={`${copy}-${pass}-gap-${index}`}
          className="w-[12.5rem] shrink-0"
          aria-hidden
        />
      ))}
    </>
  );

  return (
    <div className="flex gap-3">
      {half(0)}
      {half(1)}
    </div>
  );
}

function MemeCarousel({ items }: { items: MemeCard[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const hover = useRef(false);
  const rolling = useRef(true);
  const [held, setHeld] = useState(false);
  const { top, bottom, topFill, bottomFill } = splitTape(items);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      rolling.current = false;
      setHeld(true);
    }
    let frame = 0;
    let last = 0;
    function tick(now: number) {
      if (last && el && rolling.current && !hover.current) {
        el.scrollLeft += (now - last) * ROLL_PX_PER_MS;
        const loop = el.scrollWidth / 2;
        if (loop > 0 && el.scrollLeft >= loop) el.scrollLeft -= loop;
      }
      last = now;
      frame = window.requestAnimationFrame(tick);
    }
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [items.length]);

  function wrapScroll() {
    const el = scroller.current;
    if (!el) return;
    const loop = el.scrollWidth / 2;
    if (loop <= 0) return;
    if (el.scrollLeft >= loop) el.scrollLeft -= loop;
    if (el.scrollLeft < 0) el.scrollLeft += loop;
  }

  function page(direction: -1 | 1) {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: direction * CARD_STEP, behavior: held ? "smooth" : "auto" });
    window.setTimeout(wrapScroll, held ? 360 : 0);
  }

  function toggleHold() {
    const next = !held;
    setHeld(next);
    rolling.current = !next;
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        hover.current = true;
      }}
      onMouseLeave={() => {
        hover.current = false;
      }}
      onFocusCapture={() => {
        hover.current = true;
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          hover.current = false;
        }
      }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="kicker">
          Locker tape · {String(items.length).padStart(2, "0")} filings · hover to steal
        </p>
        <HouseButton onClick={toggleHold} className="px-3 text-xs">
          {held ? <Play size={13} /> : <Pause size={13} />}
          {held ? "Roll tape" : "Hold tape"}
        </HouseButton>
      </div>
      <div className="relative">
        <div
          ref={scroller}
          data-meme-scroller
          className="overflow-x-auto overflow-y-hidden pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex min-w-min flex-col gap-3">
            <MemeRow items={top} copy={0} fill={topFill} />
            {bottom.length > 0 ? <MemeRow items={bottom} copy={1} fill={bottomFill} /> : null}
          </div>
        </div>
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#060a12] to-transparent sm:w-14" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#060a12] to-transparent sm:w-14" />
        <button
          type="button"
          aria-label="Previous memes"
          onClick={() => page(-1)}
          className="absolute inset-y-0 left-1 z-10 my-auto inline-flex size-10 items-center justify-center rounded-full border border-[rgba(232,210,176,0.22)] bg-[rgba(12,19,32,0.82)] text-[var(--cream)] backdrop-blur-md hover:border-[rgba(247,147,26,0.55)] hover:text-white"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          aria-label="Next memes"
          onClick={() => page(1)}
          className="absolute inset-y-0 right-1 z-10 my-auto inline-flex size-10 items-center justify-center rounded-full border border-[rgba(232,210,176,0.22)] bg-[rgba(12,19,32,0.82)] text-[var(--cream)] backdrop-blur-md hover:border-[rgba(247,147,26,0.55)] hover:text-white"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

export function MemeDesk() {
  return (
    <section className="section pb-16 pt-8">
      <div className="mb-8 max-w-3xl">
        <p className="kicker">Exhibit D · Evidence locker</p>
        <h1 className="display mt-3 text-6xl text-white sm:text-8xl">
          Too lazy to post?
          <span className="block text-[var(--orange)]">Steal these.</span>
        </h1>
        <p className="serif mt-5 max-w-xl text-xl text-[var(--cream)] sm:text-2xl">
          The tape rolls the filings. Hover to hold a card. Copy the line, lift the picture, dump it on X.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {[
            "01 · Copy the caption",
            "02 · Copy the image",
            "03 · Post and paste",
            "04 · Drop extras in the kennel",
          ].map((step) => (
            <span key={step} className="chip">
              {step}
            </span>
          ))}
        </div>
      </div>

      <div className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 px-4 sm:px-6">
        <MemeCarousel items={memes} />
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <HouseButton variant="primary" href={links.telegram} target="_blank">
          <TelegramMark size={15} />
          Dump it in the kennel
        </HouseButton>
        <HouseButton href={links.twitter} target="_blank">
          <XMark size={14} />
          Follow the rock
        </HouseButton>
        <HouseButton href="/#adopt">Adopt the rock</HouseButton>
        <p className="serif max-w-lg text-lg text-[var(--dim)]">
          Official kennel is Telegram. Official noise is X. Leave the original thought at home.
        </p>
      </div>
    </section>
  );
}
