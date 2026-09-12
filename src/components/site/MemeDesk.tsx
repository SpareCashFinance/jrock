"use client";

import { useState } from "react";
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
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <HouseButton onClick={copyCaption} className="px-3 text-xs">
          {flash === "caption" ? "Copied" : "Copy caption"}
        </HouseButton>
        <HouseButton onClick={copyImage} className="px-3 text-xs">
          {flash === "image" ? "Copied" : "Copy image"}
        </HouseButton>
        <HouseButton onClick={saveImage} className="px-3 text-xs">
          {flash === "saved" ? "Saved" : "Save"}
        </HouseButton>
        <HouseButton href={shareMemeOnXUrl(meme.caption)} target="_blank" className="px-3 text-xs">
          <XMark size={13} />
          Post on X
        </HouseButton>
      </div>
      <p className="min-h-4 text-[11px] tracking-[0.12em] uppercase text-[var(--gold)]" aria-live="polite">
        {status}
      </p>
    </div>
  );
}

export function MemeDesk() {
  return (
    <section className="section pb-16 pt-8">
      <div className="mb-10 grid items-end gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className="kicker">Evidence locker · free to lift</p>
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
            <li>03 · Hit Post on X, then paste or attach the picture.</li>
            <li>04 · Drop extras in the kennel.</li>
          </ol>
          <p className="mt-4 text-sm leading-6 text-[#4a3b28]">
            No faucet. No points. Just lift and post. {project.ticker} · {project.siteUrl.replace(/^https:\/\//, "")}
          </p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {memes.map((meme) => (
          <article key={meme.id} className="glass-panel flex flex-col overflow-hidden rounded-[28px]">
            <div className="relative bg-[#070b12]">
              <span className="absolute left-3 top-3 z-10 rounded-full bg-[#c0392b] px-2.5 py-1 text-[10px] font-bold tracking-[0.18em] text-white">
                {meme.stamp}
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={meme.src}
                alt={meme.alt}
                width={1024}
                height={1024}
                className="aspect-square w-full object-cover"
              />
            </div>
            <div className="flex flex-1 flex-col gap-4 p-5">
              <p className="serif text-xl leading-7 text-[var(--cream)]">{meme.caption}</p>
              <p className="text-[11px] tracking-[0.16em] uppercase text-[var(--gold)]">{project.ticker}</p>
              <div className="mt-auto">
                <MemeActions meme={meme} />
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-12 flex flex-wrap items-center gap-3">
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
