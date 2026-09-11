"use client";

import { useState } from "react";
import { Mascot } from "./Mascot";

const tricks = [
  { id: "sit", label: "Sit", line: "The rock sat. It was already sitting. Still counts." },
  { id: "stay", label: "Stay", line: "It did not move. That is its entire personality." },
  { id: "rollover", label: "Roll over", line: "One revolution. Now it is dizzy and richer in theory." },
  { id: "fetch", label: "Fetch", line: "It went for the WBTC. Dignity remains intact-ish." },
  { id: "stack", label: "Stack", line: "Coins appeared. The rock approved this meeting." },
] as const;

type TrickId = (typeof tricks)[number]["id"] | "idle";

export function TrainYourRock() {
  const [trick, setTrick] = useState<TrickId>("idle");
  const [line, setLine] = useState("Teach the rock nothing. It already does something.");

  return (
    <section id="train" className="section pt-0">
      <div className="glass-panel rounded-[32px] p-6 sm:p-10">
        <p className="kicker">Optional enrichment</p>
        <h2 className="display mt-3 text-6xl text-white sm:text-7xl">Train your rock</h2>
        <p className="mt-3 max-w-xl text-sm text-[var(--dim)]">
          A shareable parlor trick. It does not affect rewards, eligibility, or the official market.
        </p>
        <div className="mt-8 grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <Mascot
            size="stage"
            trick={trick === "idle" ? "idle" : trick}
            stacked={trick === "stack" ? 3 : 0}
            dropping={trick === "fetch"}
          />
          <div>
            <div className="flex flex-wrap gap-2">
              {tricks.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`btn ${trick === item.id ? "btn-primary" : "btn-ghost"} min-h-11`}
                  onClick={() => {
                    setTrick(item.id);
                    setLine(item.line);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <p className="serif mt-6 text-2xl text-[var(--cream)]">{line}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
