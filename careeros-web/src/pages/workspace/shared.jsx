import { useState } from "react";
import { toast } from "sonner";
import { api } from "../../lib/api.js";
import { useApi } from "../../lib/useApi.js";
import { Avatar, Badge, DataTable, Distribution, EmptyState, ErrorBlock, LoadingBlock, PageHeader, Panel, StatCard } from "../../components/ui.jsx";
import { Icon } from "../../components/Icon.jsx";

export function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function scoreTone(score) {
  if (score >= 80) return "positive";
  if (score >= 65) return "info";
  if (score >= 50) return "warning";
  return "danger";
}

export function levelTone(level) {
  if (level === "STRONG") return "positive";
  if (level === "GOOD") return "info";
  if (level === "DEVELOPING") return "warning";
  return "danger";
}

export function StudentsTable({ students, onView, empty = "No students yet" }) {
  return (
    <DataTable
      empty={empty}
      rows={students}
      getKey={(student) => student.id}
      columns={[
        {
          key: "name",
          label: "Student",
          render: (student) => (
            <div className="table-person">
              <Avatar name={student.fullName} size={34} />
              <div>
                <strong>{student.fullName}</strong>
                <span>{student.studentId}</span>
              </div>
            </div>
          ),
        },
        { key: "branch", label: "Branch", render: (student) => student.branch || "—" },
        { key: "year", label: "Graduation", render: (student) => student.graduationYear || "—" },
        { key: "career", label: "Target career", render: (student) => student.targetCareerName || "Not selected" },
        {
          key: "action",
          label: "",
          render: (student) => onView ? (
            <button type="button" className="link-button" onClick={() => onView(student)}>View</button>
          ) : null,
        },
      ]}
    />
  );
}

export function SkillGapTable({ gaps, empty = "No skill gaps recorded yet" }) {
  return (
    <DataTable
      empty={empty}
      rows={gaps}
      getKey={(gap) => gap.skillId}
      columns={[
        {
          key: "skill",
          label: "Skill",
          render: (gap) => (
            <div className="table-person">
              <span className={`skill-dot ${levelTone(gap.level)}`} />
              <div>
                <strong>{gap.skillName}</strong>
                <span>{gap.skillCategory}</span>
              </div>
            </div>
          ),
        },
        { key: "average", label: "Average score", render: (gap) => `${gap.averageScore}%` },
        { key: "target", label: "Target", render: (gap) => `${gap.targetPercent}%` },
        {
          key: "gap",
          label: "Gap",
          render: (gap) => <Badge tone={gap.gapPercent > 20 ? "danger" : gap.gapPercent > 10 ? "warning" : "positive"}>{gap.gapPercent} pts</Badge>,
        },
        { key: "level", label: "Level", render: (gap) => <Badge tone={levelTone(gap.level)}>{gap.level.replaceAll("_", " ")}</Badge> },
      ]}
    />
  );
}

export function ReadinessSummary({ readiness, showStudents = true }) {
  if (!readiness) return null;
  return (
    <div className="readiness-summary-grid">
      {showStudents && <StatCard label="Students tracked" value={readiness.studentCount ?? 0} hint="In your workspace scope" icon="users" />}
      <StatCard label="Assessed" value={readiness.assessedStudentCount ?? 0} hint="Students with a submitted assessment" icon="clipboard" />
      <StatCard label="Average readiness" value={`${readiness.averageScore ?? 0}%`} hint="Latest submitted attempt per student" tone={scoreTone(readiness.averageScore)} icon="target" />
      <StatCard label="Priority gaps" value={readiness.distribution?.PRIORITY_GAP ?? 0} hint="Students needing focused support" tone="danger" icon="alert" />
    </div>
  );
}

export function ReadinessPanel({ readiness, title = "Readiness distribution" }) {
  if (!readiness) return null;
  return (
    <Panel title={title} description="Based on each student’s latest submitted assessment.">
      <Distribution distribution={readiness.distribution} />
    </Panel>
  );
}

export function ComingSoonPanel({ title, description }) {
  return (
    <Panel title={title}>
      <div className="coming-soon">
        <span className="empty-icon"><Icon name="briefcase" size={20} /></span>
        <strong>Planned for a later phase</strong>
        <p>{description}</p>
      </div>
    </Panel>
  );
}

export function downloadCsv(filename, columns, rows) {
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const lines = [columns.map((column) => escape(column.label)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((column) => escape(column.value(row))).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function SettingsPanel({ roleLabel: label }) {
  const { data, loading, error, reload } = useApi("/settings/me");
  const [form, setForm] = useState({ currentPassword: "", newPassword: "" });
  const [busy, setBusy] = useState(false);

  async function changePassword(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.put("/users/me/password", form);
      toast.success("Password updated. Other sessions were revoked.");
      setForm({ currentPassword: "", newPassword: "" });
    } catch (reason) {
      toast.error(reason.message || "Unable to change password.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;

  return (
    <div className="settings-grid">
      <Panel title="Account" description="Your CareerOS identity and session details.">
        <div className="settings-identity">
          <Avatar name={data?.account?.fullName} size={52} />
          <div>
            <strong>{data?.account?.fullName}</strong>
            <span>{data?.account?.email}</span>
            <Badge tone="info">{label}</Badge>
          </div>
        </div>
        <dl className="settings-list">
          <div><dt>Active sessions</dt><dd>{data?.activeSessions ?? 0}</dd></div>
          <div><dt>Member since</dt><dd>{formatDate(data?.account?.createdAt)}</dd></div>
          <div><dt>Workspace</dt><dd>{data?.profile?.college || "Platform workspace"}</dd></div>
        </dl>
      </Panel>

      <Panel title="Change password" description="Use at least 8 characters with letters and digits.">
        <form className="stack-form" onSubmit={changePassword}>
          <label>Current password
            <input type="password" required value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} />
          </label>
          <label>New password
            <input type="password" required minLength={8} value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} />
          </label>
          <button className="primary-button" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
        </form>
      </Panel>
    </div>
  );
}

export function SettingsPage({ label }) {
  return (
    <div className="workspace-page-content">
      <PageHeader eyebrow="SETTINGS" title="Account settings" description="Manage your CareerOS sign-in and session security." />
      <SettingsPanel roleLabel={label} />
    </div>
  );
}

export function StudentDetailDrawer({ student, onClose }) {
  if (!student) return null;
  return (
    <div className="dialog-backdrop" onClick={onClose} role="presentation">
      <div className="detail-drawer" onClick={(event) => event.stopPropagation()}>
        <header>
          <div className="table-person">
            <Avatar name={student.fullName} size={44} />
            <div>
              <strong>{student.fullName}</strong>
              <span>{student.studentId}</span>
            </div>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">×</button>
        </header>
        <dl className="settings-list">
          <div><dt>Branch</dt><dd>{student.branch || "—"}</dd></div>
          <div><dt>Degree</dt><dd>{student.degree || "—"}</dd></div>
          <div><dt>Graduation</dt><dd>{student.graduationYear || "—"}</dd></div>
          <div><dt>Semester</dt><dd>{student.semester || "—"}</dd></div>
          <div><dt>Target career</dt><dd>{student.targetCareerName || "Not selected"}</dd></div>
          <div><dt>College</dt><dd>{student.collegeName || student.college || "—"}</dd></div>
        </dl>
        {student.attempts?.length ? (
          <div className="detail-attempts">
            <h3>Recent assessments</h3>
            {student.attempts.map((attempt) => (
              <div key={attempt.id} className="detail-attempt">
                <span>Assessment #{attempt.assessmentId}</span>
                <strong>{attempt.overallScore ?? "—"}%</strong>
                <small>{formatDate(attempt.submittedAt)}</small>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No submitted assessments" description="This student has not completed an assessment yet." icon="clipboard" />
        )}
      </div>
    </div>
  );
}
