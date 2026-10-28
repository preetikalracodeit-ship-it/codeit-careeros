"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ClipboardList, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Breadcrumb } from "@/components/breadcrumb";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import api from "@/lib/api";
import { formatDate } from "@/lib/format";

function label(value) {
  if (!value) return "Not set";
  return String(value)
    .toLowerCase()
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function taskTone(status) {
  if (status === "COMPLETED") return "bg-chart-3/15 text-chart-3";
  if (status === "OVERDUE" || status === "REASSESSMENT_REQUIRED") return "bg-destructive/10 text-destructive";
  if (status === "IN_PROGRESS") return "bg-primary/10 text-primary";
  return "bg-muted text-muted-foreground";
}

export default function StudentImprovementPlanPage() {
  const [plans, setPlans] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingTask, setSavingTask] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setPlans(await api.get("/students/me/improvement-plans"));
    } catch (err) {
      setError(err.message || "Could not load your improvement plans.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async plan loader; state updates happen in promise callbacks
    load();
  }, [load]);

  async function updateTask(task, status) {
    setSavingTask(task.id);
    try {
      await api.patch(`/students/me/improvement-plans/tasks/${task.id}`, { status });
      toast.success(status === "COMPLETED" ? "Task completed." : "Task status updated.");
      await load();
    } catch (err) {
      toast.error(err.message || "Could not update this task.");
    } finally {
      setSavingTask(null);
    }
  }

  const items = plans?.items || [];
  const allTasks = items.flatMap((plan) => plan.tasks || []);
  const completed = allTasks.filter((task) => task.status === "COMPLETED").length;

  if (loading && !plans) return <LoadingState label="Loading your improvement plans..." />;
  if (error && !plans) return <ErrorState title="Couldn't load your plans" description={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Improvement Plan"
        description="Tasks created from your assessed skill gaps. Update your progress as you build each skill."
        breadcrumb={<Breadcrumb items={[{ label: "Improvement Plan" }]} />}
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={loading ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {items.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Plans</p>
              <p className="text-2xl font-bold">{items.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Tasks complete</p>
              <p className="text-2xl font-bold">{completed}/{allTasks.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Overall progress</p>
              <p className="text-2xl font-bold">{allTasks.length ? Math.round((completed / allTasks.length) * 100) : 0}%</p>
            </CardContent>
          </Card>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No improvement plan yet"
          description="Your college will create a plan after reviewing your assessment gaps. Keep your assessment and target career up to date."
        />
      ) : (
        <div className="space-y-4">
          {items.map((plan) => (
            <Card key={plan.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{plan.title}</CardTitle>
                    <CardDescription>
                      {plan.targetCareerName ? `Target career: ${plan.targetCareerName}` : "Target career not set"}
                      {plan.createdByName ? ` · Created by ${plan.createdByName}` : ""}
                    </CardDescription>
                  </div>
                  <Badge variant={plan.status === "ACTIVE" ? "default" : "secondary"}>{label(plan.status)}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{plan.summary || "No summary provided."}</p>
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">
                      {plan.completedTasks}/{plan.totalTasks} tasks complete
                    </span>
                    <span className="tnum font-semibold">{plan.progressPercent}%</span>
                  </div>
                  <Progress value={plan.progressPercent} aria-label={`${plan.progressPercent}% complete`} />
                </div>

                <div className="space-y-3">
                  {(plan.tasks || []).map((task) => (
                    <div key={task.id} className="rounded-xl border border-border/70 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium">{task.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {task.skillName ? `${task.skillName} · ` : ""}
                            {task.priority ? `${label(task.priority)} priority · ` : ""}
                            Target {task.targetDate ? formatDate(task.targetDate) : "not set"}
                          </p>
                        </div>
                        <Badge className={`border-0 ${taskTone(task.status)}`}>{label(task.status)}</Badge>
                      </div>
                      {task.description && <p className="mt-2 text-sm text-muted-foreground">{task.description}</p>}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {task.status !== "IN_PROGRESS" && task.status !== "COMPLETED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateTask(task, "IN_PROGRESS")}
                            disabled={savingTask === task.id}
                          >
                            Start task
                          </Button>
                        )}
                        {task.status !== "COMPLETED" && (
                          <Button
                            size="sm"
                            onClick={() => updateTask(task, "COMPLETED")}
                            disabled={savingTask === task.id}
                          >
                            <CheckCircle2 className="size-3.5" aria-hidden="true" />
                            {savingTask === task.id ? "Saving..." : "Mark complete"}
                          </Button>
                        )}
                        {task.status === "COMPLETED" && (
                          <p className="flex items-center gap-1 text-xs font-medium text-chart-3">
                            <CheckCircle2 className="size-3.5" aria-hidden="true" />
                            Completed {task.completedAt ? formatDate(task.completedAt) : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
