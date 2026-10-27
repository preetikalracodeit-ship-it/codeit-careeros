"use client";

import { Button } from "@/components/ui/button";

export default function Error({ retry }) {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-xl flex-col items-center justify-center px-4 text-center">
      <h1 className="text-xl font-semibold">This page couldn&apos;t load</h1>
      <p className="mt-2 text-sm text-muted-foreground">Try again. If the problem continues, return to the page later.</p>
      <Button className="mt-5" onClick={() => retry()}>Try again</Button>
    </main>
  );
}
