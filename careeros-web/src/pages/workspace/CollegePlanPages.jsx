import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../../lib/api.js";
import { Badge, DataTable, ErrorBlock, LoadingBlock, PageHeader, Panel, ProgressBar, StatCard } from "../../components/ui.jsx";
import { Modal, formatDate } from "./shared.jsx";

const PLAN_STATUSES = ["DRAFT", "ACTIVE", "COMPLETED", "ARCHIVED"];
const TASK_STATUSES = ["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "REASSESSMENT_REQUIRED"];
const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH"];

function prettify(value) {
  if (!value) return "Not set";
  return String(value).toLowerCase().split("_").map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join(" ");
}

function planTone(status) {
  if (status === "COMPLETED") return "positive";
  if (status === "ACTIVE") return "info";
  if (status === "ARCHIVED") return "muted";
  return "warning";
}

function taskTone(status) {
  if (status === "COMPLETED") return "positive";
  if (status === "OVERDUE" || status === "REASSESSMENT_REQUIRED") return "danger";
  if (status === "IN_PROGRESS") return "info";
  return "muted";
}

export function CollegePlansPage() {
  const location = useLocation();
  const basePath = location.pathname.replace(/\/$/, "");
  const [items, setItems] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [generate, setGenerate] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [planData, studentData] = await Promise.all([
        api.get("/college/improvement-plans"),
        api.get("/college/students", { params: { size: 100 } }),
      ]);
      setItems(planData?.items || []);
      setStudents(studentData?.items || []);
    } catch (reason) {
      setError(reason.message || "Could not load improvement plans.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((plan) => {
      if (statusFilter !== "ALL" && plan.status !== statusFilter) return false;
      if (!term) return true;
      return `${plan.studentName} ${plan.rollNumber} ${plan.title} ${plan.targetCareerName || ""}`.toLowerCase().includes(term);
    });
  }, [items, search, statusFilter]);

  const planStudentIds = useMemo(() => new Set(items.map((plan) => plan.studentProfileId)), [items]);
  const availableStudents = useMemo(
    () => students.filter((student) => student.status === "ACTIVE" && !planStudentIds.has(student.id)),
    [students, planStudentIds],
  );

  const overdueTasks = items.reduce((sum, plan) => sum + (plan.tasks || []).filter((task) => task.overdue).length, 0);

  async function generatePlan(event) {
    event.preventDefault();
    if (!generate?.studentId) {
      toast.error("Choose a student to generate a plan for.");
      return;
    }
    setBusy(true);
    try {
      const detail = await api.get(`/college/students/${generate.studentId}`);
      const enrollmentId = detail?.enrollment?.id;
      if (!enrollmentId) throw new Error("This student does not have an active enrollment.");
      await api.post("/college/improvement-plans/generate", { enrollmentId, horizonDays: generate.horizonDays ? Number(generate.horizonDays) : undefined });
      toast.success("Improvement plan generated.");
      setGenerate(null);
      await load();
    } catch (reason) {
      toast.error(reason.message || "Could not generate the plan. The student may need a submitted assessment first.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingBlock label="Loading improvement plans…" />;
  if (error) return <div className="workspace-page-content"><PageHeader eyebrow="PLANS" title="Improvement plans" description="Student improvement plans across your college." /><ErrorBlock message={error} onRetry={load} /></div>;

  return (
    <div className="workspace-page-content">
      <PageHeader
        eyebrow="PLANS"
        title="Improvement plans"
        description="Targeted action plans that close each student's highest-priority skill gaps."
        actions={<button type="button" className="primary-button" onClick={() => setGenerate({ studentId: "", horizonDays: "30" })}>Generate plan</button>}
      />
      <div className="stat-grid stat-grid-4">
        <StatCard label="Plans" value={items.length} hint="Across active enrollments" icon="clipboard" />
        <StatCard label="Active" value={items.filter((plan) => plan.status === "ACTIVE").length} hint="In progress now" icon="activity" />
        <StatCard label="Completed" value={items.filter((plan) => plan.status === "COMPLETED").length} hint="Closed successfully" icon="check" />
        <StatCard label="Overdue tasks" value={overdueTasks} hint="Need mentor attention" icon="calendar" />
      </div>
      <Panel
        title="Plan register"
        description="Open a plan to update its status, tasks and target dates."
        actions={
          <div className="button-row">
            <input className="search-input" placeholder="Search students or plans…" value={search} onChange={(event) => setSearch(event.target.value)} />
            <select className="inline-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="ALL">All statuses</option>
              {PLAN_STATUSES.map((status) => <option key={status} value={status}>{prettify(status)}</option>)}
            </select>
          </div>
        }
      >
        <DataTable
          empty="No improvement plans match this filter"
          rows={filtered}
          getKey={(plan) => plan.id}
          columns={[
            { key: "student", label: "Student", render: (plan) => <div><strong>{plan.studentName}</strong><p className="muted">{plan.rollNumber} · {plan.batchLabel}</p></div> },
            { key: "plan", label: "Plan", render: (plan) => <div><strong>{plan.title}</strong><p className="muted">{plan.targetCareerName || "No target career"}</p></div> },
            { key: "readiness", label: "Readiness", render: (plan) => plan.currentReadinessPercent == null ? "—" : `${plan.currentReadinessPercent}%` },
            { key: "progress", label: "Progress", render: (plan) => <div><ProgressBar value={plan.progressPercent || 0} /><p className="muted">{plan.completedTasks} of {plan.totalTasks} tasks</p></div> },
            { key: "status", label: "Status", render: (plan) => <Badge tone={planTone(plan.status)}>{prettify(plan.status)}</Badge> },
            { key: "updated", label: "Updated", render: (plan) => formatDate(plan.updatedAt) },
            { key: "actions", label: "", render: (plan) => <Link className="link-button" to={`${basePath}/${plan.id}`}>Open</Link> },
          ]}
        />
      </Panel>

      {generate && (
        <Modal title="Generate improvement plan" description="We use the student's latest assessment to build a task plan automatically." onClose={() => setGenerate(null)}>
          <form className="stack-form" onSubmit={generatePlan}>
            <label className="form-field">Student
              <select required value={generate.studentId} onChange={(event) => setGenerate((current) => ({ ...current, studentId: event.target.value }))}>
                <option value="">Select a student</option>
                {availableStudents.map((student) => <option key={student.id} value={student.id}>{student.fullName} · {student.rollNumber}</option>)}
              </select>
            </label>
            {!availableStudents.length && <p className="muted">Every active student already has a plan. Open a plan to edit it.</p>}
            <label className="form-field">Horizon (days)
              <input type="number" min="1" max="365" value={generate.horizonDays} onChange={(event) => setGenerate((current) => ({ ...current, horizonDays: event.target.value }))} />
            </label>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setGenerate(null)}>Cancel</button>
              <button type="submit" className="primary-button" disabled={busy || !availableStudents.length}>{busy ? "Generating…" : "Generate plan"}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export function CollegePlanDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [taskForm, setTaskForm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const detail = await api.get(`/college/improvement-plans/${id}`);
      setPlan(detail);
      setStatus(detail.status);
    } catch (reason) {
      setError(reason.message || "Could not load this improvement plan.");
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function saveStatus() {
    setBusy(true);
    try {
      await api.put(`/college/improvement-plans/${id}`, { status });
      toast.success("Plan status updated.");
      await load();
    } catch (reason) {
      toast.error(reason.message || "Could not update the plan status.");
    } finally {
      setBusy(false);
    }
  }

  async function updateTaskStatus(task, nextStatus) {
    try {
      await api.patch(`/college/improvement-plans/${id}/tasks/${task.id}`, { status: nextStatus });
      toast.success("Task updated.");
      await load();
    } catch (reason) {
      toast.error(reason.message || "Could not update the task.");
    }
  }

  function openTask() {
    setTaskForm({
      title: "",
      description: "",
      priority: "MEDIUM",
      targetDate: "",
      ownerName: plan?.studentName || "",
    });
  }

  async function addTask(event) {
    event.preventDefault();
    if (!taskForm.title.trim()) {
      toast.error("Enter a task title.");
      return;
    }
    setBusy(true);
    try {
      await api.post(`/college/improvement-plans/${id}/tasks`, {
        title: taskForm.title.trim(),
        description: taskForm.description.trim() || null,
        priority: taskForm.priority,
        targetDate: taskForm.targetDate || null,
        ownerName: taskForm.ownerName.trim() || null,
      });
      toast.success("Task added.");
      setTaskForm(null);
      await load();
    } catch (reason) {
      toast.error(reason.message || "Could not add the task.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingBlock label="Loading improvement plan…" />;
  if (error) return <div className="workspace-page-content"><PageHeader eyebrow="PLANS" title="Improvement plan" description="Student improvement plan." /><ErrorBlock message={error} onRetry={load} /></div>;

  return (
    <div className="workspace-page-content">
      <PageHeader
        eyebrow="IMPROVEMENT PLAN"
        title={plan.title}
        description={`${plan.studentName} · ${plan.rollNumber} · ${plan.batchLabel}`}
        actions={
          <div className="button-row">
            <button type="button" className="secondary-button" onClick={() => navigate("/college/plans")}>Back</button>
            <button type="button" className="primary-button" onClick={openTask}>Add task</button>
          </div>
        }
      />
      <div className="stat-grid stat-grid-4">
        <StatCard label="Readiness" value={plan.currentReadinessPercent == null ? "—" : `${plan.currentReadinessPercent}%`} hint={plan.targetCareerName || "No target career"} icon="target" />
        <StatCard label="Progress" value={`${plan.progressPercent}%`} hint={`${plan.completedTasks} of ${plan.totalTasks} tasks`} icon="activity" />
        <StatCard label="Status" value={prettify(plan.status)} hint={`Created by ${plan.createdByName || "the college"}`} icon="clipboard" />
        <StatCard label="Updated" value={formatDate(plan.updatedAt)} hint="Most recent change" icon="calendar" />
      </div>

      <Panel title="Plan status" description="Update the lifecycle state of this plan.">
        <div className="button-row">
          <select className="inline-select" value={status} onChange={(event) => setStatus(event.target.value)}>
            {PLAN_STATUSES.map((value) => <option key={value} value={value}>{prettify(value)}</option>)}
          </select>
          <button type="button" className="primary-button" onClick={saveStatus} disabled={busy || status === plan.status}>{busy ? "Saving…" : "Save status"}</button>
        </div>
        {plan.summary && <p className="muted">{plan.summary}</p>}
      </Panel>

      <Panel title="Tasks" description="Mark progress as the student works through each action.">
        <DataTable
          empty="No tasks yet"
          rows={plan.tasks || []}
          getKey={(task) => task.id}
          columns={[
            { key: "task", label: "Task", render: (task) => <div><strong>{task.title}</strong><p className="muted">{task.skillName || task.description || "No skill linked"}</p></div> },
            { key: "priority", label: "Priority", render: (task) => <Badge tone={task.priority === "HIGH" ? "danger" : task.priority === "MEDIUM" ? "warning" : "muted"}>{prettify(task.priority)}</Badge> },
            { key: "target", label: "Target date", render: (task) => <span className={task.overdue ? "danger-link" : ""}>{task.targetDate ? formatDate(task.targetDate) : "No date"}</span> },
            { key: "owner", label: "Owner", render: (task) => task.ownerName || "Unassigned" },
            { key: "progress", label: "Score", render: (task) => task.baselineScore == null && task.targetScore == null ? "—" : `${task.baselineScore ?? "—"} → ${task.targetScore ?? "—"}` },
            { key: "status", label: "Status", render: (task) => <Badge tone={taskTone(task.status)}>{prettify(task.status)}</Badge> },
            {
              key: "actions",
              label: "",
              render: (task) => (
                <select className="inline-select" value={task.status} onChange={(event) => updateTaskStatus(task, event.target.value)}>
                  {TASK_STATUSES.map((value) => <option key={value} value={value}>{prettify(value)}</option>)}
                  {task.status === "OVERDUE" && <option value="OVERDUE">Overdue</option>}
                </select>
              ),
            },
          ]}
        />
      </Panel>

      {taskForm && (
        <Modal title="Add improvement task" description="Give the student one concrete action with a clear target." onClose={() => setTaskForm(null)}>
          <form className="stack-form" onSubmit={addTask}>
            <label className="form-field">Task title
              <input required maxLength={200} value={taskForm.title} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <label className="form-field">Description
              <textarea maxLength={1000} value={taskForm.description} onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))} />
            </label>
            <div className="form-grid">
              <label className="form-field">Priority
                <select value={taskForm.priority} onChange={(event) => setTaskForm((current) => ({ ...current, priority: event.target.value }))}>
                  {TASK_PRIORITIES.map((value) => <option key={value} value={value}>{prettify(value)}</option>)}
                </select>
              </label>
              <label className="form-field">Target date
                <input type="date" value={taskForm.targetDate} onChange={(event) => setTaskForm((current) => ({ ...current, targetDate: event.target.value }))} />
              </label>
            </div>
            <label className="form-field">Owner
              <input maxLength={120} value={taskForm.ownerName} onChange={(event) => setTaskForm((current) => ({ ...current, ownerName: event.target.value }))} />
            </label>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setTaskForm(null)}>Cancel</button>
              <button type="submit" className="primary-button" disabled={busy}>{busy ? "Saving…" : "Add task"}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
