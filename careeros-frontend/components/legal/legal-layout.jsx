"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LogoWordmark } from "@/components/logo";

const LAST_UPDATED = "October 26, 2026";

const defaultMDX = {
  h1: (props) => (
    <h1
      className={
        "scroll-mt-10 text-2xl font-bold tracking-tight text-foreground border-b border-border/40 pb-5 first:mt-0"
      }
      {...props}
    />
  ),
  h2: (props) => (
    <h2
      className={
        "scroll-mt-8 mt-11 text-2xl font-bold tracking-tight text-foreground border-b border-border/30 pb-3 first:mt-0"
      }
      {...props}
    />
  ),
  h3: (props) => (
    <h3 className="mt-8 text-xl font-semibold tracking-tight text-foreground" {...props} />
  ),
  p: (props) => <p className="my-5 leading-relaxed text-muted-foreground" {...props} />,
  a: (props) => (
    <a
      className={
        "font-medium text-brand-600 underline underline-offset-2 decoration-brand-300/40 transition hover:text-brand-700"
      }
      {...props}
    />
  ),
  ul: (props) => <ul className="my-5 list-disc space-y-2 pl-6 text-muted-foreground" {...props} />,
  ol: (props) => <ol className="my-5 list-decimal space-y-2 pl-6 text-muted-foreground" {...props} />,
  li: (props) => <li className="leading-relaxed" {...props} />,
  strong: (props) => <strong className="font-semibold text-foreground" {...props} />,
  em: (props) => <em className="italic text-foreground" {...props} />,
  blockquote: (props) => (
    <blockquote className="my-6 border-l-4 border-brand-500/40 bg-brand-50/40 pl-4 italic text-muted-foreground rounded-r-md" {...props} />
  ),
  code: (props) => (
    <code
      className={
        "relative text-sm font-mono bg-muted/60 px-1.5 py-0.5 rounded text-foreground"
      }
      {...props}
    />
  ),
  pre: (props) => (
    <pre
      className={
        "my-4 overflow-x-auto rounded-lg bg-muted/40 p-4 text-sm leading-relaxed text-foreground"
      }
      {...props}
    />
  ),
  table: (props) => <table className="my-4 w-full border-collapse text-sm" {...props} />,
  th: (props) => (
    <th
      className={
        "border border-border/70 px-3 py-2 text-left font-semibold text-foreground"
      }
      {...props}
    />
  ),
  td: (props) => (
    <td className="border border-border/60 px-3 py-2 text-muted-foreground" {...props} />
  ),
};

export function LegalLayout({ title, subtitle, lastUpdated = LAST_UPDATED, children }) {
  return (
    <main className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto w-full max-w-4xl flex-1 px-6 pt-12 md:px-12">
        <header className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-500">Policy</p>
          <LogoWordmark size="text-2xl" className="mt-2" />
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground md:text-4xl">{title}</h1>
          {subtitle && <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">{subtitle}</p>}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
              Last updated {lastUpdated}
            </span>
          </div>
        </header>

        <div className="mx-auto mt-10 w-full max-w-3xl rounded-2xl border border-border/60 bg-card/80 p-8 shadow-sm shadow-black/5 md:p-10">
          <Markdown remarkPlugins={[remarkGfm]} components={defaultMDX}>
            {children}
          </Markdown>
        </div>
      </div>

      <footer className="relative mt-auto border-t border-border/60 py-8">
        <p className="text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} CODEIT CareerOS. All rights reserved.
        </p>
      </footer>
    </main>
  );
}
