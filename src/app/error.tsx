"use client";

import { buttonVariants } from "@/components/ui/button";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Something went wrong
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        An unexpected error occurred. You can try again, or head back once
        you&apos;ve had a moment.
      </p>
      <button onClick={() => reset()} className={buttonVariants({ variant: "default" })}>
        Try again
      </button>
    </div>
  );
}
