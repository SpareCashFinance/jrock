import { DexTape } from "./DexTape";
import { Mascot } from "./Mascot";

export function ExhibitTape() {
  return (
    <section className="section">
      <div className="mb-8 grid items-end gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="kicker">Exhibit A · Filed upstairs</p>
          <h2 className="display mt-3 max-w-3xl text-6xl text-white [word-spacing:0.16em] sm:text-8xl">
            He said it on television.
            <span className="block text-[var(--orange)]">We incorporated the rock.</span>
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-6 text-[var(--dim)]">
            The insult is the lore. The clip next to Adopt is filed as evidence, not
            endorsement. Independent parody. No affiliation with the people or networks shown.
          </p>
        </div>
        <div className="relative">
          <div className="absolute left-2 top-2 z-20 hidden rotate-[-8deg] rounded bg-[#c0392b] px-3 py-1 text-[11px] font-bold tracking-[0.18em] text-white shadow-lg lg:block">
            ENTERED
          </div>
          <Mascot size="stage" />
          <div className="cardboard mt-4 rounded-3xl p-5">
            <p className="text-[11px] tracking-[0.2em] uppercase">Rock&apos;s filing</p>
            <p className="serif mt-2 text-2xl">Same rock. Higher standards.</p>
            <p className="mt-2 text-sm leading-6 text-[#4a3b28]">
              They said Bitcoin does nothing. Eligible $JROCK holders may receive
              variable WBTC from a 3% pump.fun Holder Rewards fee. That is the entire punchline.
            </p>
          </div>
        </div>
      </div>

      <DexTape />
    </section>
  );
}
