import { PriceTape } from "./PriceTape";
import { BurnRibbon } from "./BurnFlame";
import type { BurnSnapshot } from "@/lib/burn";
import type { PriceTapeSnapshot } from "@/lib/tape";

export function SiteTapes({
  tape,
  burn,
}: {
  tape: PriceTapeSnapshot;
  burn: BurnSnapshot;
}) {
  return (
    <div className="sticky top-0 z-50">
      <PriceTape initial={tape} />
      <BurnRibbon initial={burn} />
    </div>
  );
}
