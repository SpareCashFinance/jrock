import { project } from "@/lib/config";
import { AdoptButton, WalletControls } from "@/components/solana/AdoptButton";
import { CopyButton } from "./CopyButton";

const nav = [
  { href: "#adopt", label: "Adopt" },
  { href: "#tape", label: "The tape" },
  { href: "#burn", label: "Burn" },
  { href: "#rewards", label: "Rewards" },
  { href: "#train", label: "Train" },
  { href: "#rockonomics", label: "Rockonomics" },
];

export function Header() {
  return (
    <header className="sticky top-[34px] z-40 px-3">
      <div className="dock mx-auto flex w-[min(1120px,calc(100%-0.5rem))] items-center justify-between gap-3 rounded-full px-3 py-2">
        <a href="#top" className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-[rgba(247,147,26,0.35)] bg-[#060a12]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mascot.jpg" alt="" width={36} height={36} className="h-[78%] w-[78%] object-contain" />
          </span>
          <span>
            <span className="display block text-2xl leading-none">{project.name}</span>
            <span className="text-[11px] tracking-[0.22em] text-[var(--gold)]">{project.ticker}</span>
          </span>
        </a>
        <nav className="hidden items-center gap-1 text-xs font-medium text-[var(--dim)] md:flex">
          {nav.map((item) => (
            <a key={item.href} href={item.href} className="rounded-full px-3 py-1.5 hover:bg-white/5 hover:text-white">
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <CopyButton value={project.mint} label="Copy" className="hidden px-3 text-xs sm:inline-flex" />
          <WalletControls compact />
          <AdoptButton idleLabel="Connect wallet" connectedLabel="Adopt $JROCK" />
        </div>
      </div>
    </header>
  );
}
