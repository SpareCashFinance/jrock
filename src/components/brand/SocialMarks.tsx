import { cn } from "@/lib/utils";

type MarkProps = {
  size?: number;
  className?: string;
};

export function TelegramMark({ size = 16, className }: MarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"
      />
    </svg>
  );
}

export function XMark({ size = 16, className }: MarkProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.725-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"
      />
    </svg>
  );
}

export type SocialKind = "telegram" | "x";

export function SocialMark({ kind, size = 16, className }: MarkProps & { kind: SocialKind }) {
  return kind === "telegram" ? (
    <TelegramMark size={size} className={className} />
  ) : (
    <XMark size={size} className={className} />
  );
}

export function SocialIconLink({
  kind,
  href,
  label,
  size = 16,
  className,
}: {
  kind: SocialKind;
  href: string;
  label: string;
  size?: number;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-[rgba(232,210,176,0.22)] bg-[rgba(12,19,32,0.55)] text-[var(--cream)] hover:border-[rgba(247,147,26,0.55)] hover:bg-[rgba(247,147,26,0.1)] hover:text-white",
        className,
      )}
    >
      <SocialMark kind={kind} size={size} />
    </a>
  );
}
