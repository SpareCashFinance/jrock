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
  { href: "/#tape", label: "The tape" },
  { href: "/#burn", label: "Burn" },
  { href: "/#rewards", label: "Rewards" },
  { href: "/#train", label: "Train" },
  { href: "/#rockonomics", label: "Rockonomics" },
];

export function Header() {
  return (
    <div className="relative z-10 mx-auto w-[min(1120px,calc(100%-1.5rem))] pt-5 pb-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <a href="/" aria-label={project.name} className="flex min-w-0 items-center gap-2">
          <BrandMark size={36} className="shrink-0 border border-[rgba(247,147,26,0.35)]" />
          <span className="display text-3xl leading-none text-[var(--gold)]">{project.ticker}</span>
        </a>
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton value={project.mint} label="Contract" className="px-3 text-xs" />
          <WalletControls compact />
          <AdoptButton idleLabel="Connect wallet" connectedLabel="Adopt $JROCK" />
        </div>
      </div>
      <nav className="mt-4 flex flex-wrap items-center gap-1 text-xs font-medium text-[var(--dim)]">
        {nav.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="rounded-full px-3 py-1.5 hover:bg-white/5 hover:text-white"
          >
            {item.label}
          </a>
        ))}
        {socialLinks().map((item) => (
          <SocialIconLink
            key={item.kind}
            kind={item.kind}
            href={item.href}
            label={item.label}
            className="size-8"
          />
        ))}
      </nav>
    </div>
  );
}
