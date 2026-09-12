import { project } from "@/lib/config";
import { shareOnXUrl, socialLinks, visibleLinks } from "@/lib/links";
import { BrandMark } from "@/components/brand/BrandMark";
import { SocialIconLink, SocialMark, XMark } from "@/components/brand/SocialMarks";
import { HouseButton } from "@/components/ui/house-button";
import { CopyButton } from "./CopyButton";

export function CommunityLinks() {
  const items = visibleLinks();
  const socials = socialLinks();
  return (
    <section id="community" className="section pt-0">
      <p className="kicker">Kennel club</p>
      <h2 className="display mt-3 text-6xl text-white sm:text-7xl">Take the rock with you.</h2>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        {socials.map((item) => (
          <SocialIconLink key={item.kind} kind={item.kind} href={item.href} label={item.label} />
        ))}
        {items.map((item) => (
          <HouseButton key={item.label} href={item.href} target="_blank">
            {item.kind ? <SocialMark kind={item.kind} size={15} /> : null}
            {item.label}
          </HouseButton>
        ))}
        <HouseButton href={shareOnXUrl()} target="_blank">
          <XMark size={14} />
          Share on X
        </HouseButton>
        <CopyButton value={project.mint} />
      </div>
      <p className="serif mt-6 max-w-xl text-xl text-[var(--cream)]">
        “Jamie said Bitcoin was a pet rock. Mine pays me in WBTC.{" "}
        <BrandMark size={22} />”
      </p>
    </section>
  );
}
