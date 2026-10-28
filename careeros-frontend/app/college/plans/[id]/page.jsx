"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ClipboardList, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Breadcrumb } from "@/components/breadcrumb";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import api from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/format";

const PLAN_STATUSES = ["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"];
const TASK_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "OVERDUE", "REASSESSMENT_REQUIRED"];
const PRIORITIES = ["LOW", "MEDIUM", "HIGH"];

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

export default function CollegeImprovementPlanDetailPage() {
  const params = useParams();
  const planId = params?.id;
  const [me, setMe] = useState(null);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [planForm, setPlanForm] = useState({ title: "", summary: "", status: "ACTIVE" });
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    priority: "MEDIUM",
    targetDate: "",
  });
  const [addingTask, setAddingTask] = useState(false);
  const [taskEdits, setTaskEdits] = useState({});

  const canManage = me?.permissions?.includes("MANAGE_IMPROVEMENT_PLANS");

  const load = useCallback(async () => {
    if (!planId) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.get(`/college/improvement-plans/${planId}`);
      setPlan(data);
      setPlanForm({
        title: data.title || "",
        summary: data.summary || "",
        status: data.status || "ACTIVE",
      });
    } catch (err) {
      setError(err.message || "Could not load this improvement plan.");
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    let ignore = false;
    api
      .get("/college/me")
      .then((data) => {
        if (!ignore) setMe(data);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async plan loader; state updates happen in promise callbacks
    load();
  }, [load]);

  async function savePlan(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await api.put(`/college/improvement-plans/${planId}`, {
        title: planForm.title.trim(),
        summary: planForm.summary.trim(),
        status: planForm.status,
      });
      setPlan(updated);
      toast.success("Plan updated.");
    } catch (err) {
      toast.error(err.message || "Could not update the plan.");
    } finally {
      setSaving(false);
    }
  }

  async function addTask(event) {
    event.preventDefault();
    if (!taskForm.title.trim()) {
      toast.error("Enter a task title.");
      return;
    }
    setAddingTask(true);
    try {
      const updated = await api.post(`/college/improvement-plans/${planId}/tasks`, {
        title: taskForm.title.trim(),
        description: taskForm.description.trim() || null,
        priority: taskForm.priority,
        targetDate: taskForm.targetDate || null,
      });
      setPlan(updated);
      setTaskForm({ title: "", description: "", priority: "MEDIUM", targetDate: "" });
      toast.success("Task added.");
    } catch (err) {
      toast.error(err.message || "Could not add the task.");
    } finally {
      setAddingTask(false);
    }
  }

  function editFor(task) {
    return (
      taskEdits[task.id] || {
        status: task.status || "NOT_STARTED",
        targetDate: task.targetDate || "",
        ownerName: task.ownerName || "",
        description: task.description || "",
      }
    );
  }

  function setTaskEdit(taskId, patch) {
    setTaskEdits((prev) => ({
      ...prev,
      [taskId]: { ...(prev[taskId] || {}), ...patch },
    }));
  }

  async function saveTask(task) {
    const values = editFor(task);
    setSaving(true);
    try {
      const updated = await api.patch(`/college/improvement-plans/${planId}/tasks/${task.id}`, {
        status: values.status,
        targetDate: values.targetDate || null,
        ownerName: values.ownerName?.trim() ?? "",
        description: values.description?.trim() ?? "",
      });
      setPlan(updated);
      setTaskEdits((prev) => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });
      toast.success("Task updated.");
    } catch (err) {
      toast.error(err.message || "Could not update the task.");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !plan) return <LoadingState label="Loading improvement plan..." />;

  if (error && !plan) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Improvement Plan"
          breadcrumb={<Breadcrumb items={[{ label: "Improvement Plans", href: "/college/plans" }, { label: "Plan" }]} />}
        />
        <ErrorState title="Couldn't load this plan" description={error} onRetry={load} />
      </div>
    );
  }

  if (!plan) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Plan not found"
        description="This plan may have been removed or is outside your academic scope."
        action={<Button render={<Link href="/college/plans" />}>Back to plans</Button>}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={plan.title}
        description={`${plan.studentName} · ${plan.rollNumber} · ${plan.departmentName} / ${plan.programName}`}
        breadcrumb={
          <Breadcrumb
            items={[
              { label: "Improvement Plans", href: "/college/plans" },
              { label: plan.studentName || "Plan" },
            ]}
          />
        }
        actions={
          <>
            <Button variant="outline" size="sm" render={<Link href="/college/plans" />}>
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              All plans
            </Button>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={loading ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden="true" />
              Refresh
            </Button>
          </>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan summary</CardTitle>
            <CardDescription>Tasks are owned by the student or a mentor and can be updated as evidence changes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={plan.status === "ACTIVE" ? "default" : "secondary"}>{label(plan.status)}</Badge>
              <Badge variant="outline">{plan.completedTasks}/{plan.totalTasks} complete</Badge>
              <Badge variant="outline">{plan.progressPercent}%</Badge>
            </div>
            <Progress value={plan.progressPercent} aria-label={`${plan.progressPercent}% complete`} />
            <p className="text-sm text-muted-foreground">{plan.summary || "No summary provided."}</p>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Target career</dt>
                <dd className="font-medium">{plan.targetCareerName || "Not set"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Current readiness</dt>
                <dd className="font-medium">
                  {plan.currentReadinessPercent == null ? "Unavailable" : `${plan.currentReadinessPercent}%`}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Created by</dt>
                <dd className="font-medium">{plan.createdByName || "Not recorded"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Last updated</dt>
                <dd className="font-medium">{formatDateTime(plan.updatedAt)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit plan</CardTitle>
            <CardDescription>{canManage ? "Update plan metadata or close the plan." : "Your role can view but not edit this plan."}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={savePlan} className="space-y-3">
              <Field label="Title" htmlFor="plan-title">
                {(id) => (
                  <Input
                    id={id}
                    value={planForm.title}
                    onChange={(event) => setPlanForm((prev) => ({ ...prev, title: event.target.value }))}
                    disabled={!canManage}
                    maxLength={200}
                  />
                )}
              </Field>
              <Field label="Summary" htmlFor="plan-summary">
                {(id) => (
                  <Textarea
                    id={id}
                    value={planForm.summary}
                    onChange={(event) => setPlanForm((prev) => ({ ...prev, summary: event.target.value }))}
                    disabled={!canManage}
                    maxLength={1000}
                  />
                )}
              </Field>
              <Field label="Status" htmlFor="plan-status">
                {(id) => (
                  <Select
                    id={id}
                    value={planForm.status}
                    onChange={(event) => setPlanForm((prev) => ({ ...prev, status: event.target.value }))}
                    disabled={!canManage}
                    options={PLAN_STATUSES.map((value) => ({ value, label: label(value) }))}
                  />
                )}
              </Field>
              <Button type="submit" disabled={!canManage || saving}>
                {saving ? "Saving..." : "Save plan"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="size-4" aria-hidden="true" />
            Tasks
          </CardTitle>
          <CardDescription>{plan.tasks?.length || 0} task{plan.tasks?.length === 1 ? "" : "s"} in this plan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {plan.tasks?.length ? (
            <div className="space-y-3">
              {plan.tasks.map((task) => {
                const values = editFor(task);
                return (
                  <div key={task.id} className="rounded-xl border border-border/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">{task.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {task.skillName ? `${task.skillName} · ` : ""}
                          Target {task.targetDate ? formatDate(task.targetDate) : "not set"}
                          {task.ownerName ? ` · Owner ${task.ownerName}` : ""}
                        </p>
                      </div>
                      <Badge className={`border-0 ${taskTone(task.status)}`}>{label(task.status)}</Badge>
                    </div>
                    {task.description && <p className="mt-2 text-sm text-muted-foreground">{task.description}</p>}
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <Select
                        aria-label={`Status for ${task.title}`}
                        value={values.status}
                        onChange={(event) => setTaskEdit(task.id, { status: event.target.value })}
                        disabled={!canManage}
                        options={TASK_STATUSES.map((value) => ({ value, label: label(value) }))}
                      />
                      <Input
                        type="date"
                        aria-label={`Target date for ${task.title}`}
                        value={values.targetDate}
                        onChange={(event) => setTaskEdit(task.id, { targetDate: event.target.value })}
                        disabled={!canManage}
                      />
                      <Input
                        aria-label={`Owner for ${task.title}`}
                        value={values.ownerName}
                        onChange={(event) => setTaskEdit(task.id, { ownerName: event.target.value })}
                        placeholder="Owner name"
                        disabled={!canManage}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => saveTask(task)}
                        disabled={!canManage || saving}
                      >
                        Save task
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              compact
              icon={ClipboardList}
              title="No tasks yet"
              description={canManage ? "Add the first task below." : "The plan owner has not added tasks yet."}
            />
          )}

          {canManage && (
            <form onSubmit={addTask} className="space-y-3 rounded-xl border border-dashed border-border p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Plus className="size-4" aria-hidden="true" />
                Add a task
              </p>
              <Field label="Task title" required htmlFor="task-title">
                {(id) => (
                  <Input
                    id={id}
                    value={taskForm.title}
                    onChange={(event) => setTaskForm((prev) => ({ ...prev, title: event.target.value }))}
                    maxLength={200}
                  />
                )}
              </Field>
              <Field label="Description" htmlFor="task-description">
                {(id) => (
                  <Textarea
                    id={id}
                    value={taskForm.description}
                    onChange={(event) => setTaskForm((prev) => ({ ...prev, description: event.target.value }))}
                    maxLength={1000}
                  />
                )}
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Priority" htmlFor="task-priority">
                  {(id) => (
                    <Select
                      id={id}
                      value={taskForm.priority}
                      onChange={(event) => setTaskForm((prev) => ({ ...prev, priority: event.target.value }))}
                      options={PRIORITIES.map((value) => ({ value, label: label(value) }))}
                    />
                  )}
                </Field>
                <Field label="Target date" htmlFor="task-date">
                  {(id) => (
                    <Input
                      id={id}
                      type="date"
                      value={taskForm.targetDate}
                      onChange={(event) => setTaskForm((prev) => ({ ...prev, targetDate: event.target.value }))}
                    />
                  )}
                </Field>
              </div>
              <Button type="submit" disabled={addingTask}>
                {addingTask ? "Adding..." : "Add task"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
