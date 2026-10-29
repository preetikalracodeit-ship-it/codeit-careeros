import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../lib/api.js";
import { Badge, ErrorBlock, LoadingBlock, PageHeader, Panel, ProgressBar } from "../components/ui.jsx";
import { Icon } from "../components/Icon.jsx";

const ENDPOINTS = {
  readiness: "/reports/readiness",
  assessment: "/reports/assessment",
  "gap-analysis": "/reports/gap-analysis",
  roadmap: "/reports/roadmap",
  overall: "/reports/overall",
};

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function pretty(value) {
  if (!value) return "Not set";
  return String(value).toLowerCase().split("_").map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join(" ");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function summary(report) {
  if (!report) return "No data";
  if (report.readinessPercent != null) return `${report.readinessPercent}% ready - ${report.metSkills ?? 0}/${report.totalSkills ?? 0} skills on target`;
  if (report.attempts) return `${report.attempts.length} submission(s)`;
  if (report.progressPercent != null) return `${report.completedItems ?? 0}/${report.totalItems ?? 0} steps - ${report.progressPercent}%`;
  if (report.readiness) return report.readiness.hasTarget ? `${report.readiness.readinessPercent}% ready` : "No target career yet";
  return "Available";
}

function SkillTable({ gaps = [] }) {
  if (gaps.length === 0) return <p className="muted">No skills to show.</p>;
  return <div className="table-wrap"><table className="data-table">
    <thead><tr><th>Skill</th><th>Score</th><th>Target</th><th>Status</th></tr></thead>
    <tbody>{gaps.map((gap) => <tr key={gap.skillId ?? gap.skillName}>
      <td><strong>{gap.skillName}</strong><span className="table-sub">{pretty(gap.skillCategory)}</span></td>
      <td>{gap.assessed ? `${gap.scorePercent ?? 0}%` : "-"}</td>
      <td>{gap.targetPercent ?? 0}%</td>
      <td><Badge tone={gap.metTarget ? "positive" : gap.assessed ? "warning" : "muted"}>{!gap.assessed ? "Not assessed" : gap.metTarget ? "On target" : `${Math.abs(gap.gapPercent ?? 0)} pt gap`}</Badge></td>
    </tr>)}</tbody>
  </table></div>;
}

function ReadinessView({ data, gapMode }) {
  if (!data) return null;
  const gaps = gapMode ? [...(data.gaps || [])].sort((a, b) => (a.gapPercent ?? 0) - (b.gapPercent ?? 0)) : data.gaps || [];
  return <div className="report-detail">
    <div className="report-detail-top"><strong>{data.targetCareerName || "Target career"}</strong><Badge tone="info">{pretty(data.readinessLevel)}</Badge></div>
    <div className="report-score"><strong>{data.readinessPercent ?? 0}%</strong><ProgressBar value={data.readinessPercent} /></div>
    <div className="report-stat-grid">
      <div><span>On target</span><b>{data.metSkills ?? 0}/{data.totalSkills ?? 0}</b></div>
      <div><span>Assessed</span><b>{data.assessedSkills ?? 0}/{data.totalSkills ?? 0}</b></div>
      <div><span>Submissions</span><b>{data.submittedAttempts ?? 0}</b></div>
      <div><span>Strengths</span><b>{(data.strengths || []).length}</b></div>
    </div>
    {!gapMode && <>
      <h3>Strengths</h3>
      {(data.strengths || []).length === 0 ? <p className="muted">No met skills yet.</p> : <ul className="report-list">{data.strengths.map((gap) => <li key={gap.skillId}>{gap.skillName}: {gap.scorePercent ?? 0}% (target {gap.targetPercent ?? 0}%)</li>)}</ul>}
      <h3>Areas to improve</h3>
      {(data.improvements || []).length === 0 ? <p className="muted">Everything assessed is on target.</p> : <ul className="report-list">{data.improvements.map((gap) => <li key={gap.skillId}>{gap.skillName}: {gap.assessed ? `${gap.scorePercent ?? 0}% vs ${gap.targetPercent ?? 0}%` : `not assessed, required ${gap.targetPercent ?? 0}%`}</li>)}</ul>}
    </>}
    <h3>{gapMode ? "Required skills - current vs target" : "All skills"}</h3>
    <SkillTable gaps={gaps} />
  </div>;
}

function AssessmentView({ data }) {
  if (!data) return null;
  const skills = (data.latestSkillScores || []).map((score) => ({ ...score, assessed: true, metTarget: (score.scorePercent ?? 0) >= (score.targetPercent ?? 0), gapPercent: (score.scorePercent ?? 0) - (score.targetPercent ?? 0) }));
  return <div className="report-detail">
    <h3>Submissions ({(data.attempts || []).length})</h3>
    {(data.attempts || []).length === 0 ? <p className="muted">No submissions yet.</p> : <ul className="report-attempts">{data.attempts.map((attempt) => <li key={attempt.attemptId}>
      <div><strong>{attempt.assessmentTitle || "Assessment"}</strong><span>{attempt.careerName || ""} - {attempt.answeredCount ?? 0}/{attempt.totalQuestions ?? 0} answered - {formatDate(attempt.submittedAt)}</span></div>
      <Badge tone="info">Score {attempt.overallScore ?? "-"}</Badge>
    </li>)}</ul>}
    <h3>Skill-wise scores (latest attempt)</h3>
    <SkillTable gaps={skills} />
  </div>;
}

function RoadmapView({ data }) {
  if (!data) return null;
  return <div className="report-detail">
    <div className="report-detail-top"><strong>{data.careerName || "Roadmap"}</strong><Badge tone="info">{data.progressPercent ?? 0}% done</Badge></div>
    <ProgressBar value={data.progressPercent || 0} />
    <div className="report-stat-grid"><div><span>Completed</span><b>{data.completedItems ?? 0}/{data.totalItems ?? 0}</b></div><div><span>In progress</span><b>{data.inProgressItems ?? 0}</b></div><div><span>Phases</span><b>{(data.phases || []).length}</b></div></div>
    {(data.phases || []).map((phase) => <div className="report-phase" key={phase.phaseId ?? phase.title}><strong>{phase.title} <small>{phase.completedItems ?? 0}/{phase.totalItems ?? 0}</small></strong><ul>{(phase.items || []).map((item) => <li key={item.itemId ?? item.title}><span>{item.title}</span><Badge tone={item.status === "COMPLETED" ? "positive" : item.status === "IN_PROGRESS" ? "warning" : "muted"}>{pretty(item.status)}</Badge></li>)}</ul></div>)}
  </div>;
}

function OverallView({ data }) {
  if (!data) return null;
  return <div className="report-detail">
    <strong>{data.student?.fullName || "Progress snapshot"}</strong>
    <p className="muted">{data.student?.studentId || ""}{data.student?.targetCareerName ? ` - ${data.student.targetCareerName}` : ""}</p>
    <div className="report-stat-grid">
      <div><span>Readiness</span><b>{data.readiness?.hasTarget ? `${data.readiness.readinessPercent ?? 0}%` : "-"}</b></div>
      <div><span>Roadmap</span><b>{data.roadmap?.hasTarget ? `${data.roadmap.completedItems ?? 0}/${data.roadmap.totalItems ?? 0}` : "-"}</b></div>
      <div><span>Projects</span><b>{data.projects?.completedProjects ?? 0}/{data.projects?.totalProjects ?? 0}</b></div>
      <div><span>CV score</span><b>{data.cv?.hasCv ? `${data.cv.overallScore ?? 0}%` : "No CV"}</b></div>
    </div>
    <h3>Career readiness</h3>
    <p>{data.readiness?.hasTarget ? `${data.readiness.readinessPercent ?? 0}% (${pretty(data.readiness.readinessLevel)}) - ${data.readiness.metSkills ?? 0} of ${data.readiness.totalSkills ?? 0} skills on target` : "No target career selected yet."}</p>
    {(data.readiness?.improvements || []).length > 0 && <ul className="report-list">{data.readiness.improvements.slice(0, 3).map((gap) => <li key={gap.skillId}>Improve {gap.skillName} ({gap.assessed ? `${gap.scorePercent}% vs ${gap.targetPercent}%` : `required ${gap.targetPercent}%`})</li>)}</ul>}
    <h3>LinkedIn</h3>
    <p>{data.linkedIn?.hasProfile ? `Completeness ${data.linkedIn.completenessPercent ?? 0}%, alignment ${data.linkedIn.alignmentPercent ?? 0}%` : "No LinkedIn profile connected yet."}</p>
    <h3>Recommended next steps</h3>
    {(data.recommendedNextSteps || []).length === 0 ? <p className="muted">You are on track.</p> : <ul className="report-list">{data.recommendedNextSteps.map((step) => <li key={step}>{step}</li>)}</ul>}
    <p className="muted">Generated {formatDate(data.generatedAt)}</p>
  </div>;
}

function Detail({ type, data }) {
  if (type === "readiness") return <ReadinessView data={data} />;
  if (type === "gap-analysis") return <ReadinessView data={data} gapMode />;
  if (type === "assessment") return <AssessmentView data={data} />;
  if (type === "roadmap") return <RoadmapView data={data} />;
  if (type === "overall") return <OverallView data={data} />;
  return null;
}

export function StudentReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState(null);
  const [viewData, setViewData] = useState({});
  const [downloading, setDownloading] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.get("/reports");
      setReports(Array.isArray(result) ? result : []);
    } catch (reason) {
      setError(reason.message || "Unable to load reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggle(type) {
    if (viewing === type) {
      setViewing(null);
      return;
    }
    setViewing(type);
    if (viewData[type]) return;
    try {
      const data = await api.get(ENDPOINTS[type]);
      setViewData((current) => ({ ...current, [type]: data }));
    } catch (reason) {
      toast.error(reason.message || "Unable to load this report.");
      setViewing(null);
    }
  }

  async function download(type) {
    setDownloading(type);
    try {
      const blob = await api.get(`/reports/${type}/download`, { responseType: "blob" });
      downloadBlob(blob, `careeros-${type}-report.pdf`);
      toast.success("Report downloaded.");
    } catch (reason) {
      toast.error(reason.message || "Unable to download this report.");
    } finally {
      setDownloading("");
    }
  }

  if (loading) return <main className="workspace-page"><LoadingBlock label="Loading your reports..." /></main>;
  if (error) return <main className="workspace-page"><ErrorBlock message={error} onRetry={load} /></main>;

  return <main className="workspace-page report-page">
    <PageHeader eyebrow="CAREER REPORTS" title="Reports" description="Generated from your live CareerOS data. View online or download a formatted PDF." actions={<Badge tone="info">{reports.filter((report) => report.available).length} of {reports.length} available</Badge>} />
    <div className="report-grid">{reports.map((report) => <Panel key={report.type} title={report.title} description={report.description}>
      <div className="report-card-meta"><Badge tone={report.available ? "positive" : "muted"}>{report.available ? "Ready" : "Not ready"}</Badge><span>{report.statusDetail || formatDate(report.generatedAt)}</span></div>
      <div className="button-row">
        <button className="secondary-button" disabled={!report.available} onClick={() => toggle(report.type)}><Icon name={viewing === report.type ? "check" : "search"} size={14} /> {viewing === report.type ? "Hide report" : "View report"}</button>
        <button className="primary-button" disabled={!report.available || downloading === report.type} onClick={() => download(report.type)}><Icon name="download" size={14} /> {downloading === report.type ? "Preparing..." : "Download PDF"}</button>
      </div>
      {viewing === report.type && <div className="report-preview">
        <div className="report-preview-head"><strong>{summary(viewData[report.type])}</strong><span>{report.type === "gap-analysis" ? "Largest gaps first." : "Live data preview."}</span></div>
        <Detail type={report.type} data={viewData[report.type]} />
      </div>}
    </Panel>)}</div>
  </main>;
}
