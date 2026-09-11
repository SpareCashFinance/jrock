import { project } from "@/lib/config";
import { AdoptButton, WalletControls } from "@/components/solana/AdoptButton";
import { CopyButton } from "./CopyButton";

const nav = [
  { href: "#adopt", label: "Adopt" },
  { href: "#tape", label: "The tape" },
  { href: "#rewards", label: "Rewards" },
  { href: "#train", label: "Train" },
  { href: "#rockonomics", label: "Rockonomics" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-[rgba(232,210,176,0.08)] bg-[#060a12]/80 backdrop-blur-xl">
      <div className="mx-auto flex w-[min(1120px,calc(100%-1.5rem))] items-center justify-between gap-3 py-3">
        <a href="#top" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-full border border-[rgba(247,147,26,0.35)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mascot.jpg" alt="" width={40} height={40} className="h-full w-full object-cover" />
          </span>
          <span>
            <span className="display block text-2xl leading-none">{project.name}</span>
            <span className="text-[11px] tracking-[0.22em] text-[var(--gold)]">
              {project.ticker}
            </span>
          </span>
        </a>
        <nav className="hidden items-center gap-5 text-xs font-medium text-[var(--dim)] md:flex">
          {nav.map((item) => (
            <a key={item.href} href={item.href} className="hover:text-white">
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <CopyButton
            value={project.mint}
            label="Copy"
            className="btn btn-ghost hidden px-3 text-xs sm:inline-flex"
          />
          <WalletControls compact />
          <AdoptButton
            className="px-3 text-xs"
            idleLabel="Connect wallet"
            connectedLabel="Adopt $JROCK"
          />
        </div>
      </div>
    </header>
  );
}
