import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ClipboardCheck, Target } from "lucide-react";
import api from "../lib/api.js";

export default function AssessmentPage() {
  const [profile, setProfile] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [readiness, setReadiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    api.get("/students/me").then(async (student) => {
      if (!active) return;
      setProfile(student);
      if (student?.targetCareerId) {
        const [available, insight] = await Promise.all([
          api.get(`/assessments/${student.targetCareerId}/available`),
          api.get("/students/me/readiness"),
        ]);
        if (active) { setAssessments(Array.isArray(available) ? available : []); setReadiness(insight); }
      }
    }).catch((requestError) => { if (active) setError(requestError.message || "Could not load assessments."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const start = async (assessment) => {
    setBusyId(assessment.assessmentId); setError("");
    try {
      const attempt = await api.post(`/assessments/${assessment.assessmentId}/start`);
      navigate(`/student/assessment/attempt/${attempt.attemptId}`);
    } catch (requestError) { setError(requestError.message || "Could not start this assessment."); }
    finally { setBusyId(null); }
  };

  if (loading) return <section className="page-card" role="status">Loading assessments…</section>;
  return <div className="assessment-page">
    <header className="career-heading"><div><p className="eyebrow">CHECK YOUR PROGRESS</p><h1>Assessments</h1><p className="muted">Complete a short assessment to see how your skills match your career target.</p></div>
      {profile?.targetCareerName && <div className="target-summary"><Target size={18} aria-hidden="true"/><span><small>YOUR TARGET</small><strong>{profile.targetCareerName}</strong></span></div>}
    </header>
    {error && <p className="form-error" role="alert">{error}</p>}
    {!profile?.targetCareerId ? <section className="page-card"><h2>Choose a career target</h2><p>Select a target career to see its assessments and readiness summary.</p><button className="button button-primary" onClick={() => navigate("/student/careers")}>Explore careers <ArrowRight size={16}/></button></section> : <>
      {readiness && <section className="readiness-card"><div><span className="eyebrow">CAREER READINESS</span><strong>{readiness.readinessPercent ?? 0}%</strong><span className="muted">{readiness.assessedSkills ?? 0} of {readiness.totalSkills ?? 0} skills assessed</span></div><div className="readiness-track" role="progressbar" aria-label="Career readiness" aria-valuenow={readiness.readinessPercent ?? 0} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${readiness.readinessPercent ?? 0}%` }}/></div></section>}
      {assessments.length === 0 ? <section className="page-card"><h2>No assessments available</h2><p>There are no published assessments for {profile.targetCareerName} yet.</p></section> : <div className="assessment-list">{assessments.map((item) => <article className="assessment-card" key={item.assessmentId}><div className="assessment-icon"><ClipboardCheck size={20}/></div><div className="assessment-info"><h2>{item.title}</h2><p>{item.description || `Check your skills for ${item.careerName}.`}</p><span>{item.questionCount} questions · {item.durationMinutes} minutes</span></div><button className="button button-primary" disabled={busyId !== null} onClick={() => start(item)}>{busyId === item.assessmentId ? "Opening…" : "Start assessment"}<ArrowRight size={16}/></button></article>)}</div>}
    </>}
  </div>;
}
