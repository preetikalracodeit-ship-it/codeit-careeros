import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../../lib/api.js";
import { useApi } from "../../lib/useApi.js";
import { Icon } from "../../components/Icon.jsx";
import { Badge, Distribution, ErrorBlock, LoadingBlock, PageHeader, Panel, StatCard } from "../../components/ui.jsx";
import { ComingSoonPanel, ReadinessPanel, ReadinessSummary, SettingsPage, SkillGapTable, StudentDetailDrawer, StudentsTable, downloadCsv, scoreTone } from "./shared.jsx";

export function TpoDashboardPage() {
  const { data, loading, error, reload } = useApi("/workspace/summary");
  const { data: gaps } = useApi("/workspace/skill-gaps");
  if (loading) return <LoadingBlock label="Loading placement overview…" />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  const stats = data?.stats || {};
  const readiness = data?.readiness;

  return (
    <div className="workspace-page-content">
      <PageHeader
        eyebrow="PLACEMENT OFFICER"
        title="Placement readiness overview"
        description={`Track student readiness, surface skill gaps, and prepare placement reports for ${data?.college?.name || "your college"}.`}
        actions={<Link className="primary-button" to="/tpo/reports">Generate report</Link>}
      />

      <div className="stat-grid stat-grid-4">
        <StatCard label="Students" value={stats.students ?? 0} hint="In your placement pool" icon="users" />
        <StatCard label="Assessed" value={readiness?.assessedStudentCount ?? 0} hint="With a submitted assessment" icon="clipboard" />
        <StatCard label="Average readiness" value={`${readiness?.averageScore ?? 0}%`} hint="Latest attempt per student" tone={scoreTone(readiness?.averageScore)} icon="target" />
        <StatCard label="Priority gaps" value={readiness?.distribution?.PRIORITY_GAP ?? 0} hint="Students needing focused support" tone="danger" icon="alert" />
      </div>

      <div className="two-column">
        <Panel title="Readiness distribution" description="Students grouped by latest assessment score.">
          <Distribution distribution={readiness?.distribution} />
        </Panel>
        <Panel title="Placement actions" description="Move from insight to intervention.">
          <div className="quick-actions">
            <Link to="/tpo/students"><Icon name="users" size={18} /> Browse students</Link>
            <Link to="/tpo/readiness"><Icon name="target" size={18} /> Review readiness</Link>
            <Link to="/tpo/skill-gaps"><Icon name="chart" size={18} /> Inspect skill gaps</Link>
            <Link to="/tpo/reports"><Icon name="clipboard" size={18} /> Export reports</Link>
            <Link to="/tpo/placement"><Icon name="briefcase" size={18} /> Placement drives</Link>
          </div>
        </Panel>
      </div>

      <Panel title="Top skill gaps" description="Skills with the largest distance to target across assessed students." actions={<Link className="link-button" to="/tpo/skill-gaps">View all</Link>}>
        <SkillGapTable gaps={(gaps || []).slice(0, 5)} />
      </Panel>
    </div>
  );
}

export function TpoStudentsPage() {
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
      <PageHeader eyebrow="PLACEMENT POOL" title="Students and career targets" description="Review the students available to your placement programme." />
      <Panel title={loading ? "Students" : `${filtered.length} students`} actions={<input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search students" />}>
        {loading ? <LoadingBlock /> : error ? <ErrorBlock message={error} onRetry={reload} /> : <StudentsTable students={filtered} onView={openStudent} />}
      </Panel>
      <StudentDetailDrawer student={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

export function TpoReadinessPage() {
  const { data, loading, error, reload } = useApi("/workspace/readiness");
  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  return (
    <div className="workspace-page-content">
      <PageHeader eyebrow="READINESS" title="Student readiness" description="A placement-ready view of how students are progressing against their target careers." />
      <ReadinessSummary readiness={data} />
      <div className="two-column">
        <ReadinessPanel readiness={data} />
        <Panel title="How readiness is calculated" description="Weighted from the target career’s skill framework.">
          <ul className="report-notes">
            <li>Each skill score comes from a student’s latest submitted assessment.</li>
            <li>Scores are capped at the target percentage so strengths do not mask gaps.</li>
            <li>Skills are weighted by importance for the selected career.</li>
            <li>Students without a selected career or submitted attempt appear as unassessed.</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}

export function TpoSkillGapsPage() {
  const { data, loading, error, reload } = useApi("/workspace/skill-gaps");
  return (
    <div className="workspace-page-content">
      <PageHeader
        eyebrow="SKILL GAPS"
        title="Skill gap analysis"
        description="Ranked gaps between current student performance and career targets."
        actions={<button type="button" className="secondary-button" onClick={() => downloadCsv("skill-gaps.csv", [
          { label: "Skill", value: (gap) => gap.skillName },
          { label: "Category", value: (gap) => gap.skillCategory },
          { label: "Average", value: (gap) => gap.averageScore },
          { label: "Target", value: (gap) => gap.targetPercent },
          { label: "Gap", value: (gap) => gap.gapPercent },
        ], data || [])}>Export CSV</button>}
      />
      <Panel title="All skill gaps">
        {loading ? <LoadingBlock /> : error ? <ErrorBlock message={error} onRetry={reload} /> : <SkillGapTable gaps={data} />}
      </Panel>
    </div>
  );
}

export function TpoReportsPage() {
  const { data: readiness, loading, error, reload } = useApi("/workspace/readiness");
  const { data: students } = useApi("/workspace/students");
  const { data: gaps } = useApi("/workspace/skill-gaps");

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;

  return (
    <div className="workspace-page-content">
      <PageHeader
        eyebrow="REPORTS"
        title="Placement readiness report"
        description="Share a concise view of readiness, gaps, and student career targets."
        actions={(
          <div className="button-row">
            <button type="button" className="secondary-button" onClick={() => downloadCsv("students.csv", [
              { label: "Student", value: (student) => student.fullName },
              { label: "Student ID", value: (student) => student.studentId },
              { label: "Branch", value: (student) => student.branch },
              { label: "Graduation", value: (student) => student.graduationYear },
              { label: "Target career", value: (student) => student.targetCareerName },
            ], students || [])}>Export students</button>
            <button type="button" className="primary-button" onClick={() => downloadCsv("skill-gaps.csv", [
              { label: "Skill", value: (gap) => gap.skillName },
              { label: "Average", value: (gap) => gap.averageScore },
              { label: "Target", value: (gap) => gap.targetPercent },
              { label: "Gap", value: (gap) => gap.gapPercent },
            ], gaps || [])}>Export gaps</button>
          </div>
        )}
      />
      <ReadinessSummary readiness={readiness} />
      <div className="two-column">
        <ReadinessPanel readiness={readiness} />
        <Panel title="Placement summary" description="Signals to share with college leadership.">
          <dl className="settings-list">
            <div><dt>Students in pool</dt><dd>{readiness?.studentCount ?? 0}</dd></div>
            <div><dt>Assessed</dt><dd>{readiness?.assessedStudentCount ?? 0}</dd></div>
            <div><dt>Average readiness</dt><dd>{readiness?.averageScore ?? 0}%</dd></div>
            <div><dt>Priority gaps</dt><dd><Badge tone="danger">{readiness?.distribution?.PRIORITY_GAP ?? 0}</Badge></dd></div>
            <div><dt>Strong performers</dt><dd><Badge tone="positive">{readiness?.distribution?.STRONG ?? 0}</Badge></dd></div>
          </dl>
        </Panel>
      </div>
      <Panel title="Skill gaps" description="Largest gaps to prioritise in placement preparation.">
        <SkillGapTable gaps={gaps} />
      </Panel>
    </div>
  );
}

export function TpoPlacementPage() {
  return (
    <div className="workspace-page-content">
      <PageHeader eyebrow="PLACEMENT ACTIVITY" title="Placement drives" description="Manage drives, applications, and placement outcomes from one workspace." />
      <ComingSoonPanel
        title="Placement drive management"
        description="Drive scheduling, student applications, shortlists, and offer tracking are planned for a later phase. Readiness insights and exports are available now."
      />
    </div>
  );
}

export function TpoSettingsPage() {
  return <SettingsPage label="TPO / Placement Officer" />;
}
