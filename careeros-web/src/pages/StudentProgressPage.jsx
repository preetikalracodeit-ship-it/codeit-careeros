import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";

function dateLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString();
}

function levelLabel(value) {
  return String(value || "Not assessed").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function StudentProgressPage() {
  const [readiness, setReadiness] = useState(null);
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [snapshot, attempts] = await Promise.all([
        api.get("/students/me/readiness"),
        api.get("/students/me/attempts"),
      ]);
      setReadiness(snapshot || null);
      setHistory(Array.isArray(attempts) ? attempts : []);
    } catch (reason) {
      setError(reason.message || "Unable to load your skill progress.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const careerAttempts = useMemo(() => {
    if (!readiness?.targetCareerId) return [];
    return history.filter((attempt) => attempt.careerId === readiness.targetCareerId);
  }, [history, readiness?.targetCareerId]);
  const latest = careerAttempts[0] || null;
  const previous = careerAttempts[1] || null;
  const scoreDelta = latest?.overallScore != null && previous?.overallScore != null ? latest.overallScore - previous.overallScore : null;
  const skills = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...(readiness?.gaps || [])]
      .filter((skill) => filter === "ALL" || (filter === "ASSESSED" ? skill.assessed : !skill.assessed))
      .filter((skill) => !term || `${skill.skillName} ${skill.skillCategory} ${skill.requiredLevel}`.toLowerCase().includes(term))
      .sort((a, b) => {
        if (Boolean(a.assessed) !== Boolean(b.assessed)) return a.assessed ? -1 : 1;
        return (a.gapPercent ?? Number.POSITIVE_INFINITY) - (b.gapPercent ?? Number.POSITIVE_INFINITY);
      });
  }, [readiness?.gaps, search, filter]);

  if (loading) return <main className="workspace-page"><div className="notice-card" role="status">Loading your skill progress…</div></main>;
  if (error) return <main className="workspace-page"><header className="workspace-heading"><div><span className="eyebrow">YOUR PROGRESS</span><h1>Couldn’t load your progress.</h1><p className="muted">{error}</p></div></header><button className="secondary-button" onClick={load}>Try again</button></main>;

  const hasTarget = Boolean(readiness?.hasTarget);
  const assessed = readiness?.assessedSkills ?? 0;
  const totalSkills = readiness?.totalSkills ?? 0;
  const onTarget = readiness?.metSkills ?? 0;

  return <main className="workspace-page progress-page">
    <header className="workspace-heading"><div><span className="eyebrow">YOUR PROGRESS</span><h1>My progress</h1><p className="muted">{hasTarget ? `Tracking your current skills against ${readiness.targetCareerName}.` : "Choose a target career to start tracking measured skill progress."}</p></div>{hasTarget && assessed > 0 && <span className="progress-level-badge">{levelLabel(readiness.readinessLevel)} · {readiness.readinessPercent}%</span>}</header>
    {!hasTarget && <section className="dashboard-next"><div><span className="eyebrow">START HERE</span><h2>No target career yet</h2><p>Career selection gives your assessments a matching skill framework.</p></div><Link className="primary-button" to="/student/careers">Choose career</Link></section>}

    <section className="progress-summary-grid" aria-label="Progress summary"><article className="progress-summary-card readiness-summary"><span>Career readiness</span>{assessed ? <><strong>{readiness.readinessPercent}%</strong><div className="readiness-bar"><span style={{ width: `${Math.min(100, readiness.readinessPercent || 0)}%` }} /></div><small>{assessed} of {totalSkills} skills assessed</small></> : <><strong>—</strong><small>{hasTarget ? "Submit an assessment to establish your baseline." : "Select a target career first."}</small></>}</article><article className="progress-summary-card"><span>Skills on target</span><strong>{onTarget}<small> / {totalSkills}</small></strong><small>{assessed ? `${Math.max(0, assessed - onTarget)} assessed skill${assessed - onTarget === 1 ? "" : "s"} need attention.` : "Your assessed strengths appear here."}</small></article><article className="progress-summary-card"><span>Assessments completed</span><strong>{careerAttempts.length}</strong>{latest ? <small>Latest: {latest.overallScore ?? 0}% · {dateLabel(latest.submittedAt)}</small> : <small>No assessment submitted for this career yet.</small>}</article></section>

    {scoreDelta !== null && <div className={`score-change ${scoreDelta >= 0 ? "score-change-up" : "score-change-down"}`}><strong>{scoreDelta >= 0 ? `+${scoreDelta}` : scoreDelta} points</strong><span>since your previous assessment</span><Link to={`/student/assessment/attempt/${latest.attemptId}`}>Review latest result →</Link></div>}

    <section className="progress-skills-panel"><div className="dashboard-panel-heading"><div><h2>Skill progress</h2><p>Current assessment score compared with each required target. Skills without scores are listed after assessed skills.</p></div><Link to="/student/assessment">Assess skills →</Link></div>
      {hasTarget && skills.length === 0 && <div className="dashboard-empty"><p>{search || filter !== "ALL" ? "No skills match these filters." : "No framework skills are available for this career yet."}</p></div>}
      {!hasTarget && <div className="dashboard-empty"><p>Select a target career to load the required competency framework.</p><Link className="primary-button" to="/student/careers">Explore careers</Link></div>}
      {hasTarget && <>
        <div className="skill-filters"><label>Search skills<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by skill, category, or level" /></label><label>Show<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="ALL">All skills</option><option value="ASSESSED">Assessed</option><option value="UNASSESSED">Not assessed</option></select></label></div>
        <div className="progress-skill-list">{skills.map((skill) => {
          const score = skill.assessed ? skill.scorePercent ?? 0 : null;
          const target = skill.targetPercent ?? 0;
          const progressPercent = score === null || target <= 0 ? 0 : Math.min(100, Math.round(score * 100 / target));
          return <article className="progress-skill-row" key={skill.skillId}><div className="progress-skill-top"><div><h3>{skill.skillName}</h3><span>{levelLabel(skill.requiredLevel)} · {skill.weightPercent}% weight · {skill.skillCategory}</span></div><div className="progress-skill-score"><strong>{score === null ? `Target ${target}%` : `${score}%`}</strong><span className={`skill-status${skill.metTarget ? " skill-status-met" : ""}`}>{!skill.assessed ? "Not assessed" : skill.metTarget ? "On target" : `${Math.max(0, target - score)} points below target`}</span></div></div><div className="skill-meter" role="img" aria-label={score === null ? `${skill.skillName}: not assessed, target ${target} percent` : `${skill.skillName}: ${score} percent, target ${target} percent`}><span className={skill.metTarget ? "skill-meter-met" : ""} style={{ width: `${score === null ? 0 : score}%` }} /><i style={{ left: `${Math.min(100, target)}%` }} /></div>{skill.assessed && <small className="progress-skill-evidence">{skill.correctCount ?? 0} of {skill.questionCount ?? 0} correct · {levelLabel(skill.level)}</small>}</article>;
        })}</div>
      </>}
    </section>

    <section className="progress-history-panel"><div className="dashboard-panel-heading"><div><h2>Assessment history</h2><p>Submitted assessments for this target career.</p></div><Link to="/student/assessment">View assessments →</Link></div>{careerAttempts.length === 0 ? <p className="muted">No submitted assessments yet. Your skill scores will appear here after your first assessment.</p> : <ol className="recent-attempt-list">{careerAttempts.slice(0, 8).map((attempt) => <li key={attempt.attemptId}><div><strong>{attempt.assessmentTitle}</strong><span>{dateLabel(attempt.submittedAt)} · {attempt.answeredCount}/{attempt.totalQuestions} answered</span></div><b>{attempt.overallScore ?? 0}%</b><Link to={`/student/assessment/attempt/${attempt.attemptId}`} aria-label={`Review ${attempt.assessmentTitle} result`}>Review</Link></li>)}</ol>}</section>
  </main>;
}
