import { HouseButton } from "@/components/ui/house-button";

export default function NotFound() {
  return (
    <main className="relative z-1 mx-auto flex min-h-screen w-[min(720px,calc(100%-1.5rem))] flex-col items-center justify-center py-20 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/mascot.jpg"
        alt="Jamie’s Pet Rock looking unimpressed"
        width={280}
        height={280}
        className="mb-8 aspect-square max-w-[60vw] rounded-full border border-[rgba(247,147,26,0.35)] object-cover"
      />
      <p className="kicker">404 · Rock not found</p>
      <h1 className="display mt-3 text-6xl text-white">This rock wandered off.</h1>
      <p className="serif mt-4 max-w-md text-xl text-[var(--cream)]">
        No exhibit in this drawer. The official kennel is still one click away.
      </p>
      <HouseButton variant="primary" href="/" className="mt-8">
        Take me home
      </HouseButton>
    </main>
  );
}
