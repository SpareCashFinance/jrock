"use client";

import { useRef, type HTMLAttributes, type ReactNode } from "react";

type MagnetProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  strength?: number;
  disabled?: boolean;
};

export function Magnet({
  children,
  strength = 12,
  disabled,
  className = "",
  ...props
}: MagnetProps) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      className={`inline-flex will-change-transform ${className}`.trim()}
      onMouseMove={(event) => {
        if (disabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          return;
        }
        const node = ref.current;
        if (!node) return;
        const box = node.getBoundingClientRect();
        const x = ((event.clientX - box.left) / box.width - 0.5) * strength;
        const y = ((event.clientY - box.top) / box.height - 0.5) * strength;
        node.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      }}
      onMouseLeave={() => {
        if (ref.current) ref.current.style.transform = "translate3d(0,0,0)";
      }}
      {...props}
    >
      {children}
    </div>
  );
}
