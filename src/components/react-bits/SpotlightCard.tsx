"use client";

import { useRef, type HTMLAttributes, type ReactNode } from "react";

type SpotlightCardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function SpotlightCard({
  children,
  className = "",
  ...props
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden ${className}`.trim()}
      onMouseMove={(event) => {
        const node = ref.current;
        if (!node) return;
        const box = node.getBoundingClientRect();
        node.style.setProperty("--spot-x", `${event.clientX - box.left}px`);
        node.style.setProperty("--spot-y", `${event.clientY - box.top}px`);
      }}
      {...props}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(320px circle at var(--spot-x, 50%) var(--spot-y, 20%), rgba(247,147,26,0.16), transparent 55%)",
        }}
      />
      {children}
    </div>
  );
}
