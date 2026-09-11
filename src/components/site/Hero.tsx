"use client";

import { useState } from "react";
import { Magnet } from "@/components/react-bits/Magnet";
import SplitFlapText from "@/components/react-bits/SplitFlapText";
import { ChainMarks } from "@/components/brand/ChainMarks";
import { project } from "@/lib/config";
import { links } from "@/lib/links";
import { AdoptButton } from "@/components/solana/AdoptButton";
import { AnimatedShinyText } from "@/components/ui/animated-shiny-text";
import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";
import { CopyButton } from "./CopyButton";
import { Mascot } from "./Mascot";

export function Hero() {
  const [dropping, setDropping] = useState(false);

  return (
    <section
      id="top"
      data-mascot-stage
      className="relative z-1 mx-auto grid w-[min(1120px,calc(100%-1.5rem))] items-center gap-8 pb-10 pt-8 lg:grid-cols-[1.05fr_0.95fr] lg:pb-16 lg:pt-12"
    >
      <div className="order-2 space-y-6 lg:order-1">
        <AnimatedShinyText className="kicker mx-0 max-w-none text-[var(--gold)] dark:text-[var(--gold)] dark:via-[var(--orange)]">
          Solana · stonk.fun · WBTC holder rewards
        </AnimatedShinyText>
        <div className="overflow-x-auto pb-1">
          <SplitFlapText
            words={["JAMIE'S PET ROCK", "$JROCK", "PAYS IN WBTC"]}
            padTo={16}
            fontSize="clamp(22px, 5vw, 44px)"
            tileColor="#121820"
            textColor="#f4efe6"
            tileRadius={6}
            gap={4}
            flipDuration={0.1}
            stagger={0.035}
            cycleDelay={2800}
            flipsPerChar={4}
          />
        </div>
        <h1 className="display text-[clamp(2.6rem,8vw,5.6rem)] text-white">
          The pet rock
          <br />
          that pays in <span className="text-[var(--orange)]">Bitcoin.</span>
        </h1>
        <p className="serif max-w-xl text-xl text-[var(--cream)] sm:text-2xl">
          “{project.quote}”
        </p>
        <p className="max-w-lg text-sm leading-6 text-[var(--dim)]">
          A tradable parody of the pet-rock insult. Eligible $JROCK holders may
          receive variable WBTC through stonk.fun — not guaranteed, not a
          dividend, just the rock doing something.
        </p>
        <div className="flex flex-wrap gap-3">
          <Magnet>
            <span
              onMouseEnter={() => setDropping(true)}
              onMouseLeave={() => setDropping(false)}
            >
              <AdoptButton shine />
            </span>
          </Magnet>
          <InteractiveHoverButton href="#rewards">View WBTC rewards</InteractiveHoverButton>
          <InteractiveHoverButton href="#tape">Watch the tape</InteractiveHoverButton>
          <CopyButton value={project.mint} />
        </div>
        <ChainMarks />
        <a href={links.stonkfun} className="inline-block text-[11px] tracking-[0.18em] uppercase text-[var(--stone)] hover:text-[var(--orange)]">
          Official market · stonk.fun
        </a>
      </div>
      <div className="order-1 lg:order-2">
        <Mascot dropping={dropping} />
      </div>
    </section>
  );
}
