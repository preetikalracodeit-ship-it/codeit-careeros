import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";

const statusLabel = { NOT_STARTED: "Not started", IN_PROGRESS: "In progress", COMPLETED: "Completed" };

export function StudentProjectsPage() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setResult(await api.get("/projects/recommended")); }
    catch (reason) { setError(reason.message || "Unable to load your project recommendations."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function changeStatus(project, status) {
    setSaving(project.projectId);
    setError("");
    try { await api.put(`/projects/${project.projectId}/status`, { status }); await load(); }
    catch (reason) { setError(reason.message || "Unable to update project progress."); }
    finally { setSaving(null); }
  }

  if (loading) return <main className="workspace-page"><div className="notice-card" role="status">Loading recommended projects…</div></main>;
  if (error && !result) return <main className="workspace-page"><header className="workspace-heading"><div><span className="eyebrow">BUILD YOUR PORTFOLIO</span><h1>Couldn’t load projects</h1><p className="muted">{error}</p></div></header><button className="secondary-button" onClick={load}>Try again</button></main>;

  const projects = result?.projects || [];
  return <main className="workspace-page projects-page">
    <header className="workspace-heading"><div><span className="eyebrow">BUILD YOUR PORTFOLIO</span><h1>Recommended projects</h1><p className="muted">{result?.hasTarget ? `Practice the skills that matter for ${result.careerName}.` : "Choose a target career to see projects tailored to your goals."}</p></div>{result?.hasTarget && <span className="progress-level-badge">{result.completedProjects} of {result.totalProjects} completed</span>}</header>
    {error && <div className="roadmap-error success-banner" role="alert">{error}</div>}
    {!result?.hasTarget ? <section className="dashboard-next"><div><span className="eyebrow">START HERE</span><h2>No target career yet</h2><p>Project suggestions use the skills and goals for your target career.</p></div><Link className="primary-button" to="/student/careers">Choose career</Link></section> : projects.length === 0 ? <section className="dashboard-empty"><h2>No projects published yet</h2><p>Your target career does not have recommended projects yet.</p></section> : <>
      <section className="roadmap-overview"><div><span>Project progress</span><strong>{result.completedProjects} <small>of {result.totalProjects} completed</small></strong><div className="readiness-bar"><span style={{ width: `${result.totalProjects ? Math.round(result.completedProjects * 100 / result.totalProjects) : 0}%` }} /></div></div><div className="roadmap-overview-stat"><span>In progress</span><strong>{result.inProgressProjects}</strong></div><div className="roadmap-overview-stat"><span>Suggested</span><strong>{result.totalProjects}</strong></div></section>
      <div className="project-cards">{projects.map((project, index) => <article className="project-card" key={project.projectId}>
        <div className="project-card-top"><span className="roadmap-phase-number">{index + 1}</span><span className={`roadmap-status roadmap-status-${project.status.toLowerCase()}`}>{statusLabel[project.status] || project.status}</span></div>
        <div className="project-card-heading"><div><span className="eyebrow">{project.difficulty.replaceAll("_", " ")}{project.estimatedWeeks ? ` · ${project.estimatedWeeks} WEEKS` : ""}</span><h2>{project.title}</h2></div></div>
        {project.description && <p className="project-description">{project.description}</p>}
        {project.skills.length > 0 && <section className="project-skills"><h3>Skills you’ll practice</h3><div>{project.skills.map((skill) => <span className="project-skill" key={skill.skillId}><strong>{skill.skillName}</strong>{skill.targetPercent != null && <small>Target {skill.targetPercent}%{skill.assessed ? ` · You ${skill.scorePercent}%` : " · Not assessed"}</small>}{skill.assessed && skill.gapPercent != null && <small className={skill.gapPercent >= 0 ? "project-gap-met" : "project-gap-open"}>{skill.gapPercent >= 0 ? "Target met" : `${Math.abs(skill.gapPercent)} points to target`}</small>}</span>)}</div></section>}
        <div className="project-card-actions">{project.status === "NOT_STARTED" && <button className="primary-button" disabled={saving === project.projectId} onClick={() => changeStatus(project, "IN_PROGRESS")}>{saving === project.projectId ? "Saving…" : "Start project"}</button>}{project.status === "IN_PROGRESS" && <><button className="primary-button" disabled={saving === project.projectId} onClick={() => changeStatus(project, "COMPLETED")}>{saving === project.projectId ? "Saving…" : "Mark complete"}</button><button className="text-button" disabled={saving === project.projectId} onClick={() => changeStatus(project, "NOT_STARTED")}>Reset</button></>}{project.status === "COMPLETED" && <button className="secondary-button" disabled={saving === project.projectId} onClick={() => changeStatus(project, "IN_PROGRESS")}>{saving === project.projectId ? "Saving…" : "Reopen project"}</button>}</div>
      </article>)}</div>
    </>}
  </main>;
}
