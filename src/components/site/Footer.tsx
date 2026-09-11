import { project } from "@/lib/config";
import { visibleLinks } from "@/lib/links";

export function Footer() {
  return (
    <footer className="relative z-1 border-t border-[rgba(232,210,176,0.08)] py-10">
      <div className="mx-auto flex w-[min(1120px,calc(100%-1.5rem))] flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="display text-3xl">{project.name}</p>
          <p className="mt-1 text-xs tracking-[0.2em] uppercase text-[var(--gold)]">
            {project.ticker} · {project.coreLine}
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-xs tracking-[0.16em] uppercase text-[var(--dim)]">
          {visibleLinks().map((item) => (
            <a key={item.label} href={item.href} className="hover:text-white">
              {item.label}
            </a>
          ))}
          <a href="#adopt" className="hover:text-white">
            Adopt
          </a>
        </div>
      </div>
    </footer>
  );
}
