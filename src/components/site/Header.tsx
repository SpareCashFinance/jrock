import { project } from "@/lib/config";
import { socialLinks } from "@/lib/links";
import { BrandMark } from "@/components/brand/BrandMark";
import { SocialIconLink } from "@/components/brand/SocialMarks";
import { AdoptButton, WalletControls } from "@/components/solana/AdoptButton";
import { HouseButton } from "@/components/ui/house-button";
import { CopyButton } from "./CopyButton";

const nav: { href: string; label: string; show?: string }[] = [
  { href: "/#adopt", label: "Adopt" },
  { href: "/memes", label: "Memes" },
  { href: "/#tape", label: "The tape" },
  { href: "/#burn", label: "Burn" },
  { href: "/#rewards", label: "Rewards", show: "lg" },
  { href: "/#train", label: "Train", show: "xl" },
  { href: "/#rockonomics", label: "Rockonomics", show: "xl" },
];

export function Header() {
  return (
    <header className="sticky z-40 px-3" style={{ top: "var(--tape-h)" }}>
      <div className="dock mx-auto flex w-[min(1120px,calc(100%-0.5rem))] items-center justify-between gap-2 rounded-full px-2 py-1.5 sm:gap-3 sm:px-3 sm:py-2">
        <a
          href="/"
          aria-label={project.name}
          className="flex min-w-0 items-center gap-2"
        >
          <BrandMark size={32} className="shrink-0 border border-[rgba(247,147,26,0.35)] sm:h-9 sm:w-9" />
          <span className="display whitespace-nowrap text-[1.65rem] leading-none text-[var(--gold)] sm:text-2xl">
            {project.ticker}
          </span>
        </a>
        <nav className="hidden items-center gap-0.5 text-xs font-medium text-[var(--dim)] lg:gap-1 md:flex">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`shrink-0 whitespace-nowrap rounded-full px-2 py-1.5 hover:bg-white/5 hover:text-white lg:px-3 ${
                item.show === "xl" ? "hidden xl:inline" : item.show === "lg" ? "hidden lg:inline" : ""
              }`}
            >
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
          <div className="md:hidden">
            <HouseButton href="/memes" className="px-3 text-xs">
              Memes
            </HouseButton>
          </div>
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
