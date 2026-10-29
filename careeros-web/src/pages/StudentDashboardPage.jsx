import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { auth } from "../lib/auth.js";

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function StudentDashboardPage() {
  const [profile, setProfile] = useState(null);
  const [career, setCareer] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [activeAttempt, setActiveAttempt] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const student = await api.get("/students/me");
      setProfile(student);
      const [readinessData, careerData, catalog, history] = await Promise.all([
        api.get("/students/me/readiness").catch(() => null),
        student?.targetCareerId ? api.get(`/careers/${student.targetCareerId}`).catch(() => null) : Promise.resolve(null),
        student?.targetCareerId ? api.get(`/assessments/${student.targetCareerId}/available`).catch(() => []) : Promise.resolve([]),
        api.get("/students/me/attempts").catch(() => []),
      ]);
      setReadiness(readinessData);
      setCareer(careerData);
      const available = Array.isArray(catalog) ? catalog : [];
      const submitted = Array.isArray(history) ? history : [];
      setAssessments(available);
      setAttempts(submitted);
      const states = await Promise.all(available.map((assessment) => api.get("/assessments/attempts/my", { params: { assessmentId: assessment.assessmentId } }).catch(() => null)));
      setActiveAttempt(states.find((attempt) => attempt?.status === "IN_PROGRESS") || null);
    } catch (reason) {
      setError(reason.message || "Unable to load your dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let active = true;
    let objectUrl;
    if (!profile?.profilePhotoUrl) {
      setPhotoUrl(null);
      return undefined;
    }
    api.get("/students/me/photo", { responseType: "blob" }).then((blob) => {
      if (!active || !blob?.size) return;
      objectUrl = URL.createObjectURL(blob);
      setPhotoUrl(objectUrl);
    }).catch(() => { if (active) setPhotoUrl(null); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [profile?.profilePhotoUrl]);

  const firstName = profile?.fullName?.trim().split(/\s+/)[0] || auth.getUser()?.fullName?.trim().split(/\s+/)[0] || "there";
  const hasTarget = Boolean(profile?.targetCareerId);
  const assessedSkills = readiness?.gaps?.filter((gap) => gap.assessed) || [];
  const gaps = useMemo(() => [...assessedSkills].sort((a, b) => (a.scorePercent ?? 0) - (b.scorePercent ?? 0)), [readiness]);
  const targetAttempts = profile?.targetCareerId
    ? attempts.filter((attempt) => attempt.careerId === profile.targetCareerId)
    : attempts;
  const submitted = targetAttempts.filter((attempt) => attempt.status === "SUBMITTED");
  const latestAttempt = submitted[0] || null;
  const bestScore = submitted.length ? Math.max(...submitted.map((attempt) => attempt.overallScore ?? 0)) : null;
  const nextAction = activeAttempt?.attemptId
    ? { label: "Resume assessment", href: `/student/assessment/attempt/${activeAttempt.attemptId}` }
    : !hasTarget ? { label: "Choose a career", href: "/student/careers" }
      : submitted.length === 0 ? { label: "Take your first assessment", href: "/student/assessment" }
        : { label: "Continue your assessment journey", href: "/student/assessment" };

  if (loading) return <main className="workspace-page"><div className="notice-card" role="status">Loading your dashboard…</div></main>;
  if (error && !profile) return <main className="workspace-page"><header className="workspace-heading"><div><span className="eyebrow">STUDENT DASHBOARD</span><h1>Unable to load your dashboard.</h1><p className="muted">{error}</p></div></header><button className="secondary-button" onClick={load}>Try again</button></main>;

  return <main className="workspace-page dashboard-page">
    <section className="dashboard-welcome"><div className="dashboard-avatar">{photoUrl ? <img src={photoUrl} alt="Profile" /> : <span>{firstName.slice(0, 1).toUpperCase()}</span>}</div><div className="dashboard-welcome-copy"><span className="welcome-greeting">{greeting()}</span><h1>{firstName === "there" ? "Welcome to CareerOS" : `${greeting()}, ${firstName}!`}</h1><p>Keep learning and building. You’re moving toward your career goal one step at a time.</p>{readiness?.readinessLevel && assessedSkills.length > 0 && <span className="readiness-badge">{readiness.readinessLevel.replaceAll("_", " ")}</span>}</div><Link className="welcome-action" to={nextAction.href}>{nextAction.label} <span aria-hidden="true">→</span></Link></section>

    <section className="dashboard-career-card"><div className="career-target-icon" aria-hidden="true">◎</div><div className="dashboard-career-copy"><span className="eyebrow">TARGET CAREER</span>{hasTarget ? <><h2>{profile.targetCareerName || career?.name || "Your career"}</h2><p>{career?.description || "Your assessment and skill framework are tailored to this career."}</p><span className="muted">{assessedSkills.length ? `${assessedSkills.length} skills assessed · ${readiness?.metSkills ?? 0} on target` : "Take an assessment to calculate your readiness."}</span></> : <><h2>Set your target career</h2><p>Choose a direction to unlock relevant assessments and see the skills employers expect.</p></>}</div>{assessedSkills.length > 0 && <div className="readiness-meter" aria-label={`${readiness.readinessPercent}% career readiness`}><strong>{readiness.readinessPercent}<small>%</small></strong><span>ready</span></div>}<Link className="secondary-button" to={hasTarget ? "/student/careers" : "/student/careers"}>{hasTarget ? "Change career" : "Choose career"}</Link></section>

    <section className="dashboard-stat-grid" aria-label="Learning summary"><article className="dashboard-stat"><span>Assessments completed</span><strong>{submitted.length}<small> / {assessments.length} available</small></strong><p>{latestAttempt ? `Latest score ${latestAttempt.overallScore ?? 0}% · ${formatDate(latestAttempt.submittedAt)}` : "Your assessment results will appear here."}</p><Link to="/student/assessment">View assessments →</Link></article><article className="dashboard-stat"><span>Career readiness</span><strong>{assessedSkills.length ? `${readiness.readinessPercent}%` : "—"}</strong><p>{assessedSkills.length ? `${readiness.metSkills ?? 0} of ${readiness.totalSkills ?? 0} skills currently meet target.` : "Complete an assessment to establish your baseline."}</p><Link to={hasTarget ? "/student/progress" : "/student/careers"}>{hasTarget ? "View skill progress →" : "Choose a career →"}</Link></article><article className="dashboard-stat"><span>Best assessment score</span><strong>{bestScore === null ? "—" : `${bestScore}%`}</strong><p>{submitted.length ? `${submitted.length} submitted attempt${submitted.length === 1 ? "" : "s"} across your career assessments.` : "Your best score appears after your first assessment."}</p><Link to="/student/assessment">Practice now →</Link></article></section>

    <div className="dashboard-content-grid">
      <section className="dashboard-panel"><div className="dashboard-panel-heading"><div><h2>Skills to strengthen</h2><p>Based on your latest assessment for {readiness?.targetCareerName || profile?.targetCareerName || "your target career"}.</p></div><Link to="/student/progress">All skills →</Link></div>{!hasTarget ? <div className="dashboard-empty"><p>Choose a target career to view its skill framework.</p><Link className="primary-button" to="/student/careers">Choose career</Link></div> : gaps.length === 0 ? <div className="dashboard-empty"><p>{assessedSkills.length ? "Your assessed skills are meeting their targets." : "No assessment results yet. Take a test to discover your current skill level."}</p><Link className="primary-button" to="/student/assessment">{assessedSkills.length ? "Review assessments" : "Take an assessment"}</Link></div> : <div className="dashboard-skill-list">{gaps.slice(0, 5).map((gap) => { const score = gap.scorePercent ?? 0; const target = gap.targetPercent ?? 80; return <article className="dashboard-skill" key={gap.skillId}><div className="dashboard-skill-heading"><strong>{gap.skillName}</strong><span>{score}% <small>/ {target}% target</small></span></div><div className="skill-meter" role="img" aria-label={`${gap.skillName}: ${score} percent, target ${target} percent`}><span style={{ width: `${Math.min(100, score)}%` }} /><i style={{ left: `${Math.min(100, target)}%` }} /></div><small>{gap.skillCategory?.replaceAll("_", " ") || "Skill"} · {gap.metTarget ? "On target" : `${Math.max(0, target - score)} points to target`}</small></article>; })}</div>}</section>

      <section className="dashboard-panel"><div className="dashboard-panel-heading"><div><h2>Recent assessments</h2><p>Your latest submitted results and active attempt.</p></div><Link to="/student/assessment">See all →</Link></div>{activeAttempt && <Link className="resume-attempt-card" to={`/student/assessment/attempt/${activeAttempt.attemptId}`}><span className="resume-label">IN PROGRESS</span><strong>{activeAttempt.assessmentTitle}</strong><span>{activeAttempt.answeredCount ?? 0} of {activeAttempt.totalQuestions ?? 0} answered · Resume →</span></Link>}{submitted.length === 0 ? <div className="dashboard-empty"><p>{activeAttempt ? "Your submitted results will show here." : "Take an assessment to see your progress over time."}</p>{!activeAttempt && <Link className="primary-button" to={hasTarget ? "/student/assessment" : "/student/careers"}>{hasTarget ? "Take assessment" : "Choose a career"}</Link>}</div> : <ol className="recent-attempt-list">{submitted.slice(0, 5).map((attempt) => <li key={attempt.attemptId}><div><strong>{attempt.assessmentTitle}</strong><span>{formatDate(attempt.submittedAt)} · {attempt.answeredCount}/{attempt.totalQuestions} answered</span></div><b>{attempt.overallScore ?? 0}%</b><Link to={`/student/assessment/attempt/${attempt.attemptId}`} aria-label={`Review ${attempt.assessmentTitle} result`}>Review</Link></li>)}</ol>}</section>
    </div>

    <section className="dashboard-next"><div><span className="eyebrow">RECOMMENDED NEXT STEP</span><h2>{activeAttempt ? `Pick up ${activeAttempt.assessmentTitle}` : !hasTarget ? "Choose your target career" : submitted.length ? "Keep building your readiness" : "Take your first assessment"}</h2><p>{activeAttempt ? `${activeAttempt.answeredCount ?? 0} of ${activeAttempt.totalQuestions ?? 0} questions answered. Your saved progress is ready.` : !hasTarget ? "Career selection unlocks a relevant skill framework and assessments." : submitted.length ? "Review skill gaps, then retake assessments to see how your scores improve." : "Role-specific questions will measure your current skills against the career framework."}</p></div><Link className="primary-button" to={nextAction.href}>{nextAction.label}</Link></section>

    <div className="dashboard-footer-links"><Link to="/student/profile">Update profile</Link><Link to="/student/careers">Explore careers</Link><span>{profile?.email || ""}</span></div>
  </main>;
}
