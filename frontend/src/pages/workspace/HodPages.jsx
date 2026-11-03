import { useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "../../lib/api.js";
import { useApi } from "../../lib/useApi.js";
import { ROLE_LABELS } from "../../lib/roles.js";
import { Icon } from "../../components/Icon.jsx";
import { Badge, DataTable, Distribution, ErrorBlock, LoadingBlock, PageHeader, Panel, StatCard, statusTone } from "../../components/ui.jsx";
import { ReadinessPanel, ReadinessSummary, SettingsPage, SkillGapTable, StudentDetailDrawer, StudentsTable, downloadCsv, scoreTone } from "./shared.jsx";

export function HodDashboardPage() {
  const { data, loading, error, reload } = useApi("/workspace/summary");
  const { data: gaps } = useApi("/workspace/skill-gaps");
  if (loading) return <LoadingBlock label="Loading department overview…" />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  const stats = data?.stats || {};
  const department = data?.department;
  const faculty = (data?.staff || []).filter((member) => member.role === "FACULTY");

  return (
    <div className="workspace-page-content">
      <PageHeader
        eyebrow="DEPARTMENT COORDINATOR"
        title={department?.name || "Department overview"}
        description={`Students, readiness, and faculty signals for ${department?.name || "your department"} in ${data?.college?.name || "your college"}.`}
        actions={<Badge tone="info">{data?.college?.code || "College"}</Badge>}
      />

      <div className="stat-grid stat-grid-4">
        <StatCard label="Department students" value={stats.students ?? 0} hint="In your assigned scope" icon="users" />
        <StatCard label="Assessed" value={data?.readiness?.assessedStudentCount ?? 0} hint="With a submitted assessment" icon="clipboard" />
        <StatCard label="Average readiness" value={`${data?.readiness?.averageScore ?? 0}%`} hint="Latest attempt per student" tone={scoreTone(data?.readiness?.averageScore)} icon="target" />
        <StatCard label="Faculty" value={faculty.length} hint="Mentors in the department" icon="book" />
      </div>

      <div className="two-column">
        <Panel title="Readiness distribution" description="Students in your department by latest score.">
          <Distribution distribution={data?.readiness?.distribution} />
        </Panel>
        <Panel title="Department summary" description="Coordinator focus areas.">
          <dl className="settings-list">
            <div><dt>Department</dt><dd>{department?.name || "—"}</dd></div>
            <div><dt>Code</dt><dd>{department?.code || "—"}</dd></div>
            <div><dt>HOD</dt><dd>{department?.hodName || "—"}</dd></div>
            <div><dt>Priority gaps</dt><dd><Badge tone="danger">{data?.readiness?.distribution?.PRIORITY_GAP ?? 0}</Badge></dd></div>
            <div><dt>Strong performers</dt><dd><Badge tone="positive">{data?.readiness?.distribution?.STRONG ?? 0}</Badge></dd></div>
          </dl>
        </Panel>
      </div>

      <Panel title="Top skill gaps" description="Department-wide gaps to discuss with faculty.">
        <SkillGapTable gaps={(gaps || []).slice(0, 5)} />
      </Panel>
    </div>
  );
}

export function HodStudentsPage() {
  const { data, loading, error, reload } = useApi("/workspace/students");
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState(null);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (data || []).filter((student) => !term || `${student.fullName} ${student.studentId} ${student.branch || ""}`.toLowerCase().includes(term));
  }, [data, query]);

  async function openStudent(student) {
    try {
      setDetail(await api.get(`/workspace/students/${student.id}`));
    } catch (reason) {
      toast.error(reason.message || "Unable to load the student profile.");
    }
  }

  return (
    <div className="workspace-page-content">
      <PageHeader eyebrow="DEPARTMENT STUDENTS" title="Students in your department" description="View profiles and career targets for students assigned to your department." />
      <Panel title={loading ? "Students" : `${filtered.length} students`} actions={<input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search students" />}>
        {loading ? <LoadingBlock /> : error ? <ErrorBlock message={error} onRetry={reload} /> : <StudentsTable students={filtered} onView={openStudent} />}
      </Panel>
      <StudentDetailDrawer student={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

export function HodReadinessPage() {
  const { data, loading, error, reload } = useApi("/workspace/readiness");
  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  return (
    <div className="workspace-page-content">
      <PageHeader eyebrow="READINESS" title="Department readiness" description="Monitor how students in your department are progressing toward career targets." />
      <ReadinessSummary readiness={data} />
      <div className="two-column">
        <ReadinessPanel readiness={data} />
        <Panel title="Coordinator notes" description="Use readiness to guide faculty conversations.">
          <ul className="report-notes">
            <li>Review students in the priority gap band first.</li>
            <li>Pair unassessed students with a mentor to complete a baseline assessment.</li>
            <li>Share top skill gaps with faculty to shape classroom interventions.</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}

export function HodDepartmentPage() {
  const { data, loading, error, reload } = useApi("/workspace/department");
  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  const department = data?.department;

  return (
    <div className="workspace-page-content">
      <PageHeader eyebrow="DEPARTMENT" title={department?.name || "Department workspace"} description="Structure, batches, and faculty for your department." actions={<Badge tone="info">{department?.code || "—"}</Badge>} />
      <div className="stat-grid stat-grid-4">
        <StatCard label="Students" value={data?.studentCount ?? 0} icon="users" />
        <StatCard label="Batches" value={data?.batches?.length ?? 0} icon="calendar" />
        <StatCard label="Faculty & staff" value={data?.staff?.length ?? 0} icon="book" />
        <StatCard label="HOD" value={department?.hodName || "—"} icon="shield" />
      </div>

      <div className="two-column">
        <Panel title="Batches" description="Cohorts in this department.">
          <DataTable
            empty="No batches configured yet"
            rows={data?.batches || []}
            getKey={(batch) => batch.id}
            columns={[
              { key: "name", label: "Batch", render: (batch) => <strong>{batch.name}</strong> },
              { key: "year", label: "Start year", render: (batch) => batch.year },
            ]}
          />
        </Panel>
        <Panel title="Department staff" description="Faculty and coordinators assigned to this department.">
          {data?.staff?.length ? (
            <div className="stack-list">
              {data.staff.map((member) => (
                <div className="stack-row" key={member.id}>
                  <span className="stack-avatar"><Icon name="book" size={18} /></span>
                  <div>
                    <strong>{member.fullName}</strong>
                    <span>{ROLE_LABELS[member.role] || member.role}</span>
                  </div>
                  <Badge tone={statusTone(member.status)}>{member.status}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No staff assigned to this department yet.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

export function HodReportsPage() {
  const { data: readiness, loading, error, reload } = useApi("/workspace/readiness");
  const { data: gaps } = useApi("/workspace/skill-gaps");
  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  return (
    <div className="workspace-page-content">
      <PageHeader
        eyebrow="REPORTS"
        title="Department readiness report"
        description="Share department progress and skill gaps with faculty and college leadership."
        actions={<button type="button" className="secondary-button" onClick={() => downloadCsv("department-skill-gaps.csv", [
          { label: "Skill", value: (gap) => gap.skillName },
          { label: "Average", value: (gap) => gap.averageScore },
          { label: "Target", value: (gap) => gap.targetPercent },
          { label: "Gap", value: (gap) => gap.gapPercent },
        ], gaps || [])}>Export CSV</button>}
      />
      <ReadinessSummary readiness={readiness} />
      <div className="two-column">
        <ReadinessPanel readiness={readiness} />
        <Panel title="Report summary" description="Department-level signals.">
          <dl className="settings-list">
            <div><dt>Students tracked</dt><dd>{readiness?.studentCount ?? 0}</dd></div>
            <div><dt>Assessed</dt><dd>{readiness?.assessedStudentCount ?? 0}</dd></div>
            <div><dt>Average readiness</dt><dd>{readiness?.averageScore ?? 0}%</dd></div>
            <div><dt>Developing or below</dt><dd><Badge tone="warning">{(readiness?.distribution?.DEVELOPING ?? 0) + (readiness?.distribution?.NEEDS_IMPROVEMENT ?? 0) + (readiness?.distribution?.PRIORITY_GAP ?? 0)}</Badge></dd></div>
          </dl>
        </Panel>
      </div>
      <Panel title="Skill gaps" description="Gaps to address through department interventions.">
        <SkillGapTable gaps={gaps} />
      </Panel>
    </div>
  );
}

export function HodSettingsPage() {
  return <SettingsPage label="HOD / Department Coordinator" />;
}
