import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, Clock3 } from "lucide-react";
import api from "../lib/api.js";

function remainingTime(expiresAt) {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}
function formatTime(seconds) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export default function AssessmentAttemptPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(null);
  const [index, setIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const loadAttempt = useCallback(async () => {
    const state = await api.get(`/assessments/attempts/${attemptId}`);
    setAttempt(state);
    if (state.status === "IN_PROGRESS") setRemaining(remainingTime(state.expiresAt));
    else if (state.status === "SUBMITTED") setResult(state);
  }, [attemptId]);

  useEffect(() => { loadAttempt().catch((requestError) => setError(requestError.message || "Could not load this attempt.")); }, [loadAttempt]);
  useEffect(() => {
    if (!attempt?.expiresAt || attempt.status !== "IN_PROGRESS") return undefined;
    const timer = window.setInterval(() => setRemaining(remainingTime(attempt.expiresAt)), 1000);
    return () => window.clearInterval(timer);
  }, [attempt?.expiresAt, attempt?.status]);

  const questions = attempt?.questions || [];
  const question = questions[index];
  const answered = useMemo(() => new Set(attempt?.answeredQuestionIds || []), [attempt?.answeredQuestionIds]);

  const choose = async (optionId) => {
    if (!question || saving || remaining <= 0 || attempt?.status !== "IN_PROGRESS") return;
    setSaving(true); setError("");
    try {
      const progress = await api.put(`/assessments/attempts/${attemptId}/answers`, { questionId: question.questionId, optionId });
      setAttempt((current) => ({ ...current, answeredQuestionIds: progress.answeredQuestionIds, answeredCount: progress.answeredCount, questions: current.questions.map((item) => item.questionId === question.questionId ? { ...item, selectedOptionId: optionId } : item) }));
    } catch (requestError) {
      setError(requestError.message || "Your answer could not be saved. Please retry.");
      if (requestError.status === 410) setRemaining(0);
    } finally { setSaving(false); }
  };

  const submit = async () => {
    setSubmitting(true); setError("");
    try {
      const submitted = await api.post(`/assessments/attempts/${attemptId}/submit`);
      setResult(submitted); setAttempt((current) => ({ ...current, status: "SUBMITTED" }));
    } catch (requestError) {
      setError(requestError.message || "Could not submit the assessment.");
      if (requestError.status === 410) { setRemaining(0); loadAttempt().catch(() => {}); }
    } finally { setSubmitting(false); }
  };

  if (error && !attempt) return <section className="page-card"><h1>Assessment unavailable</h1><p role="alert">{error}</p><button className="button button-quiet" onClick={() => navigate("/student/assessment")}>Back to assessments</button></section>;
  if (!attempt) return <section className="page-card" role="status">Loading your assessment…</section>;
  if (result || attempt.status === "SUBMITTED") {
    const submitted = result || attempt;
    return <section className="page-card result-card"><p className="eyebrow">ASSESSMENT COMPLETE</p><h1>{submitted.assessmentTitle}</h1><strong className="result-score">{submitted.overallScore ?? 0}%</strong><p>Your answers have been scored. Review the skill breakdown below.</p><div className="result-skills">{(submitted.skills || []).map((skill) => <div key={skill.skillId}><span><strong>{skill.skillName}</strong><small>{skill.correctCount} of {skill.questionCount} correct</small></span><strong>{skill.scorePercent}%</strong></div>)}</div><button className="button button-primary" onClick={() => navigate("/student/assessment")}>Back to assessments</button></section>;
  }

  if (attempt.status !== "IN_PROGRESS" || remaining <= 0) return <section className="page-card"><p className="eyebrow">ASSESSMENT CLOSED</p><h1>This attempt has expired</h1><p>Answers were not submitted before the time limit. You can return to the assessment list and start again.</p><button className="button button-primary" onClick={() => navigate("/student/assessment")}>Back to assessments</button></section>;
  if (!question) return <section className="page-card"><h1>No questions found</h1><p>This assessment attempt could not load its questions.</p></section>;

  return <section className="attempt-page">
    <header className="attempt-header"><button className="button button-quiet" onClick={() => navigate("/student/assessment")}><ArrowLeft size={16}/> Exit</button><div><p className="eyebrow">{attempt.assessmentTitle}</p><span>{attempt.careerName}</span></div><div className={remaining < 60 ? "attempt-timer urgent" : "attempt-timer"} aria-live="polite"><Clock3 size={17}/>{formatTime(remaining)}</div></header>
    <div className="attempt-progress"><span>Question {index + 1} of {questions.length}</span><span>{answered.size} answered</span><div className="readiness-track"><span style={{ width: `${((index + 1) / Math.max(questions.length, 1)) * 100}%` }}/></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <article className="question-card"><div className="question-meta"><span>{question.skillName}</span><span>{question.difficulty?.toLowerCase()}</span></div><h1>{question.questionText}</h1><fieldset className="option-list"><legend className="sr-only">Choose an answer</legend>{question.options.map((option, optionIndex) => <label className={question.selectedOptionId === option.optionId ? "answer-option selected" : "answer-option"} key={option.optionId}><input type="radio" name={`question-${question.questionId}`} checked={question.selectedOptionId === option.optionId} disabled={saving} onChange={() => choose(option.optionId)}/><span className="option-marker">{String.fromCharCode(65 + optionIndex)}</span><span>{option.optionText}</span></label>)}</fieldset>{saving && <p className="muted" role="status">Saving answer…</p>}</article>
    <footer className="attempt-footer"><button className="button button-quiet" disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))}><ArrowLeft size={16}/> Previous</button>{index < questions.length - 1 ? <button className="button button-primary" onClick={() => setIndex((value) => Math.min(questions.length - 1, value + 1))}>Next question <ArrowRight size={16}/></button> : <button className="button button-primary" disabled={submitting || saving} onClick={submit}>{submitting ? "Submitting…" : <><Check size={16}/> Submit assessment</>}</button>}</footer>
  </section>;
}
