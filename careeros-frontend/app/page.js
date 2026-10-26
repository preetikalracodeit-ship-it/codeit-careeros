import Link from "next/link";
import { ArrowRight, ArrowUpRight, GraduationCap, Sparkles } from "lucide-react";
import { LogoWordmark } from "@/components/logo";
import { Navbar } from "@/components/navbar";
import { Reveal } from "@/components/reveal";
import { HeroSection } from "@/components/home/hero-scroll";
import { PathSection } from "@/components/home/features-scroll";
import { JourneySection } from "@/components/home/journey-scroll";
import { CtaSection } from "@/components/home/cta-scroll";

const footerExploreLinks = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
];

const footerAccountLinks = [
  { href: "/login", label: "Sign in" },
  { href: "/register", label: "Create free account" },
  { href: "/register", label: "Start career assessment" },
];

const footerLegalLinks = [
  { href: "/legal/privacy", label: "Privacy Policy" },
  { href: "/legal/terms", label: "Terms of Service" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <main>
        <HeroSection />
        <PathSection />
        <JourneySection />
        <CtaSection />
      </main>

      {/* Footer */}
      <footer className="relative overflow-hidden bg-pine-950 text-white">
        <div
          aria-hidden="true"
          className="h-1 bg-gradient-to-r from-brand-700 via-brand-400 to-brand-700"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(40rem 16rem at 50% -4rem, oklch(0.65 0.165 148 / 0.22), transparent 65%)",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 pt-14 pb-8">
          <Reveal variant="sm">
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.3fr]">
            <div>
              <LogoWordmark size="text-lg" tone="light" />
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-pine-200">
                Assess your skills, close the gaps that matter and prove you&apos;re
                ready — assessments, roadmaps, projects and reports, all in one place.
              </p>
              <span className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-brand-200">
                <GraduationCap className="size-3.5" aria-hidden="true" />
                Free for students
              </span>
            </div>

            <nav aria-label="Explore">
              <h3 className="text-xs font-bold tracking-widest text-brand-300 uppercase">
                Explore
              </h3>
              <ul className="mt-4 space-y-2.5 text-sm">
                {footerExploreLinks.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="group inline-flex items-center gap-1 text-pine-200 transition hover:text-white"
                    >
                      {link.label}
                      <ArrowUpRight
                        className="size-3.5 opacity-0 transition-all group-hover:translate-x-px group-hover:opacity-100"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-label="Account">
              <h3 className="text-xs font-bold tracking-widest text-brand-300 uppercase">
                Get started
              </h3>
              <ul className="mt-4 space-y-2.5 text-sm">
                {footerAccountLinks.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="group inline-flex items-center gap-1 text-pine-200 transition hover:text-white"
                    >
                      {link.label}
                      <ArrowUpRight
                        className="size-3.5 opacity-0 transition-all group-hover:translate-x-px group-hover:opacity-100"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="h-fit rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <h3 className="text-base font-bold tracking-tight">
                Ready to know where you stand?
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-pine-200">
                Create your free account and take your first career assessment today.
              </p>
              <Link
                href="/register"
                className="btn-polish mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-pine-950 shadow-md hover:bg-brand-100 active:translate-y-px"
              >
                Create free account
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
          </Reveal>

          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-[13px] text-pine-300 sm:flex-row">
            <p>© {new Date().getFullYear()} CODEIT CareerOS. All rights reserved.</p>
            <nav aria-label="Legal">
              <ul className="flex items-center gap-4">
                {footerLegalLinks.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="transition hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <p className="inline-flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-brand-300" aria-hidden="true" />
              Test. Analyze. Improve. Become Industry Ready.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
