import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../lib/api.js";
import { Badge, EmptyState, ErrorBlock, LoadingBlock, PageHeader, Panel, ProgressBar, StatCard } from "../components/ui.jsx";
import { Icon } from "../components/Icon.jsx";

function formatDate(value) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not set" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function pretty(value) {
  if (!value) return "Not set";
  return String(value).toLowerCase().split("_").map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join(" ");
}

function taskTone(status) {
  if (status === "COMPLETED") return "positive";
  if (status === "OVERDUE" || status === "REASSESSMENT_REQUIRED") return "danger";
  if (status === "IN_PROGRESS") return "warning";
  return "muted";
}

export function StudentImprovementPlanPage() {
  const [plans, setPlans] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setPlans(await api.get("/students/me/improvement-plans"));
    } catch (reason) {
      setError(reason.message || "Unable to load your improvement plans.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function updateTask(task, status) {
    setSaving(task.id);
    try {
      await api.patch(`/students/me/improvement-plans/tasks/${task.id}`, { status });
      toast.success(status === "COMPLETED" ? "Task completed." : "Task updated.");
      await load();
    } catch (reason) {
      toast.error(reason.message || "Unable to update this task.");
    } finally {
      setSaving(null);
    }
  }

  if (loading && !plans) return <main className="workspace-page"><LoadingBlock label="Loading your improvement plan..." /></main>;
  if (error && !plans) return <main className="workspace-page"><ErrorBlock message={error} onRetry={load} /></main>;

  const items = plans?.items || [];
  const allTasks = items.flatMap((plan) => plan.tasks || []);
  const completed = allTasks.filter((task) => task.status === "COMPLETED").length;
  const overall = allTasks.length ? Math.round((completed / allTasks.length) * 100) : 0;

  return <main className="workspace-page improvement-page">
    <PageHeader eyebrow="GROWTH PLAN" title="My improvement plan" description="Tasks built from your assessed skill gaps. Update each task as you make progress." actions={<button className="secondary-button" onClick={load} disabled={loading}><Icon name="activity" size={14} /> {loading ? "Refreshing..." : "Refresh"}</button>} />
    {error && <div className="success-banner roadmap-error" role="alert">{error}</div>}

    {items.length > 0 && <div className="stat-grid stat-grid-3">
      <StatCard label="Plans" value={items.length} hint="Assigned to you" icon="clipboard" />
      <StatCard label="Tasks complete" value={`${completed}/${allTasks.length}`} hint="Across all plans" tone="positive" icon="check" />
      <StatCard label="Overall progress" value={`${overall}%`} hint="Keep tasks moving" tone={overall >= 70 ? "positive" : "warning"} icon="chart" />
    </div>}

    {items.length === 0 ? <section className="settings-card"><EmptyState icon="clipboard" title="No improvement plan yet" description="Your college creates a plan after reviewing assessment gaps. Keep your assessments and target career up to date." /></section> : <div className="improvement-plans">{items.map((plan) => <Panel key={plan.id} title={plan.title} description={`${plan.targetCareerName ? `Target career: ${plan.targetCareerName}` : "Target career not set"}${plan.createdByName ? ` - Created by ${plan.createdByName}` : ""}`} actions={<Badge tone={plan.status === "ACTIVE" ? "info" : "muted"}>{pretty(plan.status)}</Badge>}>
      <p className="muted">{plan.summary || "No summary provided."}</p>
      <div className="improvement-progress"><div><span>{plan.completedTasks}/{plan.totalTasks} tasks complete</span><strong>{plan.progressPercent}%</strong></div><ProgressBar value={plan.progressPercent} /></div>
      <div className="improvement-tasks">{(plan.tasks || []).map((task) => <article key={task.id} className="improvement-task">
        <div className="improvement-task-top">
          <div><strong>{task.title}</strong><span>{task.skillName ? `${task.skillName} - ` : ""}{task.priority ? `${pretty(task.priority)} priority - ` : ""}Target {formatDate(task.targetDate)}</span></div>
          <Badge tone={taskTone(task.status)}>{pretty(task.status)}</Badge>
        </div>
        {task.description && <p>{task.description}</p>}
        {(task.baselineScore != null || task.targetScore != null) && <small>Baseline {task.baselineScore ?? "-"}% - Target {task.targetScore ?? "-"}%</small>}
        <div className="button-row">
          {task.status !== "COMPLETED" && <button className="primary-button" disabled={saving === task.id} onClick={() => updateTask(task, "COMPLETED")}><Icon name="check" size={14} /> {saving === task.id ? "Saving..." : "Mark complete"}</button>}
          {task.status !== "IN_PROGRESS" && task.status !== "COMPLETED" && <button className="secondary-button" disabled={saving === task.id} onClick={() => updateTask(task, "IN_PROGRESS")}>Start task</button>}
          {task.status === "IN_PROGRESS" && <button className="secondary-button" disabled={saving === task.id} onClick={() => updateTask(task, "NOT_STARTED")}>Reset</button>}
          {task.status === "COMPLETED" && <span className="improvement-done"><Icon name="check" size={13} /> Completed {formatDate(task.completedAt)}</span>}
        </div>
      </article>)}</div>
    </Panel>)}</div>}
  </main>;
}
