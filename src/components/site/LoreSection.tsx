import { copy } from "@/lib/config";
import { SpotlightCard } from "@/components/react-bits/SpotlightCard";

export function LoreSection() {
  return (
    <section className="section" id="lore">
      <p className="kicker">Board minutes</p>
      <h2 className="display mt-3 text-6xl text-white sm:text-8xl">
        Wall Street mocked the rock.
        <span className="block text-[var(--orange)]">The rock kept stacking.</span>
      </h2>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {copy.story.map((beat, index) => (
          <SpotlightCard
            key={beat.stamp}
            className="group cardboard unfold rounded-[28px] p-6"
            style={{ animationDelay: `${index * 90}ms` }}
          >
            <p className="text-xs tracking-[0.22em] uppercase">{beat.stamp} / PET ROCK MEMO</p>
            <h3 className="serif mt-6 text-3xl leading-tight">{beat.title}</h3>
            <p className="mt-4 text-sm leading-6 text-[#4a3b28]">{beat.body}</p>
          </SpotlightCard>
        ))}
      </div>
    </section>
  );
}
