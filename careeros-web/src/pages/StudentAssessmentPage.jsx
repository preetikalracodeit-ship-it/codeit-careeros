import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../lib/api.js";

function dateLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

function attemptLabel(attempt) {
  if (!attempt) return "Not started";
  if (attempt.status === "IN_PROGRESS") return `In progress · ${attempt.answeredCount || 0}/${attempt.totalQuestions || 0} answered`;
  if (attempt.status === "SUBMITTED") return `Submitted · ${attempt.overallScore ?? 0}%`;
  if (attempt.status === "EXPIRED") return "Expired · retake available";
  return attempt.status;
}

export function StudentAssessmentPage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [latest, setLatest] = useState({});
  const [history, setHistory] = useState({});
  const [historyOpen, setHistoryOpen] = useState({});
  const [startingId, setStartingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const student = await api.get("/students/me");
      setProfile(student);
      if (!student?.targetCareerId) {
        setAssessments([]);
        setLatest({});
        setHistory({});
        return;
      }
      const catalog = await api.get(`/assessments/${student.targetCareerId}/available`);
      const items = Array.isArray(catalog) ? catalog : [];
      setAssessments(items);
      const [latestEntries, historyEntries] = await Promise.all([
        Promise.all(items.map(async (item) => {
          try {
            return [item.assessmentId, await api.get("/assessments/attempts/my", { params: { assessmentId: item.assessmentId } })];
          } catch (reason) {
            if (reason.status === 404) return [item.assessmentId, null];
            throw reason;
          }
        })),
        Promise.all(items.map(async (item) => {
          const rows = await api.get("/students/me/attempts", { params: { assessmentId: item.assessmentId } });
          return [item.assessmentId, Array.isArray(rows) ? rows : []];
        })),
      ]);
      setLatest(Object.fromEntries(latestEntries));
      setHistory(Object.fromEntries(historyEntries));
    } catch (reason) {
      setError(reason.message || "Unable to load assessments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submitted = useMemo(() => assessments.map((item) => latest[item.assessmentId]).filter((item) => item?.status === "SUBMITTED"), [assessments, latest]);
  const bestScore = submitted.length ? Math.max(...submitted.map((item) => item.overallScore ?? 0)) : null;
  const inProgressCount = assessments.filter((item) => latest[item.assessmentId]?.status === "IN_PROGRESS").length;

  async function start(assessment) {
    const prior = latest[assessment.assessmentId];
    if (prior?.status === "IN_PROGRESS") {
      navigate(`/student/assessment/attempt/${prior.attemptId}`);
      return;
    }
    setStartingId(assessment.assessmentId);
    try {
      const attempt = await api.post(`/assessments/${assessment.assessmentId}/start`);
      navigate(`/student/assessment/attempt/${attempt.attemptId}`);
    } catch (reason) {
      toast.error(reason.message || "Unable to start this assessment.");
    } finally {
      setStartingId(null);
    }
  }

  if (loading) return <main className="workspace-page"><div className="notice-card" role="status">Loading assessments…</div></main>;
  if (error) return <main className="workspace-page"><header className="workspace-heading"><div><span className="eyebrow">SKILL CHECK</span><h1>Assessments</h1></div></header><div className="error-banner" role="alert">{error}<button className="text-button" onClick={load}>Try again</button></div></main>;

  if (!profile?.targetCareerId) return <main className="workspace-page"><header className="workspace-heading"><div><span className="eyebrow">SKILL CHECK</span><h1>Choose a target career first.</h1><p className="muted">Assessments are matched to your career’s competency framework.</p></div></header><Link className="primary-button inline-action" to="/student/careers">Choose a career</Link></main>;

  return <main className="workspace-page">
    <header className="workspace-heading"><div><span className="eyebrow">SKILL CHECK · {profile.targetCareerName || "YOUR CAREER"}</span><h1>Prove your skills. Find your gaps.</h1><p className="muted">Timed assessments map your results to the skills for {profile.targetCareerName || "your target career"}. Answers save automatically as you go.</p></div><Link className="secondary-button" to="/student/dashboard">Dashboard</Link></header>
    <section className="assessment-summary" aria-label="Assessment summary">
      <div><strong>{assessments.length}</strong><span>Available tests</span></div><div><strong>{submitted.length}</strong><span>Completed</span></div><div><strong>{bestScore === null ? "—" : `${bestScore}%`}</strong><span>Best score</span></div>
      {inProgressCount > 0 && <p>{inProgressCount} attempt{inProgressCount === 1 ? "" : "s"} in progress. Resume below.</p>}
    </section>
    {assessments.length === 0 ? <div className="notice-card">No assessments have been published for this career yet. Check back soon.</div> : <section className="assessment-grid" aria-label="Available assessments">
      {assessments.map((assessment) => {
        const attempt = latest[assessment.assessmentId];
        const attempts = history[assessment.assessmentId] || [];
        const resume = attempt?.status === "IN_PROGRESS";
        const review = attempt?.status === "SUBMITTED";
        const answered = attempt?.answeredCount ?? 0;
        const total = attempt?.totalQuestions ?? assessment.questionCount ?? 0;
        const best = attempts.length ? Math.max(...attempts.map((item) => item.overallScore ?? 0)) : null;
        return <article className={`assessment-card${resume ? " assessment-card-active" : ""}`} key={assessment.assessmentId}>
          <div className="assessment-card-heading"><span className="assessment-icon" aria-hidden="true">{review ? "✓" : resume ? "▶" : "▤"}</span><div><h2>{assessment.title}</h2><span className={`attempt-chip${review ? " chip-complete" : resume ? " chip-active" : ""}`}>{attemptLabel(attempt)}</span></div></div>
          <p className="assessment-description">{assessment.description || "A focused check of the skills in your target career framework."}</p>
          {review && <div className="score-callout"><strong>{attempt.overallScore ?? 0}%</strong><span>{dateLabel(attempt.submittedAt)}{attempts.length > 1 && best !== null ? ` · Best ${best}%` : ""}</span></div>}
          {resume && total > 0 && <div className="attempt-progress"><div><span>Attempt progress</span><strong>{answered}/{total} · {Math.round((answered / total) * 100)}%</strong></div><progress max="100" value={(answered / total) * 100} aria-label={`${answered} of ${total} questions answered`} /></div>}
          <div className="assessment-meta"><span>{assessment.durationMinutes} min · timed</span><span>{assessment.questionCount} questions</span>{attempts.length > 0 && <button className="inline-link" aria-expanded={Boolean(historyOpen[assessment.assessmentId])} onClick={() => setHistoryOpen((current) => ({ ...current, [assessment.assessmentId]: !current[assessment.assessmentId] }))}>History ({attempts.length})</button>}</div>
          {historyOpen[assessment.assessmentId] && <ol className="assessment-history">{attempts.map((row) => <li key={row.attemptId}><span>{dateLabel(row.submittedAt)}</span><strong>{row.overallScore ?? "—"}%</strong><button className="inline-link" onClick={() => navigate(`/student/assessment/attempt/${row.attemptId}`)}>Review</button></li>)}</ol>}
          <div className="assessment-actions">{review && <button className="secondary-button" onClick={() => navigate(`/student/assessment/attempt/${attempt.attemptId}`)}>Review result</button>}<button className="primary-button" disabled={startingId !== null} onClick={() => start(assessment)}>{startingId === assessment.assessmentId ? "Starting…" : resume ? "Resume attempt" : review || attempt?.status === "EXPIRED" ? "Retake assessment" : "Start assessment"}</button></div>
        </article>;
      })}
    </section>}
  </main>;
}
