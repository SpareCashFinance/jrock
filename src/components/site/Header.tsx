import { project } from "@/lib/config";
import { socialLinks } from "@/lib/links";
import { BrandMark } from "@/components/brand/BrandMark";
import { SocialIconLink } from "@/components/brand/SocialMarks";
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
    <header className="sticky z-40 px-3" style={{ top: "var(--tape-h)" }}>
      <div className="dock mx-auto flex w-[min(1120px,calc(100%-0.5rem))] items-center justify-between gap-2 rounded-full px-2 py-1.5 sm:gap-3 sm:px-3 sm:py-2">
        <a href="#top" className="flex min-w-0 items-center gap-2 sm:gap-3">
          <BrandMark size={32} className="shrink-0 border border-[rgba(247,147,26,0.35)] sm:h-9 sm:w-9" />
          <span className="min-w-0">
            <span className="display hidden text-2xl leading-none sm:block">{project.name}</span>
            <span className="flex items-center gap-1.5 text-[11px] tracking-[0.18em] text-[var(--gold)] sm:tracking-[0.22em]">
              {project.ticker}
              <BrandMark size={14} className="hidden sm:inline-block" />
            </span>
          </span>
        </a>
        <nav className="hidden items-center gap-1 text-xs font-medium text-[var(--dim)] md:flex">
          {nav.map((item) => (
            <a key={item.href} href={item.href} className="rounded-full px-3 py-1.5 hover:bg-white/5 hover:text-white">
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {socialLinks().map((item) => (
            <SocialIconLink
              key={item.kind}
              kind={item.kind}
              href={item.href}
              label={item.label}
              className="size-8 sm:size-9"
            />
          ))}
          <div className="hidden md:block">
            <CopyButton value={project.mint} label="Copy" className="px-3 text-xs" />
          </div>
          <WalletControls compact />
          <AdoptButton idleLabel="Connect wallet" connectedLabel="Adopt $JROCK" compact />
        </div>
      </div>
    </header>
  );
}
