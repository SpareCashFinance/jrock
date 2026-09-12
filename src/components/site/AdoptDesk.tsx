import { AdoptSwap } from "@/components/solana/AdoptSwap";
import { OriginTape } from "./OriginTape";

export function AdoptDesk() {
  return (
    <section id="adopt" className="section py-6">
      <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,400px)]">
        <div className="min-h-0 min-w-0">
          <OriginTape />
        </div>
        <div className="min-w-0">
          <AdoptSwap embedded />
        </div>
      </div>
    </section>
  );
}
