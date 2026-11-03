import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../../lib/api.js";
import { useApi } from "../../lib/useApi.js";
import { Icon } from "../../components/Icon.jsx";
import { Badge, DataTable, Distribution, ErrorBlock, LoadingBlock, PageHeader, Panel, StatCard } from "../../components/ui.jsx";
import { ReadinessPanel, ReadinessSummary, SettingsPage, SkillGapTable, StudentDetailDrawer, StudentsTable, downloadCsv, scoreTone } from "./shared.jsx";

export function FacultyDashboardPage() {
  const { data, loading, error, reload } = useApi("/workspace/summary");
  const { data: gaps } = useApi("/workspace/skill-gaps");
  const { data: mentees } = useApi("/workspace/mentees");
  if (loading) return <LoadingBlock label="Loading mentor workspace…" />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  const stats = data?.stats || {};
  const menteeCount = (mentees || []).length || stats.students || 0;

  return (
    <div className="workspace-page-content">
      <PageHeader
        eyebrow="FACULTY / MENTOR"
        title="Your mentoring workspace"
        description={`Follow assigned students, review improvement focus areas, and guide progress in ${data?.department?.name || data?.college?.name || "your department"}.`}
        actions={<Link className="primary-button" to="/faculty/mentees">View mentees</Link>}
      />

      <div className="stat-grid stat-grid-4">
        <StatCard label="Mentees" value={menteeCount} hint="Students in your assigned scope" icon="users" />
        <StatCard label="Assessed" value={data?.readiness?.assessedStudentCount ?? 0} hint="Completed a baseline assessment" icon="clipboard" />
        <StatCard label="Average readiness" value={`${data?.readiness?.averageScore ?? 0}%`} hint="Latest attempt per student" tone={scoreTone(data?.readiness?.averageScore)} icon="target" />
        <StatCard label="Priority gaps" value={data?.readiness?.distribution?.PRIORITY_GAP ?? 0} hint="Students needing support" tone="danger" icon="alert" />
      </div>

      <div className="two-column">
        <Panel title="Readiness distribution" description="Your mentees by latest assessment score.">
          <Distribution distribution={data?.readiness?.distribution} />
        </Panel>
        <Panel title="Mentor actions" description="Where to focus next.">
          <div className="quick-actions">
            <Link to="/faculty/mentees"><Icon name="users" size={18} /> Review mentees</Link>
            <Link to="/faculty/improvement-plans"><Icon name="clipboard" size={18} /> Improvement plans</Link>
            <Link to="/faculty/reports"><Icon name="chart" size={18} /> Readiness report</Link>
          </div>
        </Panel>
      </div>

      <Panel title="Mentees needing attention" description="Start with students whose latest score is developing or below." actions={<Link className="link-button" to="/faculty/mentees">View all</Link>}>
        <StudentsTable students={(mentees || []).slice(0, 6)} empty="No mentees assigned yet" />
      </Panel>

      <Panel title="Focus areas" description="Department-wide skill gaps that can shape mentoring conversations.">
        <SkillGapTable gaps={(gaps || []).slice(0, 5)} />
      </Panel>
    </div>
  );
}

export function FacultyMenteesPage() {
  const { data, loading, error, reload } = useApi("/workspace/mentees");
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
      <PageHeader eyebrow="MENTEES" title="Assigned students" description="Students you can support with guidance and improvement plans." />
      <Panel title={loading ? "Mentees" : `${filtered.length} mentees`} actions={<input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search mentees" />}>
        {loading ? <LoadingBlock /> : error ? <ErrorBlock message={error} onRetry={reload} /> : <StudentsTable students={filtered} onView={openStudent} empty="No mentees assigned yet" />}
      </Panel>
      <StudentDetailDrawer student={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

export function FacultyImprovementPlansPage() {
  const { data, loading, error, reload } = useApi("/workspace/mentees");
  const { data: gaps } = useApi("/workspace/skill-gaps");
  const [detail, setDetail] = useState(null);

  async function openStudent(student) {
    try {
      setDetail(await api.get(`/workspace/students/${student.id}`));
    } catch (reason) {
      toast.error(reason.message || "Unable to load the student profile.");
    }
  }

  return (
    <div className="workspace-page-content">
      <PageHeader eyebrow="IMPROVEMENT PLANS" title="Mentor-guided improvement plans" description="Draft focus areas for mentees based on their career targets and shared skill gaps." />
      {loading ? <LoadingBlock /> : error ? <ErrorBlock message={error} onRetry={reload} /> : (
        <>
          <Panel title="Mentee plan board" description="Open a mentee to review their profile and career target before a plan session.">
            <DataTable
              empty="No mentees assigned yet"
              rows={data || []}
              getKey={(student) => student.id}
              columns={[
                { key: "name", label: "Mentee", render: (student) => <strong>{student.fullName}</strong> },
                { key: "career", label: "Target career", render: (student) => student.targetCareerName || "Not selected" },
                { key: "branch", label: "Branch", render: (student) => student.branch || "—" },
                { key: "year", label: "Graduation", render: (student) => student.graduationYear || "—" },
                { key: "status", label: "Plan status", render: (student) => <Badge tone={student.targetCareerName ? "info" : "warning"}>{student.targetCareerName ? "Ready to plan" : "Baseline needed"}</Badge> },
                { key: "action", label: "", render: (student) => <button type="button" className="link-button" onClick={() => openStudent(student)}>Open</button> },
              ]}
            />
          </Panel>
          <Panel title="Suggested focus areas" description="Shared gaps across your mentee pool.">
            <SkillGapTable gaps={gaps} empty="No shared skill gaps recorded yet" />
          </Panel>
        </>
      )}
      <StudentDetailDrawer student={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

export function FacultyReportsPage() {
  const { data: readiness, loading, error, reload } = useApi("/workspace/readiness");
  const { data: mentees } = useApi("/workspace/mentees");
  const { data: gaps } = useApi("/workspace/skill-gaps");
  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  return (
    <div className="workspace-page-content">
      <PageHeader
        eyebrow="REPORTS"
        title="Mentee readiness report"
        description="Understand readiness and gaps across your assigned students."
        actions={<button type="button" className="secondary-button" onClick={() => downloadCsv("mentees.csv", [
          { label: "Mentee", value: (student) => student.fullName },
          { label: "Student ID", value: (student) => student.studentId },
          { label: "Branch", value: (student) => student.branch },
          { label: "Target career", value: (student) => student.targetCareerName },
        ], mentees || [])}>Export mentees</button>}
      />
      <ReadinessSummary readiness={readiness} />
      <div className="two-column">
        <ReadinessPanel readiness={readiness} />
        <Panel title="Mentoring notes" description="Turn the report into a plan.">
          <ul className="report-notes">
            <li>Start with mentees in the priority gap band.</li>
            <li>Use shared skill gaps as the first improvement plan theme.</li>
            <li>Confirm each mentee has a target career before planning.</li>
            <li>Export the mentee list for department coordinator reviews.</li>
          </ul>
        </Panel>
      </div>
      <Panel title="Skill gaps" description="Gaps across your mentee pool.">
        <SkillGapTable gaps={gaps} />
      </Panel>
    </div>
  );
}

export function FacultySettingsPage() {
  return <SettingsPage label="Faculty / Mentor" />;
}
