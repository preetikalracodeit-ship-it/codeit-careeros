"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  Award,
  BadgeCheck,
  BookOpen,
  Briefcase,
  CheckCircle2,
  Circle,
  ExternalLink,
  Eye,
  FileText,
  GraduationCap,
  Lightbulb,
  ListChecks,
  Loader2,
  Route,
  Save,
  SearchCheck,
  Share2,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CircularProgress } from "@/components/ui/circular-progress";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Breadcrumb } from "@/components/breadcrumb";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Field } from "@/components/field";
import { LoadingState } from "@/components/loading-state";
import api from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { cn } from "cn";

/* LinkedIn brand glyph (lucide removed brand icons) — inline SVG keeps the authentic look. */
function LinkedInIcon({ className, ...props }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true" {...props}>
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z" />
    </svg>
  );
}

const emptyForm = {
  profileUrl: "",
  headline: "",
  about: "",
  currentRole: "",
  experienceText: "",
  skillsText: "",
  educationText: "",
};

function fromProfile(data) {
  if (!data) return { ...emptyForm };
  return {
    profileUrl: data.profileUrl || "",
    headline: data.headline || "",
    about: data.about || "",
    currentRole: data.currentRole || "",
    experienceText: data.experienceText || "",
    skillsText: data.skillsText || "",
    educationText: data.educationText || "",
  };
}

function isValidLinkedInUrl(raw) {
  const value = String(raw || "").trim();
  const withScheme = value.includes("://") ? value : `https://${value}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    if (!parsed.hostname.toLowerCase().endsWith("linkedin.com")) return false;
    return /^\/in\/[A-Za-z0-9_./%-]+\/?$/.test(parsed.pathname);
  } catch {
    return false;
  }
}

/* ── Friendly, student-first verdicts ─────────────────────────────── */
function matchVerdict(score, hasTarget) {
  if (!hasTarget)
    return {
      label: "Pick a career",
      hint: "Choose a target career and we'll compare your profile with exactly what employers ask for.",
      tone: "muted",
      grade: "—",
    };
  if (score >= 80)
    return {
      label: "Excellent match",
      hint: "Your profile already speaks this career's language. Add project links to prove it.",
      tone: "green",
      grade: "A",
    };
  if (score >= 60)
    return {
      label: "Strong & growing",
      hint: "Solid foundation — 2–3 focused additions will push you into shortlist territory.",
      tone: "green",
      grade: "B",
    };
  if (score >= 40)
    return {
      label: "Getting noticed",
      hint: "Recruiters see potential, but key skills are still missing. Follow the plan below.",
      tone: "primary",
      grade: "C",
    };
  if (score > 0)
    return {
      label: "Early stage",
      hint: "Totally normal for a student. Add skills one by one — every addition lifts this score.",
      tone: "gold",
      grade: "D",
    };
  return {
    label: "Not started",
    hint: "List your skills above to get your first score.",
    tone: "muted",
    grade: "E",
  };
}

function strengthVerdict(score) {
  if (score >= 80)
    return {
      label: "Recruiter-ready",
      hint: "A recruiter skimming for 7 seconds finds everything they need.",
      tone: "green",
    };
  if (score >= 60)
    return {
      label: "Almost there",
      hint: "One or two empty sections are holding you back — each takes ~2 minutes.",
      tone: "primary",
    };
  if (score > 0)
    return { label: "Needs work", hint: "Fill the checklist on the right — small edits, big visibility.", tone: "gold" };
  return { label: "Empty profile", hint: "Paste your sections above to get your first score.", tone: "muted" };
}

function scoreTone(score) {
  if (score >= 80) return "green";
  if (score >= 55) return "primary";
  if (score >= 35) return "gold";
  return "muted";
}

function encouragement(passed) {
  if (passed === 5) return "All 5 sections done — this is shortlist-level completeness.";
  if (passed === 4) return "One section away from a complete profile. You're close!";
  if (passed === 3) return "Halfway there — Experience or Skills unlocks the biggest jump.";
  if (passed >= 1) return "Good start — keep going, each section makes you more searchable.";
  return "Start with Headline + Skills — 5 minutes that change how you appear in search.";
}

function countSkills(skillsText) {
  return String(skillsText || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean).length;
}

const FIELD_META = {
  headline: { icon: Sparkles, placeholder: "Aspiring Backend Developer | Java, Spring Boot" },
  currentRole: { icon: Briefcase, placeholder: "Backend Intern at Acme" },
};

export default function StudentLinkedInPage() {
  const [form, setForm] = useState({ ...emptyForm });
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [profile, result] = await Promise.all([api.get("/linkedin/me"), api.get("/linkedin/analysis")]);
      setForm(fromProfile(profile));
      setAnalysis(result || null);
    } catch (err) {
      setLoadError(err?.message || "Failed to load your LinkedIn analysis.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data loader; state updates happen in promise callbacks
    load();
  }, [load]);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(event) {
    event?.preventDefault();
    const url = String(form.profileUrl || "").trim();
    if (!url) {
      const message = "LinkedIn profile URL is required.";
      setFormError(message);
      toast.error(message);
      return;
    }
    if (!isValidLinkedInUrl(url)) {
      const message = "Please provide a valid personal LinkedIn URL (https://www.linkedin.com/in/your-name).";
      setFormError(message);
      toast.error(message);
      return;
    }
    setFormError("");
    setSaving(true);
    try {
      const payload = {
        profileUrl: url,
        headline: form.headline.trim() || null,
        about: form.about.trim() || null,
        currentRole: form.currentRole.trim() || null,
        experienceText: form.experienceText.trim() || null,
        skillsText: form.skillsText.trim() || null,
        educationText: form.educationText.trim() || null,
      };
      await api.put("/linkedin", payload);
      toast.success("LinkedIn profile saved — analysis is ready below.");
      await load();
    } catch (err) {
      const message = err?.message || "Failed to save your LinkedIn profile.";
      setFormError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const liveChecks = useMemo(() => {
    const skillCount = countSkills(form.skillsText);
    return [
      {
        key: "headline",
        icon: Sparkles,
        title: "Headline",
        hint: "Dream role + 1–2 skills · e.g. “Aspiring Data Analyst | Python, SQL”",
        passed: form.headline.trim().length >= 10,
        status: form.headline.trim() ? `${form.headline.trim().length}/220` : "Empty",
      },
      {
        key: "about",
        icon: BookOpen,
        title: "About",
        hint: "3–4 lines: who you are → what you build → what you want next",
        passed: form.about.trim().length >= 150,
        status: form.about.trim() ? `${form.about.trim().length}/150+` : "Empty",
      },
      {
        key: "experience",
        icon: Briefcase,
        title: "Experience",
        hint: "Internships, freelance & class projects all count",
        passed: form.experienceText.trim().length > 0,
        status: form.experienceText.trim() ? "Added" : "Empty",
      },
      {
        key: "skills",
        icon: ListChecks,
        title: "Skills",
        hint: "Comma-separated, at least 3 · exactly as job posts spell them",
        passed: skillCount >= 3,
        status: skillCount > 0 ? `${skillCount}/3+` : "Empty",
      },
      {
        key: "education",
        icon: GraduationCap,
        title: "Education",
        hint: "Degree, college & year — recruiters filter on this",
        passed: form.educationText.trim().length > 0,
        status: form.educationText.trim() ? "Added" : "Empty",
      },
    ];
  }, [form]);

  const livePassed = liveChecks.filter((c) => c.passed).length;

  if (loading) return <LoadingState label="Loading your LinkedIn analysis…" />;

  if (loadError) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-1">
          <Breadcrumb items={[{ label: "LinkedIn Analysis" }]} />
          <h1 className="text-2xl font-bold tracking-tight">LinkedIn Analysis</h1>
          <p className="text-sm text-muted-foreground">Link your profile and see how it matches your career.</p>
        </div>
        <ErrorState title="Couldn't load your LinkedIn data" description={loadError} onRetry={load} />
      </div>
    );
  }

  const hasProfile = Boolean(analysis?.hasProfile);
  const detected = analysis?.detectedSkills || [];
  const matched = analysis?.matchedSkills || [];
  const missing = analysis?.missingSkills || [];
  const alsoOnCv = analysis?.alsoOnCv || [];
  const onlyOnLinkedIn = analysis?.onlyOnLinkedIn || [];
  const onlyOnCv = analysis?.onlyOnCv || [];
  const strengths = analysis?.strengths || [];
  const suggestions = analysis?.suggestions || [];
  const alignment = analysis?.alignmentPercent ?? 0;
  const completeness = analysis?.completenessPercent ?? 0;
  const match = matchVerdict(alignment, analysis?.hasTarget);
  const strength = strengthVerdict(completeness);
  const frameworkTotal = matched.length + missing.length;
  const nextMoves = suggestions.slice(0, 3);
  const laterIdeas = suggestions.slice(3);
  const overlapTotal = alsoOnCv.length + onlyOnLinkedIn.length + onlyOnCv.length;
  const overlapPct = overlapTotal > 0 ? Math.round((alsoOnCv.length / overlapTotal) * 100) : 0;

  const steps = [
    {
      n: 1,
      icon: Share2,
      title: "Link profile",
      desc: hasProfile ? "Connected — keep sections fresh" : "Paste your 5 sections",
      done: hasProfile,
      active: !hasProfile,
    },
    {
      n: 2,
      icon: SearchCheck,
      title: "Get your match score",
      desc: analysis?.hasTarget ? `${alignment}% vs ${analysis.careerName}` : "Pick a career to unlock",
      done: Boolean(analysis?.hasTarget) && alignment > 0,
      active: hasProfile && !analysis?.hasTarget,
    },
    {
      n: 3,
      icon: TrendingUp,
      title: "Fix gaps & grow",
      desc: missing.length > 0 ? `${missing.length} skills to add` : "Follow your 3 moves",
      done: hasProfile && missing.length === 0 && frameworkTotal > 0,
      active: hasProfile && Boolean(analysis?.hasTarget),
    },
  ];

  return (
    <div className="space-y-5">
      <Breadcrumb items={[{ label: "LinkedIn Analysis" }]} />

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <LinkedInIcon className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">LinkedIn Analysis</h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {analysis?.hasTarget
                ? `How your profile matches ${analysis.careerName} — skills found, gaps, and quality.`
                : "Link your public profile and see which of your skills recruiters can find."}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {analysis?.hasTarget ? (
                <Badge variant="secondary">
                  <Target className="size-3" aria-hidden="true" />
                  Target: {analysis.careerName}
                </Badge>
              ) : (
                <Badge variant="secondary">No target career yet</Badge>
              )}
              {hasProfile && (
                <Badge variant="secondary">
                  <BadgeCheck className="size-3" aria-hidden="true" />
                  Profile linked
                </Badge>
              )}
              {hasProfile && analysis?.profile?.updatedAt && (
                <span className="text-[11px] text-muted-foreground">
                  Last analysed {formatDateTime(analysis.profile.updatedAt)}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {hasProfile && analysis?.profile?.profileUrl ? (
            <Button
              size="sm"
              variant="outline"
              render={<a href={analysis.profile.profileUrl} target="_blank" rel="noreferrer" />}
            >
              Open my LinkedIn
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => document.getElementById("linkedin-form")?.scrollIntoView({ behavior: "smooth" })}
            >
              Link my profile
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Button>
          )}
          {!analysis?.hasTarget && (
            <Button size="sm" variant="outline" render={<Link href="/student/careers" />}>
              <Target className="size-3.5" aria-hidden="true" />
              Choose career
            </Button>
          )}
        </div>
      </div>

      {/* ── Steps ── */}
      <ol className="grid gap-3 sm:grid-cols-3">
        {steps.map((s) => {
          const Icon = s.icon;
          return (
            <li
              key={s.n}
              className={cn(
                "flex items-center gap-3 rounded-xl border bg-card p-3.5 shadow-card",
                s.done
                  ? "border-border/60"
                  : s.active
                    ? "border-primary/40"
                    : "border-border/60",
              )}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg",
                  s.done
                    ? "bg-muted text-muted-foreground"
                    : s.active
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {s.done ? <CheckCircle2 className="size-4.5" aria-hidden="true" /> : <Icon className="size-4.5" aria-hidden="true" />}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Step {s.n}
                </p>
                <p className="text-sm font-semibold leading-snug">{s.title}</p>
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{s.desc}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {/* ── Profile input + checklist ── */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card id="linkedin-form" className="scroll-mt-24 shadow-card lg:col-span-3">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <LinkedInIcon className="size-5" />
                </span>
                <div>
                  <CardTitle className="text-base">{hasProfile ? "Your LinkedIn sections" : "Link your profile in 2 minutes"}</CardTitle>
                  <CardDescription>
                    Copy-paste the visible sections from LinkedIn. Only what you paste is analysed.
                    {hasProfile && analysis?.profile?.updatedAt && (
                      <> Last saved {formatDateTime(analysis.profile.updatedAt)}.</>
                    )}
                  </CardDescription>
                </div>
              </div>
              <Badge variant="secondary" className="shrink-0">
                {livePassed}/5 sections
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="grid gap-4">
              <Field label="Profile URL" required hint="Must look like https://www.linkedin.com/in/your-name">
                <div className="relative">
                  <LinkedInIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-brand-700" />
                  <Input
                    value={form.profileUrl}
                    onChange={(event) => setField("profileUrl", event.target.value)}
                    placeholder="https://www.linkedin.com/in/your-name"
                    inputMode="url"
                    autoComplete="url"
                    className="pl-9"
                  />
                </div>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Headline" hint={`${form.headline.trim().length}/220 characters · the line under your name`}>
                  <Input
                    value={form.headline}
                    onChange={(event) => setField("headline", event.target.value)}
                    placeholder={FIELD_META.headline.placeholder}
                    maxLength={220}
                  />
                </Field>
                <Field label="Current role" hint="Internship, freelance or “Open to opportunities”">
                  <Input
                    value={form.currentRole}
                    onChange={(event) => setField("currentRole", event.target.value)}
                    placeholder={FIELD_META.currentRole.placeholder}
                    maxLength={180}
                  />
                </Field>
              </div>
              <Field label="About" hint={`${form.about.trim().length}/150+ characters · 3–4 lines is enough`}>
                <textarea
                  value={form.about}
                  onChange={(event) => setField("about", event.target.value)}
                  placeholder="Final-year CS student building REST APIs with Spring Boot. Looking for backend internships…"
                  maxLength={3000}
                  rows={3}
                  className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring/50"
                />
              </Field>
              <Field label="Experience" hint="One result per role — “built X that did Y” impresses most">
                <textarea
                  value={form.experienceText}
                  onChange={(event) => setField("experienceText", event.target.value)}
                  placeholder="Backend Intern at Acme: built 5 REST endpoints used by 200+ students…"
                  maxLength={5000}
                  rows={3}
                  className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring/50"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Skills" hint="Comma-separated · at least 3 · spell like job posts">
                  <textarea
                    value={form.skillsText}
                    onChange={(event) => setField("skillsText", event.target.value)}
                    placeholder="Java, Spring Boot, Git, MySQL…"
                    maxLength={2000}
                    rows={3}
                    className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring/50"
                  />
                </Field>
                <Field label="Education" hint="Degree, college, year — recruiters filter on this">
                  <textarea
                    value={form.educationText}
                    onChange={(event) => setField("educationText", event.target.value)}
                    placeholder="B.Tech Computer Science, XYZ College, 2026…"
                    maxLength={2000}
                    rows={3}
                    className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring/50"
                  />
                </Field>
              </div>
              {formError && (
                <p
                  role="alert"
                  className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive"
                >
                  {formError}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-muted/50 p-3">
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="size-3.5" aria-hidden="true" />
                  )}
                  {saving ? "Analysing…" : hasProfile ? "Save & re-analyse" : "Save and analyse"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  Analysis updates instantly after saving.
                </span>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Profile checklist</CardTitle>
                  <CardDescription>Updates live as you type.</CardDescription>
                </div>
                <span className="tnum text-2xl font-bold text-primary">{Math.round((livePassed / 5) * 100)}%</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Progress
                value={(livePassed / 5) * 100}
                tone={livePassed >= 4 ? "green" : "primary"}
                className="h-2.5"
                aria-label={`Profile sections ready: ${livePassed} of 5`}
              />
              <p className="text-xs font-semibold text-foreground">{encouragement(livePassed)}</p>
              <ul className="space-y-1.5">
                {liveChecks.map((check) => {
                  const Icon = check.icon;
                  return (
                    <li
                      key={check.key}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl border px-3 py-2 transition",
                        check.passed
                          ? "border-chart-3/25 bg-chart-3/5"
                          : "border-border/50 bg-background/40",
                      )}
                    >
                      {check.passed ? (
                        <CheckCircle2 className="size-4 shrink-0 text-chart-3" aria-hidden="true" />
                      ) : (
                        <Circle className="size-4 shrink-0 text-muted-foreground/50" aria-hidden="true" />
                      )}
                      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-none">{check.title}</p>
                        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{check.hint}</p>
                      </div>
                      <span
                        className={cn(
                          "tnum shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
                          check.passed ? "bg-chart-3/15 text-chart-3" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {check.status}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardContent className="flex gap-3 p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Lightbulb className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold">No internship yet? No problem.</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  List class projects, hackathons or freelance work under <span className="font-semibold text-foreground">Experience</span> —
                  recruiters count <span className="font-semibold text-foreground">proof</span>, not job titles. One line
                  per project with a result (“used by 200 students”) beats a blank section.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {!hasProfile ? (
        <div className="space-y-4">
          <EmptyState
            icon={Share2}
            title="No LinkedIn profile linked yet"
            description="Fill the 5 sections above and hit “Save and analyse” — you'll get a career match score, detected skills and a short action plan."
          />
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                icon: SearchCheck,
                title: "Career match score",
                desc: "See what % of your target career's required skills already show on your profile.",
              },
              {
                icon: BadgeCheck,
                title: "Skills recruiters find",
                desc: "We match your text against the CareerOS skill catalog — spell it like job posts do.",
              },
              {
                icon: Route,
                title: "3-move action plan",
                desc: "Prioritised next steps that each take under 30 minutes. No guesswork.",
              },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <Card key={f.title} className="shadow-card">
                  <CardContent className="p-4">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <p className="mt-3 text-sm font-semibold">{f.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{f.desc}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          {/* ── Scores ── */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Target className="size-4" aria-hidden="true" />
                  </span>
                  Career match
                  <Badge
                    variant="secondary"
                    className="ml-auto"
                  >
                    Grade {match.grade}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  {analysis?.hasTarget
                    ? `Share of required ${analysis.careerName} skills found on your profile.`
                    : "Choose a target career to compare your profile against employer expectations."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-5">
                <CircularProgress
                  value={analysis?.hasTarget ? alignment : 0}
                  size={118}
                  strokeWidth={11}
                  tone={analysis?.hasTarget ? scoreTone(alignment) : "muted"}
                  label="Career match percentage"
                >
                  <span className="text-2xl font-bold tracking-tight text-primary">
                    {analysis?.hasTarget ? `${alignment}%` : "—"}
                  </span>
                  <span className="max-w-24 text-[11px] font-bold leading-tight">{match.label}</span>
                </CircularProgress>
                <div className="min-w-0 flex-1">
                  <p className="rounded-xl bg-muted/60 p-3 text-xs leading-relaxed text-muted-foreground">
                    <span className="font-bold text-foreground">What this means: </span>
                    {match.hint}
                  </p>
                  {analysis?.hasTarget ? (
                    <p className="tnum mt-2 text-xs font-semibold text-muted-foreground">
                      {matched.length} of {frameworkTotal} required skills found
                      {frameworkTotal > 0 && ` · ${Math.round((matched.length / frameworkTotal) * 100)}% coverage`}
                    </p>
                  ) : (
                    <Button size="sm" className="mt-3" render={<Link href="/student/careers" />}>
                      Choose career
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <LinkedInIcon className="size-4" />
                  </span>
                  Profile strength
                  <Badge variant="secondary" className="ml-auto">
                    {strength.label}
                  </Badge>
                </CardTitle>
                <CardDescription>Would a recruiter stop scrolling? This is their 7-second view.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-end justify-between gap-2">
                  <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">{strength.hint}</p>
                  <span className="tnum text-3xl font-bold text-primary">{completeness}%</span>
                </div>
                <Progress
                  value={completeness}
                  tone={scoreTone(completeness)}
                  className="h-2.5"
                  aria-label={`Profile strength ${completeness} percent`}
                />
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { v: detected.length, l: "Skills found" },
                    { v: `${livePassed}/5`, l: "Sections done" },
                    { v: `${overlapPct}%`, l: "CV agreement" },
                  ].map((s) => (
                    <div key={s.l} className="rounded-xl border border-border/50 bg-background/40 px-2 py-2.5">
                      <p className="tnum text-base font-bold">{s.v}</p>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{s.l}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Skills story ── */}
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <Sparkles className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <CardTitle className="text-base">Skills recruiters can find ({detected.length})</CardTitle>
                    <CardDescription>
                      Matched against the CareerOS skill catalog — spell skills the way job posts do.
                    </CardDescription>
                  </div>
                </div>
                {detected.length > 0 && (
                  <Badge variant="secondary">
                    {detected.length} found
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {detected.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-5 text-center">
                  <p className="text-sm font-semibold">No catalog skills detected yet</p>
                  <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
                    List tools explicitly in Skills above, e.g. “Java, Spring Boot, Git, MySQL”. Vague words don&apos;t
                    match — exact tool names do.
                  </p>
                </div>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {detected.map((skill) => (
                    <li key={skill.skillId}>
                      <Badge
                        variant="secondary"
                        className="px-2.5 py-1 text-xs font-medium"
                      >
                        {skill.skillName}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}

              {analysis?.hasTarget ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                        <CheckCircle2 className="size-3.5" aria-hidden="true" />
                        Already impressing ({matched.length})
                      </p>
                      {frameworkTotal > 0 && (
                        <span className="tnum text-[11px] font-semibold text-muted-foreground">
                          {Math.round((matched.length / frameworkTotal) * 100)}%
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Required for {analysis.careerName} — and already visible here.
                    </p>
                    {matched.length === 0 ? (
                      <p className="mt-2 rounded-xl bg-background/60 p-3 text-xs leading-relaxed text-muted-foreground">
                        None yet — every student starts here. The list on the right is your study plan.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {matched.map((skill) => (
                          <li key={skill.skillId} className="flex items-center justify-between gap-2 rounded-xl bg-background/60 px-3 py-2 text-sm">
                            <span className="inline-flex min-w-0 items-center gap-1.5">
                              <CheckCircle2 className="size-4 shrink-0 text-chart-3" aria-hidden="true" />
                              <span className="truncate font-medium">{skill.skillName}</span>
                            </span>
                            <span className="tnum shrink-0 text-xs font-semibold text-muted-foreground">
                              {skill.assessed
                                ? `Tested ${skill.scorePercent}% · needs ${skill.targetPercent}%`
                                : `Needs ${skill.targetPercent}%`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                        <TrendingUp className="size-3.5" aria-hidden="true" />
                        Add next ({missing.length})
                      </p>
                      {frameworkTotal > 0 && (
                        <span className="tnum text-[11px] font-semibold text-muted-foreground">
                          +{Math.round((missing.length / frameworkTotal) * 100)}% lift
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Required for {analysis.careerName} — each one lifts your match score.
                    </p>
                    {missing.length === 0 ? (
                      <p className="mt-2 rounded-xl bg-background/60 p-3 text-xs text-muted-foreground">
                        Your profile covers every required skill. Add project links to prove them.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-2">
                        {missing.map((skill) => (
                          <li key={skill.skillId} className="flex items-center justify-between gap-2 rounded-xl bg-background/60 px-3 py-2 text-sm">
                            <span className="truncate font-medium">{skill.skillName}</span>
                            <span className="tnum shrink-0 text-xs font-semibold text-muted-foreground">
                              Needs {skill.targetPercent}%
                              {skill.assessed ? ` · tested ${skill.scorePercent}%` : ""}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <Button variant="outline" size="sm" className="mt-3" render={<Link href="/student/roadmap" />}>
                      <Route className="size-3.5" aria-hidden="true" />
                      Close these gaps with my roadmap
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 py-6 text-center">
                  <span className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <Target className="size-6" aria-hidden="true" />
                  </span>
                  <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                    Choose a target career to split your skills into <span className="font-semibold text-foreground">matched</span> vs{" "}
                    <span className="font-semibold text-foreground">missing</span> against exactly what employers expect.
                  </p>
                  <Button size="sm" render={<Link href="/student/careers" />}>
                    Choose career
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── CV / LinkedIn agreement ── */}
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <Users className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <CardTitle className="text-base">Do your CV and LinkedIn agree?</CardTitle>
                    <CardDescription>
                      Recruiters open both side by side. Aim for 80%+ overlap.
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="secondary">
                  {overlapPct}% agreement
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  {overlapTotal > 0 && (
                    <>
                      <div className="h-full bg-chart-3" style={{ width: `${(alsoOnCv.length / overlapTotal) * 100}%` }} />
                      <div className="h-full bg-primary" style={{ width: `${(onlyOnLinkedIn.length / overlapTotal) * 100}%` }} />
                      <div className="h-full bg-amber-400" style={{ width: `${(onlyOnCv.length / overlapTotal) * 100}%` }} />
                    </>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-chart-3" /> On both — trusted most
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-primary" /> Only LinkedIn — add to CV
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-amber-400" /> Only CV — add to LinkedIn
                  </span>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    title: `On both (${alsoOnCv.length})`,
                    hint: "Keep these identical everywhere.",
                    items: alsoOnCv,
                    icon: BadgeCheck,
                    empty: "No overlap yet — copy 2–3 skills to both places today.",
                  },
                  {
                    title: `Only on LinkedIn (${onlyOnLinkedIn.length})`,
                    hint: "Add these to your CV Skills section too.",
                    items: onlyOnLinkedIn,
                    icon: LinkedInIcon,
                    empty: "Nothing unique here. Good consistency.",
                  },
                  {
                    title: `Only on CV (${onlyOnCv.length})`,
                    hint: "Add these to LinkedIn Skills today.",
                    items: onlyOnCv,
                    icon: FileText,
                    empty: "CV and LinkedIn agree. Excellent.",
                  },
                ].map((col) => {
                  const Icon = col.icon;
                  return (
                    <div key={col.title} className="rounded-xl border border-border/60 bg-muted/30 p-4">
                      <p className="inline-flex items-center gap-1.5 text-xs font-semibold">
                        <Icon className="size-3.5" aria-hidden="true" />
                        {col.title}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{col.hint}</p>
                      {col.items.length === 0 ? (
                        <p className="mt-2 text-xs italic text-muted-foreground">{col.empty}</p>
                      ) : (
                        <ul className="mt-2 flex flex-wrap gap-1.5">
                          {col.items.map((skill) => (
                            <li key={skill.skillId}>
                              <Badge variant="secondary">
                                {skill.skillName}
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
              {onlyOnCv.length > 0 && (
                <Button variant="outline" size="sm" render={<Link href="/student/cv" />}>
                  Review my CV
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Button>
              )}
            </CardContent>
          </Card>

          {/* ── Action plan ── */}
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                    <Trophy className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <CardTitle className="text-base">Your 30-minute upgrade plan</CardTitle>
                    <CardDescription>Do these in order — smallest effort first.</CardDescription>
                  </div>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {strengths.length} strengths · {suggestions.length} ideas
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {nextMoves.length > 0 && (
                <ol className="space-y-2">
                  {nextMoves.map((item, index) => (
                    <li
                      key={item}
                      className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/30 p-3"
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Move {index + 1} · ~10 min
                        </p>
                        <p className="mt-0.5 text-sm leading-relaxed">{item}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                  <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
                    <Award className="size-3.5" aria-hidden="true" />
                    What&apos;s working
                  </p>
                  {strengths.length === 0 ? (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Nothing confirmed yet — strengths appear as you complete each section.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {strengths.map((item) => (
                        <li key={item} className="flex items-start gap-1.5 text-sm">
                          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-chart-3" aria-hidden="true" />
                          <span className="font-medium">{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {nextMoves.length > 0 ? "More ideas for later" : "Suggested improvements"}
                  </p>
                  {(nextMoves.length > 0 ? laterIdeas : suggestions).length === 0 ? (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CheckCircle2 className="size-3.5 text-chart-3" aria-hidden="true" />
                      Nothing to fix — solid profile. Help a friend fix theirs.
                    </p>
                  ) : (
                    <ul className="mt-2 space-y-1.5">
                      {(nextMoves.length > 0 ? laterIdeas : suggestions).map((item) => (
                        <li key={item} className="flex items-start gap-1.5 text-sm text-muted-foreground">
                          <span
                            aria-hidden="true"
                            className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50"
                          />
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" render={<Link href="/student/roadmap" />}>
                  <Route className="size-3.5" aria-hidden="true" />
                  Follow my learning plan
                </Button>
                <Button size="sm" variant="outline" render={<Link href="/student/cv" />}>
                  <FileText className="size-3.5" aria-hidden="true" />
                  Check my CV too
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ── Tips ── */}
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                icon: Eye,
                title: "Headline = searchable",
                desc: "“Aspiring Backend Developer | Java, Spring Boot” shows up in recruiter search. “Student at XYZ” doesn't.",
              },
              {
                icon: Users,
                title: "Consistency builds trust",
                desc: "Same skills, same titles on CV + LinkedIn. Copy-paste — don't reword.",
              },
              {
                icon: Lightbulb,
                title: "Proof beats claims",
                desc: "Add one project link per top skill. “Built an API used by 200 students” beats “Hardworking”.",
              },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <div
                  key={t.title}
                  className="rounded-xl border border-border/60 bg-card p-4 shadow-card"
                >
                  <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <p className="mt-2.5 text-sm font-semibold">{t.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.desc}</p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
