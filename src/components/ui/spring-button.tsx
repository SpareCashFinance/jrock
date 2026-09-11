"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/utils";

const spring = { type: "spring" as const, stiffness: 420, damping: 28 };

export function SpringButton({
  className,
  children,
  ...props
}: HTMLMotionProps<"button">) {
  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={spring}
      className={cn("btn", className)}
      {...props}
    >
      {children}
    </motion.button>
  );
}
