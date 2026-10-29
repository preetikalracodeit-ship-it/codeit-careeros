import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../lib/api.js";

function remainingSeconds(expiresAt) {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function clockLabel(seconds) {
  if (seconds == null) return "--:--";
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}` : `${minutes}:${String(secs).padStart(2, "0")}`;
}

function pretty(value) {
  return String(value || "").replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

const levelText = {
  STRONG: "Strong", GOOD: "Good", DEVELOPING: "Developing",
  NEEDS_IMPROVEMENT: "Needs improvement", PRIORITY_GAP: "Priority gap",
};

export function AssessmentAttemptPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState(null);
  const [selections, setSelections] = useState({});
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [pendingSaves, setPendingSaves] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expired, setExpired] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const stateRef = useRef(null);
  const submittingRef = useRef(false);
  const autoSubmittedRef = useRef(false);

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { submittingRef.current = submitting; }, [submitting]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.get(`/assessments/attempts/${attemptId}`);
      setState(data);
      if (data.status === "IN_PROGRESS") {
        const initial = Object.fromEntries((data.questions || []).filter((question) => question.selectedOptionId).map((question) => [question.questionId, question.selectedOptionId]));
        setSelections(initial);
        setSecondsLeft(remainingSeconds(data.expiresAt));
        setExpired(false);
      } else if (data.status === "EXPIRED") {
        setExpired(true);
      }
    } catch (reason) {
      setError(reason.message || "Unable to load this attempt.");
    } finally {
      setLoading(false);
    }
  }, [attemptId]);

  useEffect(() => { load(); }, [load]);

  const active = state?.status === "IN_PROGRESS" && !expired;
  const questions = active ? state.questions || [] : [];
  const total = state?.totalQuestions ?? questions.length;
  const answered = state?.answeredCount ?? 0;
  const unanswered = Math.max(0, total - answered);

  const submit = useCallback(async (automatic = false) => {
    const current = stateRef.current;
    if (!current || current.status !== "IN_PROGRESS" || submittingRef.current) return;
    if (automatic) {
      if (autoSubmittedRef.current) return;
      autoSubmittedRef.current = true;
      toast.message("Time is up. Submitting your attempt.");
    }
    submittingRef.current = true;
    setSubmitting(true);
    setConfirmSubmit(false);
    try {
      const result = await api.post(`/assessments/attempts/${attemptId}/submit`);
      setState({ ...result, status: "SUBMITTED" });
      if (automatic) toast.success("Attempt submitted.");
      else toast.success(`Submitted. Overall score: ${result.overallScore ?? 0}%`);
    } catch (reason) {
      if (reason.status === 410 || reason.errorCode === "ATTEMPT_EXPIRED") {
        setExpired(true);
        toast.error("The time limit expired before submission.");
        await load();
      } else {
        if (automatic) autoSubmittedRef.current = false;
        toast.error(reason.message || "Unable to submit this attempt.");
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [attemptId, load]);

  useEffect(() => {
    if (!active || !state?.expiresAt) return undefined;
    const timer = window.setInterval(() => {
      const left = remainingSeconds(state.expiresAt);
      setSecondsLeft(left);
      if (left <= 0) submit(true);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [active, state?.expiresAt, submit]);

  async function select(questionId, optionId) {
    if (!active || submitting) return;
    setSelections((current) => ({ ...current, [questionId]: optionId }));
    setPendingSaves((count) => count + 1);
    try {
      const progress = await api.put(`/assessments/attempts/${attemptId}/answers`, { questionId, optionId });
      setState((current) => current ? {
        ...current,
        answeredCount: Math.max(current.answeredCount || 0, progress.answeredCount || 0),
        answeredQuestionIds: progress.answeredQuestionIds || current.answeredQuestionIds,
      } : current);
    } catch (reason) {
      if (reason.status === 410 || reason.errorCode === "ATTEMPT_EXPIRED") {
        setExpired(true);
        toast.error("The time limit expired. Saved answers are kept and this attempt is closed.");
        await load();
      } else {
        toast.error(reason.message || "Unable to save your answer.");
      }
    } finally {
      setPendingSaves((count) => Math.max(0, count - 1));
    }
  }

  async function startAgain() {
    try {
      const next = await api.post(`/assessments/${state.assessmentId}/start`);
      navigate(`/student/assessment/attempt/${next.attemptId}`, { replace: true });
    } catch (reason) {
      toast.error(reason.message || "Unable to start a new attempt.");
    }
  }

  if (loading) return <main className="workspace-page"><div className="notice-card" role="status">Loading attempt…</div></main>;
  if (error || !state) return <main className="workspace-page"><header className="workspace-heading"><div><span className="eyebrow">ASSESSMENT</span><h1>Couldn’t load the attempt.</h1><p className="muted">{error}</p></div></header><button className="secondary-button" onClick={load}>Try again</button></main>;

  if (expired || state.status === "EXPIRED") return <main className="workspace-page"><header className="workspace-heading"><div><span className="eyebrow">ASSESSMENT · EXPIRED</span><h1>{state.assessmentTitle || "Attempt expired"}</h1><p className="muted">The {state.durationMinutes}-minute limit elapsed, so the server closed this attempt. Your history is preserved.</p></div></header><div className="assessment-actions"><Link className="secondary-button" to="/student/assessment">Back to assessments</Link><button className="primary-button" onClick={startAgain}>Start a new attempt</button></div></main>;

  if (state.status === "SUBMITTED") return <main className="workspace-page">
    <header className="workspace-heading"><div><span className="eyebrow">ASSESSMENT RESULT · {state.careerName || "CAREER"}</span><h1>{state.assessmentTitle || "Assessment result"}</h1><p className="muted">Submitted {state.submittedAt ? new Date(state.submittedAt).toLocaleString() : ""}</p></div><Link className="secondary-button" to="/student/assessment">All assessments</Link></header>
    <section className="overall-score"><span>Overall score</span><strong>{state.overallScore ?? 0}<small>%</small></strong><p>{state.answeredCount ?? 0} of {state.totalQuestions ?? 0} questions answered · weighted by your career framework</p></section>
    <section className="result-list"><h2>Skill-wise scores</h2><p className="muted">Your score compared with the target for each measured skill.</p>
      {(state.skills || []).length === 0 ? <p className="notice-card">No skill scores were recorded.</p> : (state.skills || []).map((skill) => <article className="skill-result" key={skill.skillId}><div className="skill-result-heading"><strong>{skill.skillName}</strong><span>{levelText[skill.level] || pretty(skill.level)}</span></div><div className="skill-result-detail"><span>{skill.correctCount}/{skill.questionCount} correct · {skill.scorePercent}%</span><span>Target {skill.targetPercent}%</span></div><div className="skill-meter" role="img" aria-label={`${skill.skillName}: ${skill.scorePercent} percent, target ${skill.targetPercent} percent`}><span style={{ width: `${Math.min(100, skill.scorePercent)}%` }} /><i style={{ left: `${Math.min(100, skill.targetPercent)}%` }} /></div></article>)}
    </section>
    <div className="assessment-actions"><Link className="secondary-button" to="/student/dashboard">View career readiness</Link><button className="primary-button" onClick={startAgain}>Retake assessment</button></div>
  </main>;

  const lowTime = secondsLeft !== null && secondsLeft <= 300;
  return <main className="workspace-page attempt-page">
    <header className="workspace-heading"><div><span className="eyebrow">{state.careerName || "CAREER"} · AUTOSAVING</span><h1>{state.assessmentTitle || "Assessment attempt"}</h1><p className="muted">Choose one answer for each question. Your selections save automatically.</p></div><Link className="secondary-button" to="/student/assessment">Leave attempt</Link></header>
    <section className="attempt-toolbar" aria-label="Attempt status"><div><span className="toolbar-label">Time remaining</span><strong className={lowTime ? "time-low" : ""} aria-live="polite">{clockLabel(secondsLeft)}</strong></div><div><span className="toolbar-label">Answered</span><strong>{answered} / {total}</strong></div><div className="save-state" role="status">{pendingSaves > 0 ? "Saving answers…" : answered > 0 ? "Answers saved" : "No answers yet"}</div><button className="primary-button" disabled={submitting || pendingSaves > 0} onClick={() => unanswered > 0 ? setConfirmSubmit(true) : submit()}>{submitting ? "Submitting…" : "Submit attempt"}</button></section>
    <div className="answer-progress"><div style={{ width: `${total ? (answered / total) * 100 : 0}%` }} /></div>
    <section className="question-list" aria-label="Assessment questions">{questions.map((question, index) => <article className="question-card" key={question.questionId}><div className="question-heading"><h2><span>{index + 1}.</span> {question.questionText}</h2><div className="question-tags"><span>{question.skillName}</span><span>{pretty(question.difficulty)}</span></div></div><div className="option-list" role="radiogroup" aria-label={`Question ${index + 1}`}>{(question.options || []).map((option) => { const selected = selections[question.questionId] === option.optionId; return <button className={`answer-option${selected ? " answer-option-selected" : ""}`} key={option.optionId} type="button" role="radio" aria-checked={selected} disabled={submitting} onClick={() => select(question.questionId, option.optionId)}><span className="radio-mark" aria-hidden="true">{selected ? "✓" : ""}</span>{option.optionText}</button>; })}</div></article>)}</section>
    <section className="attempt-submit-footer"><p>{unanswered === 0 ? "All questions answered. You’re ready to submit." : `${unanswered} of ${total} questions unanswered.`}</p><button className="primary-button" disabled={submitting || pendingSaves > 0} onClick={() => unanswered > 0 ? setConfirmSubmit(true) : submit()}>{submitting ? "Submitting…" : "Submit attempt"}</button></section>
    {confirmSubmit && <div className="dialog-backdrop" role="presentation"><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description"><h2 id="confirm-title">Submit with unanswered questions?</h2><p id="confirm-description">{unanswered} of {total} questions have no answer. They score zero. You cannot change answers after submission.</p><div><button className="secondary-button" onClick={() => setConfirmSubmit(false)} disabled={submitting}>Keep answering</button><button className="primary-button" onClick={() => submit()} disabled={submitting}>{submitting ? "Submitting…" : "Submit anyway"}</button></div></section></div>}
  </main>;
}
