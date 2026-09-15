import { project } from "@/lib/config";
import { socialLinks } from "@/lib/links";
import { BrandMark } from "@/components/brand/BrandMark";
import { SocialIconLink } from "@/components/brand/SocialMarks";
import { AdoptButton, WalletControls } from "@/components/solana/AdoptButton";
import { CopyButton } from "./CopyButton";

const nav: { href: string; label: string }[] = [
  { href: "/#adopt", label: "Adopt" },
  { href: "/memes", label: "Memes" },
  { href: "/lotto", label: "Lotto" },
  { href: "/#tape", label: "Tape" },
  { href: "/#burn", label: "Burn" },
  { href: "/#rewards", label: "Rewards" },
  { href: "/#train", label: "Train" },
  { href: "/#rockonomics", label: "Rockonomics" },
];

export function Header() {
  return (
    <div className="relative z-10 mx-auto w-[min(1120px,calc(100%-1.5rem))] pt-4 pb-2">
      <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <a href="/" aria-label={project.name} className="flex shrink-0 items-center gap-2">
          <BrandMark size={32} className="shrink-0 border border-[rgba(247,147,26,0.35)]" />
          <span className="display text-2xl leading-none text-[var(--gold)]">{project.ticker}</span>
        </a>
        <nav className="flex shrink-0 items-center text-[11px] font-medium text-[var(--dim)]">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-full px-2 py-1.5 hover:bg-white/5 hover:text-white"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex shrink-0 items-center gap-1">
          {socialLinks().map((item) => (
            <SocialIconLink
              key={item.kind}
              kind={item.kind}
              href={item.href}
              label={item.label}
              className="size-8"
            />
          ))}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <CopyButton value={project.mint} label="Contract" className="px-3 text-xs" />
          <WalletControls compact />
          <AdoptButton idleLabel="Connect wallet" connectedLabel="Adopt $JROCK" compact />
        </div>
      </div>
    </div>
  );
}
