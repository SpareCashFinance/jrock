import { copy } from "@/lib/config";
import { LiquidSurface } from "@/components/brand/LiquidSurface";
import { HouseButton } from "@/components/ui/house-button";

export function RewardExplainer() {
  return (
    <section className="section pt-0" id="how">
      <LiquidSurface intensity="panel" radius={32} className="rounded-[32px]">
        <div className="p-6 sm:p-10">
        <p className="kicker">How the rock gets paid</p>
        <h2 className="display mt-3 text-5xl text-white sm:text-7xl">
          Three steps. Zero promises.
        </h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {copy.steps.map((step) => (
            <article key={step.n} className="border-t border-[rgba(247,147,26,0.28)] pt-5">
              <p className="font-mono text-sm text-[var(--orange)]">{step.n}</p>
              <h3 className="display mt-2 text-4xl">{step.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--dim)]">{step.body}</p>
            </article>
          ))}
        </div>
        <ul className="mt-8 grid gap-2 text-sm text-[var(--cream)] sm:grid-cols-2">
          {copy.caveats.map((line) => (
            <li key={line} className="flex gap-2">
              <span className="text-[var(--orange)]">▸</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <HouseButton variant="primary" href="#adopt" className="mt-8">
          Adopt $JROCK
        </HouseButton>
        </div>
      </LiquidSurface>
    </section>
  );
}
