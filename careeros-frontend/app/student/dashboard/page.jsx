"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  BookOpen,
  Bot,
  CheckCircle2,
  Circle,
  ClipboardList,
  FileText,
  FolderKanban,
  History,
  Loader2,
  Play,
  Route,
  Share2,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CircularProgress } from "@/components/ui/circular-progress";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { StudentAvatar } from "@/components/student-avatar";
import { SkillDonut, ScoreTrend, WeekActivity } from "@/components/charts";
import api from "@/lib/api";
import { formatDateTime, prettifyEnum } from "@/lib/format";
import { cn } from "cn";
import { hasReadinessEvidence, summarizeSkillGaps } from "@/lib/readiness-metrics.mjs";

const CHECK_FIELDS = [
  "fullName",
  "mobile",
  "college",
  "degree",
  "branch",
  "graduationYear",
  "semester",
  "linkedinUrl",
];

const ROADMAP_STATUS_STYLES = {
  COMPLETED: "bg-chart-3/15 text-chart-3",
  IN_PROGRESS: "bg-primary/10 text-primary",
};

const PROJECT_STATUS_STYLES = {
  NOT_STARTED: "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-primary/10 text-primary",
  COMPLETED: "bg-chart-3/15 text-chart-3",
};

const ACTIVITY_LABEL = {
  ASSESSMENT: "Assessment",
  ROADMAP: "Roadmap",
  PROJECT: "Project",
  CV: "CV",
  LINKEDIN: "LinkedIn",
};

const AI_QUICK_PROMPTS = [
  "What should I learn next?",
  "What are my biggest skill gaps?",
  "How can I improve my weakest skill?",
  "Give me project ideas for my career.",
];

function greetingFor(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function completionOf(profile) {
  if (!profile) return 0;
  const filled = CHECK_FIELDS.filter((key) => String(profile[key] ?? "").trim().length > 0).length;
  return Math.round((filled / CHECK_FIELDS.length) * 100);
}

function roadmapStatusLabel(status) {
  if (status === "COMPLETED") return "Completed";
  if (status === "IN_PROGRESS") return "In progress";
  if (status === "LOCKED") return "Locked";
  return "Not started";
}

function projectStatusLabel(status) {
  if (status === "COMPLETED") return "Completed";
  if (status === "IN_PROGRESS") return "In progress";
  return "To do";
}

function shortDate(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function StudentDashboard() {
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [progress, setProgress] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState(true);
  const [progressError, setProgressError] = useState("");
  const [career, setCareer] = useState(null);
  const [availableCount, setAvailableCount] = useState(null);
  const [inProgressAttempt, setInProgressAttempt] = useState(null);
  const [loadingAttempt, setLoadingAttempt] = useState(false);

  // Profile — name, target career, photo key.
  useEffect(() => {
    let ignore = false;
    api
      .get("/students/me")
      .then((data) => {
        if (!ignore) {
          setProfile(data || null);
          setProfileError("");
        }
      })
      .catch((err) => {
        if (!ignore) {
          setProfile(null);
          setProfileError(err.message || "Unable to load your profile.");
        }
      })
      .finally(() => {
        if (!ignore) setLoadingProfile(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  // Consolidated progress — readiness, gaps, attempts, roadmap, projects,
  // CV, LinkedIn and activity in a single request.
  useEffect(() => {
    let ignore = false;
    api
      .get("/progress/me")
      .then((data) => {
        if (!ignore) {
          setProgress(data || null);
          setProgressError("");
        }
      })
      .catch((err) => {
        if (!ignore) {
          setProgress(null);
          setProgressError(err.message || "Unable to load your career progress.");
        }
      })
      .finally(() => {
        if (!ignore) setLoadingProgress(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  // Target career detail — real description for the career band.
  useEffect(() => {
    if (!profile?.targetCareerId) return undefined;
    let ignore = false;
    api
      .get(`/careers/${profile.targetCareerId}`)
      .then((data) => {
        if (!ignore) setCareer(data || null);
      })
      .catch(() => {
        if (!ignore) setCareer(null);
      });
    return () => {
      ignore = true;
    };
  }, [profile?.targetCareerId]);

  // Available assessments + any in-progress attempt (for counts and resume).
  useEffect(() => {
    if (!profile?.targetCareerId) return undefined;
    let ignore = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async attempt loader; loading flag mirrors the fetch lifecycle
    setLoadingAttempt(true);
    api
      .get(`/assessments/${profile.targetCareerId}/available`)
      .then(async (list) => {
        const items = Array.isArray(list) ? list : [];
        if (!ignore) setAvailableCount(items.length);
        const states = await Promise.all(
          items.map((assessment) =>
            api
              .get("/assessments/attempts/my", { params: { assessmentId: assessment.assessmentId } })
              .catch(() => null),
          ),
        );
        if (ignore) return;
        setInProgressAttempt(states.find((attempt) => attempt?.status === "IN_PROGRESS") || null);
      })
      .catch(() => {
        if (!ignore) {
          setAvailableCount(null);
          setInProgressAttempt(null);
        }
      })
      .finally(() => {
        if (!ignore) setLoadingAttempt(false);
      });
    return () => {
      ignore = true;
    };
  }, [profile?.targetCareerId]);

  const readiness = progress?.readiness || null;
  const hasTarget = Boolean(profile?.targetCareerId || readiness?.hasTarget);
  const readinessReady = hasReadinessEvidence(readiness);
  const readinessPercent = readinessReady ? (readiness.readinessPercent ?? 0) : null;

  const gaps = Array.isArray(readiness?.gaps) ? readiness.gaps : [];
  const skillSummary = summarizeSkillGaps(gaps);
  const gapsBySeverity = [...gaps].sort((a, b) => (a.gapPercent ?? 0) - (b.gapPercent ?? 0));
  const topSkills = gapsBySeverity.slice(0, 6);
  const needsImprovement = skillSummary.needsWorkCount;

  const attempts = Array.isArray(progress?.attempts) ? progress.attempts : [];
  const completedAssessments = progress?.completedAssessments ?? attempts.length;
  const recentAssessments = attempts.slice(0, 3);
  const latestSubmitted = progress?.latestAttempt || attempts[0] || null;
  const previousSubmitted = progress?.previousAttempt || attempts[1] || null;
  const scoreDelta =
    latestSubmitted?.overallScore != null && previousSubmitted?.overallScore != null
      ? latestSubmitted.overallScore - previousSubmitted.overallScore
      : null;

  const roadmap = progress?.roadmap || null;
  const roadmapPhases = Array.isArray(roadmap?.phases) ? roadmap.phases : [];
  const flatRoadmap = roadmapPhases.flatMap((phase) =>
    (phase.items || []).map((item) => ({ ...item, phaseTitle: phase.title })),
  );
  const openRoadmap = flatRoadmap.filter((item) => item.status !== "COMPLETED");
  const resumedRoadmap = openRoadmap.find((item) => item.status === "IN_PROGRESS") || null;
  const nextRoadmap =
    resumedRoadmap ||
    [...openRoadmap].sort((a, b) => (b.gapPercent ?? -1) - (a.gapPercent ?? -1))[0] ||
    null;
  const timelineItems = flatRoadmap.slice(0, 5);
  const roadmapDone = (roadmap?.totalItems ?? 0) > 0 && (roadmap?.completedItems ?? 0) >= (roadmap?.totalItems ?? 0);

  const projectsData = progress?.projects || null;
  const projectList = Array.isArray(projectsData?.projects) ? projectsData.projects : [];
  const inProgressProject = projectList.find((p) => p.status === "IN_PROGRESS") || null;
  const recentProjects = projectList.slice(0, 3);
  const projectTotal = projectsData?.totalProjects ?? projectList.length;
  const projectCompleted = projectsData?.completedProjects ?? projectList.filter((p) => p.status === "COMPLETED").length;
  const projectPct = projectTotal > 0 ? Math.round((projectCompleted / projectTotal) * 100) : 0;

  const cv = progress?.cv || null;
  const linkedIn = progress?.linkedIn || null;
  const allActivity = Array.isArray(progress?.recentActivity) ? progress.recentActivity : [];
  const activity = allActivity.slice(0, 5);

  // Score trend — oldest first, capped so the chart stays readable.
  const trendPoints = [...attempts]
    .filter((a) => a?.overallScore != null)
    .sort((a, b) => new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0))
    .slice(-8)
    .map((a) => ({ label: shortDate(a.submittedAt), title: a.assessmentTitle, value: a.overallScore }));

  // This week's activity — counts per day for the last 7 days.
  const weekDays = (() => {
    const counts = {};
    allActivity.forEach((item) => {
      if (!item?.occurredAt) return;
      const date = new Date(item.occurredAt);
      if (Number.isNaN(date.getTime())) return;
      const key = date.toDateString();
      counts[key] = (counts[key] || 0) + 1;
    });
    const days = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - offset);
      days.push({
        label: offset === 0 ? "Today" : date.toLocaleDateString(undefined, { weekday: "narrow" }),
        count: counts[date.toDateString()] || 0,
        isToday: offset === 0,
      });
    }
    return days;
  })();

  // Skills donut — on target vs needs work vs not yet assessed.
  const donutSegments = [
    { label: "On target", value: skillSummary.onTargetCount, className: "stroke-chart-3" },
    { label: "Needs work", value: skillSummary.needsWorkCount, className: "stroke-amber-500" },
    { label: "Not assessed", value: skillSummary.unassessedCount, className: "stroke-muted-foreground/40" },
  ];

  const skillsAtTarget = skillSummary.onTargetCount;
  const skillsTotal = readiness?.totalSkills ?? 0;

  const profileCompletion = completionOf(profile);
  const firstName = profile?.fullName ? profile.fullName.split(" ")[0] : null;
  const greeting = greetingFor();

  // Continue Learning — the single most relevant next activity.
  const continueLearning = (() => {
    if (inProgressAttempt?.attemptId) {
      return { label: "Resume assessment", href: `/student/assessment/attempt/${inProgressAttempt.attemptId}` };
    }
    if (!hasTarget) return { label: "Choose your career", href: "/student/careers" };
    if (!latestSubmitted) return { label: "Take your first assessment", href: "/student/assessment" };
    if (nextRoadmap) return { label: "Continue learning", href: "/student/roadmap" };
    if (inProgressProject) return { label: "Continue project", href: "/student/projects" };
    return { label: "Take an assessment", href: "/student/assessment" };
  })();

  // Recommended Next Steps — derived from real gaps and statuses.
  const nextSteps = (() => {
    const steps = [];
    if (!hasTarget && !profileError) {
      steps.push({
        icon: Target,
        title: "Choose your target career",
        description: "Career selection unlocks assessments, skill gaps and your roadmap.",
        cta: "Choose career",
        href: "/student/careers",
      });
    }
    if (inProgressAttempt) {
      steps.push({
        icon: Play,
        title: `Resume: ${inProgressAttempt.assessmentTitle || "assessment"}`,
        description: `${inProgressAttempt.answeredCount ?? 0} of ${inProgressAttempt.totalQuestions ?? "—"} answered — pick up where you left off.`,
        cta: "Resume",
        href: `/student/assessment/attempt/${inProgressAttempt.attemptId}`,
      });
    }
    if (hasTarget && !latestSubmitted && !inProgressAttempt) {
      steps.push({
        icon: ClipboardList,
        title: "Take your first assessment",
        description: "Role-specific questions measure your current skill level.",
        cta: "Start",
        href: "/student/assessment",
      });
    }
    const topGap = gapsBySeverity.find((gap) => gap.assessed);
    if (topGap && !topGap.metTarget && openRoadmap.length > 0) {
      const linked = openRoadmap.find((item) => item.skillId && item.skillId === topGap.skillId) || nextRoadmap;
      steps.push({
        icon: BookOpen,
        title: `Improve ${topGap.skillName}`,
        description: linked
          ? `Largest gap (${topGap.assessed ? `${topGap.scorePercent}% vs ${topGap.targetPercent}%` : `target ${topGap.targetPercent}%`}) — train it in “${linked.title}”.`
          : `Largest gap (${topGap.assessed ? `${topGap.scorePercent}% vs ${topGap.targetPercent}%` : `target ${topGap.targetPercent}%`}).`,
        cta: "Continue",
        href: "/student/roadmap",
      });
    }
    if (!profileError && profileCompletion < 80) {
      steps.push({
        icon: FileText,
        title: "Complete your profile",
        description: `Your profile is ${profileCompletion}% complete — details power every analysis.`,
        cta: "Complete",
        href: "/student/profile",
      });
    }
    if (inProgressProject && !inProgressAttempt) {
      steps.push({
        icon: FolderKanban,
        title: `Finish: ${inProgressProject.title}`,
        description: "Finished builds turn skill gaps into proof for recruiters.",
        cta: "Continue",
        href: "/student/projects",
      });
    }
    if (!cv?.hasCv) {
      steps.push({
        icon: Upload,
        title: "Upload your CV",
        description: "Detect your skills and match them against your target career.",
        cta: "Upload",
        href: "/student/cv",
      });
    }
    if (!linkedIn?.hasProfile) {
      steps.push({
        icon: Share2,
        title: "Analyze your LinkedIn",
        description: "Check profile completeness and career alignment.",
        cta: "Analyze",
        href: "/student/linkedin",
      });
    }
    if (nextRoadmap && steps.length < 4 && topGap?.metTarget !== false) {
      steps.push({
        icon: Route,
        title: nextRoadmap.status === "IN_PROGRESS" ? `Continue: ${nextRoadmap.title}` : `Up next: ${nextRoadmap.title}`,
        description: nextRoadmap.phaseTitle || "Your phase-wise learning plan.",
        cta: "Open",
        href: "/student/roadmap",
      });
    }
    if (latestSubmitted && steps.length < 4) {
      steps.push({
        icon: TrendingUp,
        title: "Review your readiness report",
        description: "Gaps, scores and an action plan in one downloadable report.",
        cta: "View",
        href: "/student/reports",
      });
    }
    return steps.slice(0, 3);
  })();

  const initialLoading = loadingProfile || loadingProgress;
  if (initialLoading && !profile && !progress) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (progressError && !progress) {
    return (
      <ErrorState
        title="Unable to load your career progress"
        description={progressError}
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* 1. Welcome hero — WHERE AM I */}
      <section className="relative overflow-hidden rounded-2xl bg-primary text-primary-foreground shadow-card">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-white/10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-20 right-32 size-40 rounded-full bg-white/5"
        />
        <div className="relative flex flex-wrap items-center gap-4 p-5 sm:p-6">
          <Link
            href="/student/profile"
            title="View my profile"
            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <StudentAvatar
              photoKey={profile?.profilePhotoUrl || null}
              fullName={profile?.fullName}
              email={profile?.email}
              className="size-14 border-2 border-white/40 sm:size-16"
              fallbackClassName="bg-white/20 text-xl font-bold text-white"
            />
          </Link>
          <div className="min-w-52 flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
              {greeting}
            </p>
            <h1 className="mt-0.5 text-xl font-bold tracking-tight sm:text-2xl">
              {firstName ? `${greeting}, ${firstName}!` : "Welcome!"}
            </h1>
            <p className="mt-1 text-sm text-white/80">
              Keep learning, keep building. You&apos;re one step closer to your career goal.
            </p>
            {readinessReady && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                  <Award className="size-3" aria-hidden="true" />
                  {prettifyEnum(readiness.readinessLevel)}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {loadingAttempt ? (
              <Button variant="secondary" size="sm" disabled>
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                Loading…
              </Button>
            ) : (
              <Button variant="secondary" size="sm" render={<Link href={continueLearning.href} />}>
                <Play className="size-3.5" aria-hidden="true" />
                {continueLearning.label}
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* 2. Target career band */}
      <section>
        {hasTarget ? (
          <Card className="border-primary/25 shadow-card">
            <CardContent className="flex flex-wrap items-center gap-4 py-5">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Target className="size-6" aria-hidden="true" />
              </span>
              <div className="min-w-52 flex-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Target Career
                </p>
                <p className="mt-0.5 text-lg font-bold tracking-tight">
                  {profile?.targetCareerName || readiness?.targetCareerName || "Your career"}
                </p>
                {career?.description && (
                  <p className="mt-0.5 line-clamp-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                    {career.description}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {readinessReady ? (
                    needsImprovement === 0
                      ? `${skillSummary.assessedCount} assessed skills are on target.`
                      : `${needsImprovement} assessed skill${needsImprovement === 1 ? "" : "s"} need${needsImprovement === 1 ? "s" : ""} improvement.`
                  ) : (
                    "Submit an assessment to calculate your readiness."
                  )}
                </p>
              </div>
              {readinessReady && (
                <CircularProgress
                  value={readinessPercent}
                  size={84}
                  strokeWidth={9}
                  tone={readinessPercent >= 80 ? "green" : "primary"}
                  label="Career readiness percentage"
                >
                  <span className="tnum text-lg font-bold text-primary">{readinessPercent}</span>
                  <span className="text-[10px] font-medium text-muted-foreground">ready</span>
                </CircularProgress>
              )}
              <Button variant="outline" size="sm" render={<Link href="/student/careers" />}>
                {hasTarget ? "View / edit career" : "Choose career"}
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-primary/25 shadow-card">
            <CardContent className="flex flex-wrap items-center gap-4 py-5">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Target className="size-6" aria-hidden="true" />
              </span>
              <div className="min-w-52 flex-1">
                <p className="text-sm font-bold">No target career yet</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {profileError
                    ? `Your profile could not be loaded. ${profileError}`
                    : "Career selection unlocks assessments, skill gaps, roadmap and this dashboard."}
                </p>
              </div>
              {profileError ? (
                <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
                  Retry
                </Button>
              ) : (
                <Button size="sm" render={<Link href="/student/careers" />}>
                  Choose career <ArrowRight className="size-3.5" aria-hidden="true" />
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </section>

      {/* 3. Top overview cards */}
      <section aria-label="Learning summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-card transition-shadow hover:shadow-card-hover">
          <CardContent className="space-y-2 py-5">
            <div className="flex items-center justify-between">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ClipboardList className="size-4.5" aria-hidden="true" />
              </span>
              {scoreDelta != null && (
                <Badge variant="secondary" className={cn("shrink-0", scoreDelta >= 0 ? "bg-chart-3/15 text-chart-3" : "bg-amber-500/15 text-amber-700")}>
                  {scoreDelta >= 0 ? `+${scoreDelta}` : scoreDelta}
                </Badge>
              )}
            </div>
            <p className="text-xs font-medium text-muted-foreground">Assessments</p>
            <p className="tnum text-2xl font-bold tracking-tight">
              {completedAssessments}
              {availableCount != null && (
                <span className="text-sm font-semibold text-muted-foreground"> / {availableCount}</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {availableCount != null ? "submitted of available" : "submitted"}
              {latestSubmitted ? ` · latest ${latestSubmitted.overallScore ?? "—"}` : ""}
            </p>
            <Button variant="outline" size="sm" className="w-full" render={<Link href="/student/assessment" />}>
              View assessments <ArrowRight className="size-3.5" aria-hidden="true" />
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-card transition-shadow hover:shadow-card-hover">
          <CardContent className="space-y-2 py-5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Route className="size-4.5" aria-hidden="true" />
            </div>
            <p className="text-xs font-medium text-muted-foreground">Roadmap</p>
            <p className="tnum text-2xl font-bold tracking-tight">
              {roadmap?.completedItems ?? 0}<span className="text-sm font-semibold text-muted-foreground"> / {roadmap?.totalItems ?? 0}</span>
            </p>
            <Progress value={roadmap?.progressPercent ?? 0} className="h-1.5" aria-label={`Roadmap ${roadmap?.progressPercent ?? 0}% complete`} />
            <Button variant="outline" size="sm" className="w-full" render={<Link href="/student/roadmap" />}>
              Continue roadmap <ArrowRight className="size-3.5" aria-hidden="true" />
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-card transition-shadow hover:shadow-card-hover">
          <CardContent className="space-y-2 py-5">
            <div className="flex items-center justify-between">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FolderKanban className="size-4.5" aria-hidden="true" />
              </span>
              <span className="tnum text-xs font-semibold text-muted-foreground">{projectPct}%</span>
            </div>
            <p className="text-xs font-medium text-muted-foreground">Projects</p>
            <p className="tnum text-2xl font-bold tracking-tight">
              {projectCompleted}
              <span className="text-sm font-semibold text-muted-foreground"> / {projectTotal}</span>
            </p>
            <Progress
              value={projectPct}
              tone={projectPct >= 100 ? "green" : "primary"}
              className="h-1.5"
              aria-label={`${projectCompleted} of ${projectTotal} projects completed`}
            />
            <Button variant="outline" size="sm" className="w-full" render={<Link href="/student/projects" />}>
              View projects <ArrowRight className="size-3.5" aria-hidden="true" />
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* 4. Recommended Next Steps — data-driven */}
      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-bold tracking-tight">Recommended Next Steps</h2>
            <p className="text-xs text-muted-foreground">
              Chosen from your skill gaps, roadmap, assessments and profile status.
            </p>
          </div>
        </div>
        {loadingProgress ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-44 rounded-2xl" />
            <Skeleton className="h-44 rounded-2xl" />
            <Skeleton className="h-44 rounded-2xl" />
            <Skeleton className="h-44 rounded-2xl" />
          </div>
        ) : nextSteps.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
              <CheckCircle2 className="size-8 text-chart-3" aria-hidden="true" />
              <p className="text-sm font-semibold">Everything is on track</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                All assessed skills are on target and your profile is complete. Keep your momentum in the modules below.
              </p>
            </CardContent>
          </Card>
        ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {nextSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <Card key={`${step.title}-${index}`} className="shadow-card transition-shadow hover:shadow-card-hover">
                  <CardContent className="flex h-full flex-col gap-3 py-5">
                    <div className="flex items-center justify-between">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="size-5" aria-hidden="true" />
                      </span>
                      {index === 0 && (
                        <Badge variant="secondary" className="bg-primary/10 text-primary">
                          Start here
                        </Badge>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold leading-snug">{step.title}</p>
                      <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                    <Button size="sm" className="mt-auto w-full" render={<Link href={step.href} />}>
                      {step.cta} <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <details className="group rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
        <summary className="cursor-pointer list-none text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring">
          More progress details
          <span className="ml-2 text-xs font-normal text-muted-foreground">Skills, assessments, roadmap and projects</span>
        </summary>
        <div className="mt-4 grid items-start gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          {/* 5a. Skill progress — WHAT ARE MY GAPS */}
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Your Skill Progress</CardTitle>
                  <CardDescription>
                    {hasTarget
                      ? `Current score vs required target${readiness?.targetCareerName ? ` for ${readiness.targetCareerName}` : ""} — largest gaps first.`
                      : "Choose a target career to see your skill framework."}
                  </CardDescription>
                </div>
                {hasTarget && (
                  <Button variant="outline" size="sm" render={<Link href="/student/progress" />}>
                    View all skills <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loadingProgress ? (
                <div className="space-y-3.5">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : !hasTarget ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Target className="size-7" aria-hidden="true" />
                  </span>
                  <p className="max-w-xs text-sm text-muted-foreground">
                    Select a target career first — your skill framework appears here.
                  </p>
                  <Button size="sm" render={<Link href="/student/careers" />}>
                    Choose career <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              ) : topSkills.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No framework skills found for this career yet.
                </p>
              ) : (
                <>
                  <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-border/50 bg-background/40 p-3.5">
                    <SkillDonut
                      segments={donutSegments}
                      size={84}
                      strokeWidth={13}
                      label={`Skills: ${skillsAtTarget} on target of ${skillsTotal}`}
                    >
                      <span className="tnum text-lg font-bold text-primary">{skillsAtTarget}/{skillsTotal}</span>
                      <span className="text-[10px] font-medium text-muted-foreground">on target</span>
                    </SkillDonut>
                    <ul className="min-w-40 flex-1 space-y-1.5 text-xs">
                      {donutSegments.map((segment) => (
                        <li key={segment.label} className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                            <span
                              className={cn(
                                "size-2.5 rounded-full",
                                segment.className === "stroke-chart-3" && "bg-chart-3",
                                segment.className === "stroke-amber-500" && "bg-amber-500",
                                segment.className === "stroke-muted-foreground/40" && "bg-muted-foreground/40",
                              )}
                              aria-hidden="true"
                            />
                            {segment.label}
                          </span>
                          <span className="tnum font-bold">{segment.value}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <ul className="space-y-3.5">
                  {topSkills.map((skill) => (
                    <li key={skill.skillId}>
                      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span className="min-w-0">
                          <span className="font-medium">{skill.skillName}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            current {skill.assessed ? `${skill.scorePercent}%` : "—"} → target {skill.targetPercent}%
                            {skill.assessed && skill.gapPercent != null && skill.gapPercent < 0
                              ? ` · gap ${-skill.gapPercent}%`
                              : ""}
                          </span>
                        </span>
                        {skill.assessed ? (
                          <Badge
                            variant="secondary"
                            className={cn("shrink-0", skill.metTarget ? "bg-chart-3/15 text-chart-3" : "bg-amber-500/15 text-amber-700 dark:text-amber-400")}
                          >
                            {skill.metTarget ? "On target" : "Needs work"}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="shrink-0">Not assessed</Badge>
                        )}
                      </div>
                      <div className="relative">
                        <Progress
                          value={skill.assessed ? (skill.scorePercent ?? 0) : 0}
                          tone={skill.assessed && skill.metTarget ? "green" : "primary"}
                          className="h-2"
                          aria-label={`${skill.skillName}: ${skill.assessed ? `${skill.scorePercent} percent` : "not assessed"}, target ${skill.targetPercent} percent`}
                        />
                        <span
                          className="absolute top-[-3px] h-[14px] w-0.5 rounded bg-chart-3"
                          style={{ left: `${Math.min(100, skill.targetPercent ?? 0)}%` }}
                          title={`Target ${skill.targetPercent}%`}
                          aria-hidden="true"
                        />
                      </div>
                    </li>
                  ))}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>

          {/* 5b. Recent assessments */}
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Recent Assessments</CardTitle>
                  <CardDescription>Your latest submitted attempts.</CardDescription>
                </div>
                <Button variant="outline" size="sm" render={<Link href="/student/assessment" />}>
                  View all <ArrowRight className="size-3.5" aria-hidden="true" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingProgress ? (
                <div className="space-y-2.5">
                  <Skeleton className="h-14 w-full rounded-xl" />
                  <Skeleton className="h-14 w-full rounded-xl" />
                  <Skeleton className="h-14 w-full rounded-xl" />
                </div>
              ) : recentAssessments.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <ClipboardList className="size-7" aria-hidden="true" />
                  </span>
                  <p className="max-w-xs text-sm text-muted-foreground">
                    No assessment yet. Take your first assessment to discover your skill level.
                  </p>
                  <Button size="sm" render={<Link href="/student/assessment" />}>
                    Take assessment <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              ) : (
                <ul className="divide-y divide-border/50">
                  {recentAssessments.map((attempt) => (
                    <li key={attempt.attemptId} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <ClipboardList className="size-4.5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{attempt.assessmentTitle}</p>
                        <p className="text-xs text-muted-foreground">
                          {attempt.submittedAt ? formatDateTime(attempt.submittedAt) : "—"}
                          {attempt.totalQuestions != null ? ` · ${attempt.answeredCount ?? 0}/${attempt.totalQuestions} answered` : ""}
                        </p>
                      </div>
                      <span className="tnum shrink-0 text-sm font-bold text-primary">
                        {attempt.overallScore ?? "—"}
                        {attempt.overallScore != null && <span className="text-xs font-semibold text-muted-foreground">%</span>}
                      </span>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "shrink-0",
                          attempt.status === "SUBMITTED" ? "bg-chart-3/15 text-chart-3" : "bg-primary/10 text-primary",
                        )}
                      >
                        {attempt.status === "SUBMITTED" ? "Completed" : prettifyEnum(attempt.status)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* 5b2. Score trend — are you improving? */}
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="size-4 text-primary" aria-hidden="true" /> Score Trend
                  </CardTitle>
                  <CardDescription>Your assessment scores over time — proof you&apos;re improving.</CardDescription>
                </div>
                {scoreDelta != null && (
                  <Badge variant="secondary" className={cn("shrink-0", scoreDelta >= 0 ? "bg-chart-3/15 text-chart-3" : "bg-amber-500/15 text-amber-700")}>
                    {scoreDelta >= 0 ? `+${scoreDelta} latest` : `${scoreDelta} latest`}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loadingProgress ? (
                <Skeleton className="h-44 w-full rounded-xl" />
              ) : trendPoints.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <TrendingUp className="size-7" aria-hidden="true" />
                  </span>
                  <p className="max-w-xs text-sm text-muted-foreground">
                    Submit assessments and watch your trend line climb here.
                  </p>
                  <Button size="sm" render={<Link href="/student/assessment" />}>
                    Take assessment <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              ) : (
                <>
                  <ScoreTrend points={trendPoints} />
                  {trendPoints.length === 1 && (
                    <p className="mt-2 text-center text-xs text-muted-foreground">
                      One score so far — take another assessment to grow your trend.
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* 5c. Roadmap timeline */}
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Your Learning Roadmap</CardTitle>
                  <CardDescription>
                    {roadmap && (roadmap.totalItems ?? 0) > 0
                      ? `${roadmap.completedItems ?? 0} of ${roadmap.totalItems ?? 0} steps · ${roadmap.progressPercent ?? 0}% complete`
                      : "Your phase-wise plan for this career."}
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" render={<Link href="/student/roadmap" />}>
                  View roadmap <ArrowRight className="size-3.5" aria-hidden="true" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingProgress ? (
                <div className="space-y-2.5">
                  <Skeleton className="h-14 w-full rounded-xl" />
                  <Skeleton className="h-14 w-full rounded-xl" />
                  <Skeleton className="h-14 w-full rounded-xl" />
                </div>
              ) : !hasTarget || !roadmap || (roadmap.totalItems ?? 0) === 0 ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Route className="size-7" aria-hidden="true" />
                  </span>
                  <p className="max-w-xs text-sm text-muted-foreground">
                    {hasTarget
                      ? "Your phase-wise plan appears here once it is published for your career."
                      : "Choose a target career to unlock your personalized roadmap."}
                  </p>
                  {!hasTarget && (
                    <Button size="sm" render={<Link href="/student/careers" />}>
                      Choose career <ArrowRight className="size-3.5" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <Progress
                    value={roadmap.progressPercent ?? 0}
                    tone={roadmapDone ? "green" : "primary"}
                    className="h-2"
                    aria-label={`Roadmap progress ${roadmap.progressPercent ?? 0} percent`}
                  />
                  <ol className="mt-4 space-y-1">
                    {timelineItems.map((item, index) => {
                      const locked =
                        index > 0 && timelineItems[index - 1]?.status !== "COMPLETED" && item.status !== "COMPLETED";
                      const status = item.status === "COMPLETED" ? "COMPLETED" : locked ? "LOCKED" : item.status;
                      return (
                        <li key={item.itemId} className="flex items-start gap-3 rounded-xl px-2 py-2.5 transition hover:bg-accent/50">
                          <span className="flex flex-col items-center">
                            {status === "COMPLETED" ? (
                              <CheckCircle2 className="size-5 shrink-0 text-chart-3" aria-hidden="true" />
                            ) : status === "IN_PROGRESS" ? (
                              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                                <Play className="size-2.5" aria-hidden="true" />
                              </span>
                            ) : (
                              <Circle className="size-5 shrink-0 text-muted-foreground/40" aria-hidden="true" />
                            )}
                            {index < timelineItems.length - 1 && (
                              <span className={cn("mt-1 w-0.5 flex-1 rounded", status === "COMPLETED" ? "bg-chart-3/40" : "bg-border/70")} style={{ minHeight: 14 }} aria-hidden="true" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className={cn("text-sm font-semibold leading-snug", status === "LOCKED" && "text-muted-foreground")}>
                              {item.title}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {item.phaseTitle}
                              {item.skillName ? ` · ${item.skillName}` : ""}
                              {item.estimatedHours != null ? ` · ~${item.estimatedHours}h` : ""}
                            </p>
                          </div>
                          <Badge variant="secondary" className={cn("shrink-0", ROADMAP_STATUS_STYLES[status] || "")}>
                            {roadmapStatusLabel(status)}
                          </Badge>
                        </li>
                      );
                    })}
                  </ol>
                </>
              )}
            </CardContent>
          </Card>

          {/* 5d. Projects */}
          <Card className="shadow-card">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Your Projects</CardTitle>
                  <CardDescription>
                    {projectTotal > 0
                      ? `${projectCompleted} of ${projectTotal} completed — finished builds turn gaps into proof.`
                      : "Recommended builds for your career."}
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" render={<Link href="/student/projects" />}>
                  View projects <ArrowRight className="size-3.5" aria-hidden="true" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingProgress ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Skeleton className="h-36 rounded-xl" />
                  <Skeleton className="h-36 rounded-xl" />
                  <Skeleton className="h-36 rounded-xl" />
                </div>
              ) : recentProjects.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <FolderKanban className="size-7" aria-hidden="true" />
                  </span>
                  <p className="max-w-xs text-sm text-muted-foreground">
                    No projects yet. Recommended builds appear here once published for your career.
                  </p>
                  <Button size="sm" render={<Link href="/student/projects" />}>
                    Explore projects <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3">
                  {recentProjects.map((project) => (
                    <div key={project.projectId} className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/40 p-4 transition hover:border-primary/40">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="secondary" className={cn("shrink-0", PROJECT_STATUS_STYLES[project.status] || "")}>
                          {projectStatusLabel(project.status)}
                        </Badge>
                        {project.difficulty && (
                          <span className="truncate text-[11px] font-semibold text-muted-foreground">
                            {prettifyEnum(project.difficulty)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-bold leading-snug">{project.title}</p>
                      {(project.skills || []).length > 0 && (
                        <p className="line-clamp-2 text-xs text-muted-foreground">
                          {(project.skills || []).slice(0, 3).map((s) => s.skillName).join(" · ")}
                        </p>
                      )}
                      <p className="mt-auto pt-1 text-[11px] text-muted-foreground">
                        {project.estimatedWeeks != null ? `~${project.estimatedWeeks} week${project.estimatedWeeks === 1 ? "" : "s"}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Rail — AM I IMPROVING + help */}
        <div className="min-w-0 space-y-4">
          {/* Readiness breakdown */}
          <Card className="border-primary/25 shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Career Readiness</CardTitle>
              <CardDescription>Overall plus honest per-area status.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              {loadingProgress ? (
                <>
                  <Skeleton className="size-28 rounded-full" />
                  <Skeleton className="h-24 w-full" />
                </>
              ) : !readinessReady ? (
                <div className="flex flex-col items-center gap-2 py-2 text-center">
                  <CircularProgress value={0} size={112} strokeWidth={10} tone="primary" label="Career readiness not yet available">
                    <span className="text-2xl font-bold text-muted-foreground">—</span>
                  </CircularProgress>
                  <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                    Your readiness appears here after your first assessment is submitted.
                  </p>
                  <Button size="sm" render={<Link href="/student/assessment" />}>
                    Take assessment <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Button>
                </div>
              ) : (
                <>
                  <CircularProgress
                    value={readinessPercent}
                    size={128}
                    strokeWidth={11}
                    tone={readinessPercent >= 80 ? "green" : "primary"}
                    label="Career readiness percentage"
                  >
                    <span className="tnum text-3xl font-bold tracking-tight text-primary">{readinessPercent}</span>
                    <span className="text-[11px] font-medium text-muted-foreground">ready</span>
                  </CircularProgress>
                  <ul className="w-full space-y-2.5 text-sm">
                    <li>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="font-medium">Skills</span>
                        <span className="tnum text-xs font-semibold text-muted-foreground">{skillsAtTarget}/{skillsTotal} on target</span>
                      </div>
                      <Progress
                        value={skillsTotal > 0 ? Math.round((skillsAtTarget / skillsTotal) * 100) : 0}
                        tone={skillsTotal > 0 && skillsAtTarget >= skillsTotal ? "green" : "primary"}
                        className="h-1.5"
                        aria-label={`${skillsAtTarget} of ${skillsTotal} skills on target`}
                      />
                    </li>
                    <li>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="font-medium">Assessments</span>
                        <span className="tnum text-xs font-semibold text-muted-foreground">{completedAssessments} submitted</span>
                      </div>
                      <Progress
                        value={availableCount ? Math.min(100, Math.round((completedAssessments / availableCount) * 100)) : completedAssessments > 0 ? 100 : 0}
                        tone="primary"
                        className="h-1.5"
                        aria-label={`${completedAssessments} assessments submitted`}
                      />
                    </li>
                    <li>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="font-medium">Projects</span>
                        <span className="tnum text-xs font-semibold text-muted-foreground">{projectCompleted}/{projectTotal} done</span>
                      </div>
                      <Progress
                        value={projectPct}
                        tone={projectPct >= 100 ? "green" : "primary"}
                        className="h-1.5"
                        aria-label={`${projectCompleted} of ${projectTotal} projects completed`}
                      />
                    </li>
                    <li className="flex items-center justify-between gap-2 border-t border-border/50 pt-2.5">
                      <span className="font-medium">CV</span>
                      {cv?.hasCv ? (
                        <span className="tnum text-xs font-semibold text-chart-3">
                          Analyzed{cv.overallScore != null ? ` · score ${cv.overallScore}` : ""}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not uploaded</span>
                      )}
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      <span className="font-medium">LinkedIn</span>
                      {linkedIn?.hasProfile ? (
                        <span className="tnum text-xs font-semibold text-chart-3">
                          {linkedIn.completenessPercent ?? 0}% complete
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not connected</span>
                      )}
                    </li>
                  </ul>
                  {scoreDelta != null && (
                    <Badge variant="secondary" className={cn(scoreDelta >= 0 ? "bg-chart-3/15 text-chart-3" : "bg-amber-500/15 text-amber-700")}>
                      <History className="size-3" aria-hidden="true" />
                      {scoreDelta >= 0 ? `+${scoreDelta} since previous assessment` : `${scoreDelta} vs previous assessment`}
                    </Badge>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* AI assistant */}
          <Card className="shadow-card">
            <CardContent className="flex flex-col gap-3 py-5">
              <div className="flex items-center gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Bot className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-bold">Ask Your AI Assistant</p>
                  <p className="text-xs text-muted-foreground">
                    Personalized guidance about your skills, career and roadmap.
                  </p>
                </div>
              </div>
              <ul className="space-y-1.5">
                {AI_QUICK_PROMPTS.map((prompt) => (
                  <li key={prompt}>
                    <Link
                      href="/student/ai"
                      title={prompt}
                      className="flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-xs font-medium transition outline-none hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      <span className="truncate">“{prompt}”</span>
                      <Sparkles className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
              <Button size="sm" className="w-full" render={<Link href="/student/ai" />}>
                <Bot className="size-3.5" aria-hidden="true" />
                Open AI Assistant
              </Button>
            </CardContent>
          </Card>

          {/* CV + LinkedIn compact */}
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Profile Strength</CardTitle>
              <CardDescription>Recruiter-facing proof, from real analyses.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingProgress ? (
                <>
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 p-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <FileText className="size-4.5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">CV Analysis</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {cv?.hasCv
                          ? `Analyzed${cv.overallScore != null ? ` · score ${cv.overallScore}` : ""}${(cv.matchedSkills?.length ?? 0) > 0 ? ` · ${cv.matchedSkills.length} skills matched` : ""}`
                          : "Upload your CV to detect your skills."}
                      </p>
                    </div>
                    <Button variant={cv?.hasCv ? "outline" : undefined} size="sm" render={<Link href="/student/cv" />}>
                      {cv?.hasCv ? "View" : "Upload"}
                    </Button>
                  </div>
                  <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 p-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Share2 className="size-4.5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">LinkedIn</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {linkedIn?.hasProfile
                          ? `Alignment ${linkedIn.completenessPercent ?? 0}% · ${linkedIn.matchedSkills?.length ?? 0} matched · ${linkedIn.missingSkills?.length ?? 0} missing`
                          : "Link your profile to check alignment."}
                      </p>
                    </div>
                    <Button variant={linkedIn?.hasProfile ? "outline" : undefined} size="sm" render={<Link href="/student/linkedin" />}>
                      {linkedIn?.hasProfile ? "View" : "Link"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Recent activity */}
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Recent Activity</CardTitle>
                  <CardDescription>From your real timestamps.</CardDescription>
                </div>
                <Button variant="outline" size="sm" render={<Link href="/student/progress" />}>
                  Full history
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingProgress ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full rounded-xl" />
                  <Skeleton className="h-12 w-full rounded-xl" />
                </div>
              ) : activity.length === 0 ? (
                <p className="py-2 text-xs leading-relaxed text-muted-foreground">
                  No activity yet. Submit an assessment or update your roadmap to see it here.
                </p>
              ) : (
                <>
                  <WeekActivity days={weekDays} className="mb-3" />
                  <ol className="space-y-2.5">
                  {activity.map((item, index) => (
                    <li key={`${item.type}-${item.occurredAt}-${index}`} className="flex items-start gap-2.5">
                      <Badge variant="secondary" className="mt-0.5 shrink-0">
                        {ACTIVITY_LABEL[item.type] || item.type}
                      </Badge>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">{item.title}</p>
                        <p className="text-[11px] text-muted-foreground">{formatDateTime(item.occurredAt)}</p>
                      </div>
                    </li>
                  ))}
                  </ol>
                </>
              )}
            </CardContent>
          </Card>
        </div>
        </div>
      </details>
    </div>
  );
}
