import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-xl flex-col items-center justify-center px-4 text-center">
      <p className="text-sm font-semibold text-primary">404</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">That page may have moved or the address may be incorrect.</p>
      <Button className="mt-5" render={<Link href="/" />}>Go to CareerOS</Button>
    </main>
  );
}
