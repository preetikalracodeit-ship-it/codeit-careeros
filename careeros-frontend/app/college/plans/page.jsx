"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ClipboardList,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
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
import { formatDate } from "@/lib/format";

const PLAN_STATUSES = ["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"];

function label(value) {
  if (!value) return "Not set";
  return String(value)
    .toLowerCase()
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function studentLabel(student) {
  return [student.fullName, student.rollNumber, student.departmentName].filter(Boolean).join(" · ");
}

export default function CollegeImprovementPlansPage() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [plans, setPlans] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generateOpen, setGenerateOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generateForm, setGenerateForm] = useState({ enrollmentId: "", horizonDays: "30" });
  const [createForm, setCreateForm] = useState({
    enrollmentId: "",
    title: "",
    summary: "",
    taskTitle: "",
    taskPriority: "MEDIUM",
    taskTargetDate: "",
  });

  const canManage = me?.permissions?.includes("MANAGE_IMPROVEMENT_PLANS");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (search) params.search = search;
      if (status) params.status = status;
      setPlans(await api.get("/college/improvement-plans", { params }));
    } catch (err) {
      setError(err.message || "Could not load improvement plans.");
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    let ignore = false;
    api
      .get("/college/me")
      .then((data) => {
        if (!ignore) setMe(data);
      })
      .catch((err) => {
        if (!ignore) setError(err.message || "Could not load your college access.");
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async plan loader; state updates happen in promise callbacks
    load();
  }, [load]);

  useEffect(() => {
    if (!generateOpen && !createOpen) return undefined;
    let ignore = false;
    const timer = setTimeout(async () => {
      setStudentsLoading(true);
      try {
        const params = { size: 100, status: "ACTIVE", sortBy: "fullName", sortDir: "asc" };
        if (studentSearch.trim()) params.search = studentSearch.trim();
        const data = await api.get("/college/students", { params });
        if (!ignore) setStudents(data.items || []);
      } catch (err) {
        if (!ignore) toast.error(err.message || "Could not load students.");
      } finally {
        if (!ignore) setStudentsLoading(false);
      }
    }, 250);
    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [generateOpen, createOpen, studentSearch]);

  const studentOptions = useMemo(
    () => [
      { value: "", label: studentsLoading ? "Loading students..." : "Select a student" },
      ...students.map((student) => ({ value: String(student.id), label: studentLabel(student) })),
    ],
    [students, studentsLoading],
  );

  function applySearch(event) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  async function generatePlan(event) {
    event.preventDefault();
    if (!generateForm.enrollmentId) {
      toast.error("Select a student first.");
      return;
    }
    setSubmitting(true);
    try {
      const plan = await api.post("/college/improvement-plans/generate", {
        enrollmentId: Number(generateForm.enrollmentId),
        horizonDays: generateForm.horizonDays ? Number(generateForm.horizonDays) : null,
      });
      toast.success("Plan generated from assessed skill gaps.");
      setGenerateOpen(false);
      setGenerateForm({ enrollmentId: "", horizonDays: "30" });
      await load();
      if (plan?.id) {
        router.push(`/college/plans/${plan.id}`);
      }
    } catch (err) {
      toast.error(err.message || "Could not generate the plan.");
    } finally {
      setSubmitting(false);
    }
  }

  async function createPlan(event) {
    event.preventDefault();
    if (!createForm.enrollmentId || !createForm.title.trim()) {
      toast.error("Choose a student and enter a plan title.");
      return;
    }
    setSubmitting(true);
    try {
      const tasks = createForm.taskTitle.trim()
        ? [
            {
              title: createForm.taskTitle.trim(),
              priority: createForm.taskPriority,
              targetDate: createForm.taskTargetDate || null,
            },
          ]
        : [];
      const plan = await api.post("/college/improvement-plans", {
        enrollmentId: Number(createForm.enrollmentId),
        title: createForm.title.trim(),
        summary: createForm.summary.trim() || null,
        tasks,
      });
      toast.success("Improvement plan created.");
      setCreateOpen(false);
      setCreateForm({
        enrollmentId: "",
        title: "",
        summary: "",
        taskTitle: "",
        taskPriority: "MEDIUM",
        taskTargetDate: "",
      });
      await load();
      if (plan?.id) {
        router.push(`/college/plans/${plan.id}`);
      }
    } catch (err) {
      toast.error(err.message || "Could not create the plan.");
    } finally {
      setSubmitting(false);
    }
  }

  const items = plans?.items || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Improvement Plans"
        description="Plans generated only from assessed skill gaps, with student-owned tasks and progress."
        breadcrumb={<Breadcrumb items={[{ label: "Improvement Plans" }]} />}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={loading ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden="true" />
              Refresh
            </Button>
            {canManage && (
              <>
                <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="size-3.5" aria-hidden="true" />
                  Manual plan
                </Button>
                <Button size="sm" onClick={() => setGenerateOpen(true)}>
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  Generate from gaps
                </Button>
              </>
            )}
          </>
        }
      />

      <Alert>
        <AlertDescription>
          Generation uses only submitted assessment scores below the student&apos;s target career.
          Missing assessment data is never treated as a gap.
        </AlertDescription>
      </Alert>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_220px_auto]">
          <form onSubmit={applySearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search student, roll number or plan title"
                aria-label="Search improvement plans"
                className="h-10 pl-9"
              />
            </div>
            <Button type="submit" className="h-10">
              Search
            </Button>
          </form>
          <Select
            label="Plan status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            options={[
              { value: "", label: "All statuses" },
              ...PLAN_STATUSES.map((value) => ({ value, label: label(value) })),
            ]}
          />
          <div className="flex items-end">
            <Badge variant="secondary">
              {plans?.total ?? 0} plan{plans?.total === 1 ? "" : "s"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {loading && !plans ? (
        <LoadingState label="Loading improvement plans..." />
      ) : error && !plans ? (
        <ErrorState title="Couldn't load improvement plans" description={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No improvement plans yet"
          description={
            canManage
              ? "Generate a plan from assessed gaps or create one manually for a student in your scope."
              : "Plans created by your institution will appear here."
          }
          action={
            canManage ? (
              <Button size="sm" onClick={() => setGenerateOpen(true)}>
                <Sparkles className="size-3.5" aria-hidden="true" />
                Generate a plan
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((plan) => (
            <Card key={plan.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base">
                      <Link href={`/college/plans/${plan.id}`} className="hover:underline">
                        {plan.title}
                      </Link>
                    </CardTitle>
                    <CardDescription>
                      {plan.studentName} · {plan.rollNumber} · {plan.departmentName}
                    </CardDescription>
                  </div>
                  <Badge variant={plan.status === "ACTIVE" ? "default" : "secondary"}>
                    {label(plan.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {plan.summary || "No summary provided."}
                </p>
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted-foreground">
                      {plan.completedTasks}/{plan.totalTasks} tasks complete
                    </span>
                    <span className="tnum font-semibold">{plan.progressPercent}%</span>
                  </div>
                  <Progress value={plan.progressPercent} aria-label={`${plan.progressPercent}% complete`} />
                </div>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Target career</dt>
                    <dd className="font-medium">{plan.targetCareerName || "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Readiness</dt>
                    <dd className="font-medium">
                      {plan.currentReadinessPercent == null ? "Unavailable" : `${plan.currentReadinessPercent}%`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Owner</dt>
                    <dd className="font-medium">{plan.createdByName || "Not recorded"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Updated</dt>
                    <dd className="font-medium">{formatDate(plan.updatedAt)}</dd>
                  </div>
                </dl>
                {plan.tasks?.length > 0 && (
                  <ul className="space-y-1.5 text-xs">
                    {plan.tasks.slice(0, 3).map((task) => (
                      <li key={task.id} className="flex items-start justify-between gap-2">
                        <span className="min-w-0">{task.title}</span>
                        <Badge variant="outline" className="shrink-0">
                          {label(task.status)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
                <Button variant="outline" size="sm" render={<Link href={`/college/plans/${plan.id}`} />}>
                  Open plan
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        title="Generate from assessed gaps"
        description="Choose an active student. Only assessed skills below their target career become tasks."
        className="max-w-xl"
      >
        <form onSubmit={generatePlan} className="mt-4 space-y-4">
          <Field label="Search students" htmlFor="generate-student-search">
            {(id) => (
              <Input
                id={id}
                value={studentSearch}
                onChange={(event) => setStudentSearch(event.target.value)}
                placeholder="Name, roll number or student ID"
              />
            )}
          </Field>
          <Field label="Student" required htmlFor="generate-student">
            {(id) => (
              <Select
                id={id}
                value={generateForm.enrollmentId}
                onChange={(event) => setGenerateForm((prev) => ({ ...prev, enrollmentId: event.target.value }))}
                options={studentOptions}
              />
            )}
          </Field>
          <Field
            label="Task horizon (days)"
            htmlFor="generate-horizon"
            hint="Between 7 and 180 days. Tasks are spaced across this window."
          >
            {(id) => (
              <Input
                id={id}
                type="number"
                min="7"
                max="180"
                value={generateForm.horizonDays}
                onChange={(event) => setGenerateForm((prev) => ({ ...prev, horizonDays: event.target.value }))}
              />
            )}
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setGenerateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Generating..." : "Generate plan"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create a manual plan"
        description="Use this when a mentor-defined plan is needed. The student can still update their own task status."
        className="max-w-xl"
      >
        <form onSubmit={createPlan} className="mt-4 space-y-4">
          <Field label="Search students" htmlFor="create-student-search">
            {(id) => (
              <Input
                id={id}
                value={studentSearch}
                onChange={(event) => setStudentSearch(event.target.value)}
                placeholder="Name, roll number or student ID"
              />
            )}
          </Field>
          <Field label="Student" required htmlFor="create-student">
            {(id) => (
              <Select
                id={id}
                value={createForm.enrollmentId}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, enrollmentId: event.target.value }))}
                options={studentOptions}
              />
            )}
          </Field>
          <Field label="Plan title" required htmlFor="create-title">
            {(id) => (
              <Input
                id={id}
                value={createForm.title}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))}
                maxLength={200}
              />
            )}
          </Field>
          <Field label="Summary" htmlFor="create-summary">
            {(id) => (
              <Textarea
                id={id}
                value={createForm.summary}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, summary: event.target.value }))}
                maxLength={1000}
              />
            )}
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First task (optional)" htmlFor="create-task-title">
              {(id) => (
                <Input
                  id={id}
                  value={createForm.taskTitle}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, taskTitle: event.target.value }))}
                  maxLength={200}
                />
              )}
            </Field>
            <Field label="Priority" htmlFor="create-task-priority">
              {(id) => (
                <Select
                  id={id}
                  value={createForm.taskPriority}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, taskPriority: event.target.value }))}
                  options={["LOW", "MEDIUM", "HIGH"].map((value) => ({ value, label: label(value) }))}
                />
              )}
            </Field>
          </div>
          <Field label="Task target date" htmlFor="create-task-date">
            {(id) => (
              <Input
                id={id}
                type="date"
                value={createForm.taskTargetDate}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, taskTargetDate: event.target.value }))}
              />
            )}
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create plan"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
