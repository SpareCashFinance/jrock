"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/utils";

const spring = { type: "spring" as const, stiffness: 460, damping: 26 };

type HouseButtonProps = {
  variant?: "primary" | "ghost";
  href?: string;
  target?: string;
  rel?: string;
} & Omit<HTMLMotionProps<"button">, "href">;

export function HouseButton({
  variant = "ghost",
  href,
  target,
  rel,
  className,
  children,
  ...props
}: HouseButtonProps) {
  const classes = cn("btn lh-shine", variant === "primary" ? "btn-primary" : "btn-ghost", className);
  const motionProps = {
    whileHover: { scale: 1.045, y: -1 },
    whileTap: { scale: 0.96 },
    transition: spring,
    className: classes,
  };

  if (href) {
    return (
      <motion.a
        href={href}
        target={target}
        rel={rel ?? (target === "_blank" ? "noreferrer" : undefined)}
        {...motionProps}
      >
        {children}
      </motion.a>
    );
  }

  return (
    <motion.button type="button" {...motionProps} {...props}>
      {children}
    </motion.button>
  );
}
