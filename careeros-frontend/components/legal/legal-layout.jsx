"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LogoWordmark } from "@/components/logo";

const LAST_UPDATED = "October 26, 2026";

const defaultMDX = {
  h1: (props) => <h1 className="text-2xl font-bold tracking-tight text-foreground" {...props} />,
  h2: (props) => <h2 className="mt-10 text-xl font-semibold tracking-tight text-foreground" {...props} />,
  h3: (props) => <h3 className="mt-8 text-lg font-semibold tracking-tight text-foreground" {...props} />,
  p: (props) => <p className="leading-relaxed text-muted-foreground" {...props} />,
  a: (props) => <a className="font-medium text-brand-600 underline decoration-brand-300/40" {...props} />,
  ul: (props) => <ul className="my-4 list-disc space-y-1 pl-6 text-muted-foreground" {...props} />,
  ol: (props) => <ol className="my-4 list-decimal space-y-1 pl-6 text-muted-foreground" {...props} />,
  li: (props) => <li className="leading-relaxed" {...props} />,
  strong: (props) => <strong className="font-semibold text-foreground" {...props} />,
  em: (props) => <em className="italic text-foreground" {...props} />,
  blockquote: (props) => (
    <blockquote className="mt-6 border-l-4 border-brand-500 pl-4 italic text-muted-foreground" {...props} />
  ),
  code: (props) => <code className="relative text-sm font-mono bg-muted/60 px-1.5 py-0.5 rounded text-foreground" {...props} />,
};

export function LegalLayout({ title, subtitle, lastUpdated = LAST_UPDATED, children }) {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto w-full max-w-4xl flex-1 px-6 pt-12 md:px-12">
        <header className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-500">Policy</p>
          <LogoWordmark size="text-2xl" className="mt-2" />
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground md:text-4xl">{title}</h1>
          {subtitle && <p className="mx-auto mt-3 max-w-2xl text-base text-muted-foreground">{subtitle}</p>}
          <p className="mt-2 text-sm text-muted-foreground/80">Last updated: {lastUpdated}</p>
        </header>

        <div className="mx-auto mt-12 w-full max-w-3xl">
          <Markdown remarkPlugins={[remarkGfm]} components={defaultMDX}>
            {children}
          </Markdown>
        </div>
      </div>

      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} CODEIT CareerOS. All rights reserved.
      </footer>
    </main>
  );
}
