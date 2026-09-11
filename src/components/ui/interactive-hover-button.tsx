"use client";

import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function InteractiveHoverButton({
  children,
  className,
  href,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: string }) {
  const classes = cn(
    "group relative inline-flex h-11 cursor-pointer items-center overflow-hidden rounded-full border border-[rgba(232,210,176,0.22)] bg-[rgba(12,19,32,0.55)] px-6 text-sm font-semibold text-[var(--cream)] backdrop-blur-xl",
    className,
  );
  const inner = (
    <>
      <span className="inline-flex items-center gap-2 transition-all duration-300 group-hover:translate-x-8 group-hover:opacity-0">
        <span className="size-2 rounded-full bg-[var(--orange)]" />
        {children}
      </span>
      <span className="absolute inset-0 z-10 flex translate-x-8 items-center justify-center gap-2 bg-[var(--orange)] text-[#1a0f04] opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100">
        {children}
        <ArrowRight className="size-4" />
      </span>
    </>
  );

  if (href) {
    return (
      <a href={href} className={classes}>
        {inner}
      </a>
    );
  }

  return (
    <button type="button" className={classes} {...props}>
      {inner}
    </button>
  );
}
