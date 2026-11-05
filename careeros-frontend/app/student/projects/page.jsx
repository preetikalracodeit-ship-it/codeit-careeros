"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FolderKanban,
  Hammer,
  ListChecks,
  Loader2,
  Play,
  RotateCcw,
  Target,
  Trophy,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Breadcrumb } from "@/components/breadcrumb";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import api from "@/lib/api";
import { prettifyEnum } from "@/lib/format";
import { buildProjectPlan } from "@/lib/project-plan";
import { cn } from "cn";

const STATUS_STYLES = {
  NOT_STARTED: "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-primary/10 text-primary",
  COMPLETED: "bg-chart-3/15 text-chart-3",
};

function statusLabel(status) {
  if (status === "COMPLETED") return "Completed";
  if (status === "IN_PROGRESS") return "In progress";
  return "To do";
}

/** Full step-by-step plan shown when a student starts or opens a project. */
function ProjectPlan({ project }) {
  const plan = buildProjectPlan(project);
  const skills = project.skills || [];

  return (
    <div className="mt-4 max-h-[65vh] space-y-5 overflow-y-auto pr-1">
      <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-3.5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-primary">What you will finish</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{plan.outcome}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline">{prettifyEnum(project.difficulty)}</Badge>
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="size-3.5" aria-hidden="true" />~{project.estimatedWeeks} week
            {project.estimatedWeeks === 1 ? "" : "s"}
          </span>
          {skills.map((skill) => (
            <Badge key={skill.skillId} variant="outline" className="font-normal">
              {skill.skillName}
            </Badge>
          ))}
        </div>
      </div>

      <ol className="space-y-3">
        {plan.steps.map((step, index) => (
          <li key={step.key} className="rounded-xl border border-border/60 bg-background/40 p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-extrabold text-primary">
                {index + 1}
              </span>
              <p className="text-sm font-bold leading-snug">{step.title}</p>
              <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                <CalendarDays className="size-3.5" aria-hidden="true" />
                {step.when}
              </span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{step.detail}</p>
            <ul className="mt-2 space-y-1">
              {step.checklist.map((item) => (
                <li key={item} className="flex gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-primary/70" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <div className="rounded-xl border border-chart-3/30 bg-chart-3/[0.06] p-3.5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-chart-3">Definition of done</p>
        <ul className="mt-2 space-y-1">
          {plan.done.map((item) => (
            <li key={item} className="flex gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
              <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-chart-3" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function StudentProjectsPage() {
  const [projects, setProjects] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [pendingId, setPendingId] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [planProject, setPlanProject] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = await api.get("/projects/recommended");
      setProjects(data || null);
    } catch (err) {
      setLoadError(err?.message || "Failed to load recommended projects.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data loader; state updates happen in promise callbacks
    load();
  }, [load]);

  async function setStatus(projectId, status) {
    setPendingId(projectId);
    try {
      await api.put(`/projects/${projectId}/status`, { status });
      await load();
      if (status === "COMPLETED") toast.success("Project completed — nice portfolio win!");
      else if (status === "IN_PROGRESS") toast.success("Project started — your step-by-step plan is ready.");
      return true;
    } catch (err) {
      toast.error(err?.message || "Failed to update the project.");
      return false;
    } finally {
      setPendingId(null);
    }
  }

  const allItems = useMemo(() => projects?.projects || [], [projects]);
  const total = projects?.totalProjects ?? allItems.length;
  const inProgress = projects?.inProgressProjects ?? allItems.filter((p) => p.status === "IN_PROGRESS").length;
  const completed = projects?.completedProjects ?? allItems.filter((p) => p.status === "COMPLETED").length;

  const items = useMemo(() => {
    if (filter === "ALL") return allItems;
    return allItems.filter((p) => p.status === filter);
  }, [allItems, filter]);

  if (loading) return <LoadingState label="Loading recommended projects…" />;

  if (loadError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Projects"
          description="Build proof of your skills."
          breadcrumb={<Breadcrumb items={[{ label: "Projects" }]} />}
        />
        <ErrorState title="Couldn't load projects" description={loadError} onRetry={load} />
      </div>
    );
  }

  if (!projects?.hasTarget) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Projects"
          description="Build proof of your skills."
          breadcrumb={<Breadcrumb items={[{ label: "Projects" }]} />}
        />
        <EmptyState
          icon={Target}
          title="Choose your target career first"
          description="Project recommendations are mapped to your target career and skill gaps. Select one to unlock them."
          action={
            <Button size="sm" render={<Link href="/student/careers" />}>
              Choose career
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          }
        />
      </div>
    );
  }

  const tabs = [
    { value: "ALL", label: `All (${total})` },
    { value: "NOT_STARTED", label: `To do (${total - inProgress - completed})` },
    { value: "IN_PROGRESS", label: `In progress (${inProgress})` },
    { value: "COMPLETED", label: `Completed (${completed})` },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Projects"
        description={`Recommended builds for ${projects.careerName || "your career"} — matched to your skill gaps.`}
        breadcrumb={<Breadcrumb items={[{ label: "Projects" }]} />}
      />

      {/* Simple overview */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: FolderKanban, label: "Recommended", value: total, tint: "bg-primary/10 text-primary" },
          { icon: Hammer, label: "In progress", value: inProgress, tint: "bg-chart-2/15 text-amber-700 dark:text-amber-400" },
          { icon: Trophy, label: "Completed", value: completed, tint: "bg-chart-3/15 text-chart-3" },
        ].map((stat) => (
          <Card key={stat.label} className="shadow-card">
            <CardContent className="flex items-center gap-3 py-5">
              <span className={cn("flex size-10 items-center justify-center rounded-xl", stat.tint)}>
                <stat.icon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="tnum text-2xl font-bold tracking-tight">{stat.value}</p>
                <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Simple filter */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter projects by status">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setFilter(tab.value)}
            aria-pressed={filter === tab.value}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-semibold transition",
              filter === tab.value
                ? "bg-foreground text-background shadow-sm"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {allItems.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects published yet"
          description="Your target career has no recommended projects right now. Check back soon."
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="Nothing here yet"
          description="No projects with this status. Try another filter."
          action={
            <Button size="sm" variant="outline" onClick={() => setFilter("ALL")}>
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Show all
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((project) => {
            const busy = pendingId === project.projectId;
            const skills = project.skills || [];
            return (
              <Card key={project.projectId} className="flex flex-col shadow-card transition hover:shadow-card-hover">
                <CardHeader className="pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">{project.title}</CardTitle>
                    <Badge variant="secondary" className={cn("shrink-0", STATUS_STYLES[project.status] || "")}>
                      {statusLabel(project.status)}
                    </Badge>
                  </div>
                  <CardDescription className="leading-relaxed">{project.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4 pt-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{prettifyEnum(project.difficulty)}</Badge>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 className="size-3.5" aria-hidden="true" />
                      ~{project.estimatedWeeks} week{project.estimatedWeeks === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Skills covered
                    </p>
                    {skills.length === 0 ? (
                      <p className="mt-1.5 text-xs text-muted-foreground">General portfolio build.</p>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {skills.map((skill) => (
                          <Badge
                            key={skill.skillId}
                            variant="outline"
                            className="font-normal"
                            title={
                              skill.assessed
                                ? `You: ${skill.scorePercent}% · Target: ${skill.targetPercent}%`
                                : `Target: ${skill.targetPercent ?? "—"}%`
                            }
                          >
                            {skill.skillName}
                            <span className="tnum text-muted-foreground">
                              {skill.assessed ? ` · ${skill.scorePercent}%` : ""}
                            </span>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-auto flex flex-wrap gap-2 border-t border-border/60 pt-3.5">
                    {project.status === "NOT_STARTED" && (
                      <Button
                        size="sm"
                        className="flex-1"
                        disabled={busy}
                        onClick={async () => {
                          const started = await setStatus(project.projectId, "IN_PROGRESS");
                          if (started) setPlanProject({ ...project, status: "IN_PROGRESS" });
                        }}
                      >
                        {busy ? (
                          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <Play className="size-3.5" aria-hidden="true" />
                        )}
                        Start project
                      </Button>
                    )}
                    {project.status === "IN_PROGRESS" && (
                      <>
                        <Button size="sm" className="flex-1" disabled={busy} onClick={() => setStatus(project.projectId, "COMPLETED")}>
                          {busy ? (
                            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                          ) : (
                            <CheckCircle2 className="size-3.5" aria-hidden="true" />
                          )}
                          Mark complete
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setPlanProject(project)}>
                          <ListChecks className="size-3.5" aria-hidden="true" />
                          View plan
                        </Button>
                        <Button variant="outline" size="sm" disabled={busy} onClick={() => setStatus(project.projectId, "NOT_STARTED")}>
                          Reset
                        </Button>
                      </>
                    )}
                    {project.status === "COMPLETED" && (
                      <>
                        <Button variant="outline" size="sm" className="flex-1" disabled={busy} onClick={() => setStatus(project.projectId, "IN_PROGRESS")}>
                          <RotateCcw className="size-3.5" aria-hidden="true" />
                          Reopen
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setPlanProject(project)}>
                          <ListChecks className="size-3.5" aria-hidden="true" />
                          View plan
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={Boolean(planProject)}
        onOpenChange={(open) => {
          if (!open) setPlanProject(null);
        }}
        title={planProject?.title || "Project plan"}
        description={
          planProject
            ? `Step-by-step plan to finish this project in about ${planProject.estimatedWeeks} week${
                planProject.estimatedWeeks === 1 ? "" : "s"
              }.`
            : undefined
        }
        className="max-w-2xl"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setPlanProject(null)}>
              Close
            </Button>
            {planProject?.status === "IN_PROGRESS" && (
              <Button
                size="sm"
                disabled={pendingId === planProject.projectId}
                onClick={async () => {
                  const completed = await setStatus(planProject.projectId, "COMPLETED");
                  if (completed) setPlanProject(null);
                }}
              >
                {pendingId === planProject.projectId ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                )}
                Mark complete
              </Button>
            )}
          </>
        }
      >
        {planProject && <ProjectPlan project={planProject} />}
      </Dialog>
    </div>
  );
}
