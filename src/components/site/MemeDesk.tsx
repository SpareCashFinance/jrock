"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { HouseButton } from "@/components/ui/house-button";
import { TelegramMark, XMark } from "@/components/brand/SocialMarks";
import { project } from "@/lib/config";
import { links, shareMemeOnXUrl } from "@/lib/links";
import { memes, type MemeCard } from "@/lib/memes";

type Flash = "caption" | "image" | "saved" | "fail" | null;

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
            : null;

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
      <p className="min-h-4 text-[10px] tracking-[0.12em] uppercase text-[var(--gold)]" aria-live="polite">
        {status}
      </p>
    </div>
  );
}

function MemeTile({ meme }: { meme: MemeCard }) {
  return (
    <article className="glass-panel flex w-[11rem] shrink-0 flex-col overflow-hidden rounded-[20px] sm:w-[12.5rem]">
      <div className="relative bg-[#070b12]">
        <span className="absolute left-2 top-2 z-10 rounded-full bg-[#c0392b] px-2 py-0.5 text-[9px] font-bold tracking-[0.16em] text-white">
          {meme.stamp}
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={meme.src}
          alt={meme.alt}
          width={512}
          height={512}
          className="aspect-square w-full object-cover"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="serif line-clamp-3 text-sm leading-5 text-[var(--cream)]">{meme.caption}</p>
        <p className="text-[10px] tracking-[0.16em] uppercase text-[var(--gold)]">{project.ticker}</p>
        <div className="mt-auto">
          <MemeActions meme={meme} />
        </div>
      </div>
    </article>
  );
}

function MemeCarousel({ items }: { items: MemeCard[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const top = items.filter((_, index) => index % 2 === 0);
  const bottom = items.filter((_, index) => index % 2 === 1);

  function syncArrows() {
    const el = scroller.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 8);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    syncArrows();
    el.addEventListener("scroll", syncArrows, { passive: true });
    const observer = new ResizeObserver(syncArrows);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", syncArrows);
      observer.disconnect();
    };
  }, [items.length]);

  function page(direction: -1 | 1) {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.round(el.clientWidth * 0.72), behavior: "smooth" });
  }

  return (
    <div className="relative">
      <div
        ref={scroller}
        data-meme-scroller
        className="snap-x snap-mandatory overflow-x-auto overflow-y-hidden pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex min-w-min flex-col gap-3">
          <div className="flex gap-3">
            {top.map((meme) => (
              <div key={meme.id} className="snap-start">
                <MemeTile meme={meme} />
              </div>
            ))}
          </div>
          {bottom.length > 0 ? (
            <div className="flex gap-3">
              {bottom.map((meme) => (
                <div key={meme.id} className="snap-start">
                  <MemeTile meme={meme} />
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {canPrev ? (
        <button
          type="button"
          aria-label="Previous memes"
          onClick={() => page(-1)}
          className="absolute inset-y-0 left-0 z-10 my-auto inline-flex size-10 items-center justify-center rounded-full border border-[rgba(232,210,176,0.22)] bg-[rgba(12,19,32,0.82)] text-[var(--cream)] backdrop-blur-md hover:border-[rgba(247,147,26,0.55)] hover:text-white"
        >
          <ChevronLeft size={18} />
        </button>
      ) : null}
      {canNext ? (
        <button
          type="button"
          aria-label="Next memes"
          onClick={() => page(1)}
          className="absolute inset-y-0 right-0 z-10 my-auto inline-flex size-10 items-center justify-center rounded-full border border-[rgba(232,210,176,0.22)] bg-[rgba(12,19,32,0.82)] text-[var(--cream)] backdrop-blur-md hover:border-[rgba(247,147,26,0.55)] hover:text-white"
        >
          <ChevronRight size={18} />
        </button>
      ) : null}
    </div>
  );
}

export function MemeDesk() {
  return (
    <section className="section pb-16 pt-8">
      <div className="mb-8 grid items-end gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className="kicker">Evidence locker · keep adding</p>
          <h1 className="display mt-3 max-w-3xl text-6xl text-white sm:text-8xl">
            Too lazy to post?
            <span className="block text-[var(--orange)]">Steal these.</span>
          </h1>
          <p className="serif mt-5 max-w-xl text-xl text-[var(--cream)] sm:text-2xl">
            Copy the caption. Copy the image. Then post on X and paste the picture in. The rock does not require original thought.
          </p>
        </div>
        <div className="cardboard rounded-3xl p-5">
          <p className="text-[11px] tracking-[0.2em] uppercase">How to steal</p>
          <ol className="serif mt-3 space-y-2 text-lg leading-6 text-[#2a2116]">
            <li>01 · Copy the caption.</li>
            <li>02 · Copy the image — or save it.</li>
            <li>03 · Hit Post, then paste or attach the picture.</li>
            <li>04 · Drop extras in the kennel.</li>
          </ol>
          <p className="mt-4 text-sm leading-6 text-[#4a3b28]">
            No faucet. No points. Just lift and post. {project.ticker} · {project.siteUrl.replace(/^https:\/\//, "")}
          </p>
        </div>
      </div>

      <MemeCarousel items={memes} />

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <HouseButton variant="primary" href={links.telegram} target="_blank">
          <TelegramMark size={15} />
          Dump it in the kennel
        </HouseButton>
        <HouseButton href="/#adopt">Adopt the rock</HouseButton>
        <p className="serif max-w-lg text-lg text-[var(--dim)]">
          Official kennel is Telegram. Bring the stolen goods. Leave the original thought at home.
        </p>
      </div>
    </section>
  );
}
