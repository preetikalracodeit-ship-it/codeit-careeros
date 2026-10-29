import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";

const statusLabel = { NOT_STARTED: "Not started", IN_PROGRESS: "In progress", COMPLETED: "Completed" };

function guidance(item) {
  if (item.status === "COMPLETED") return "You completed this step. Reopen it whenever you want another pass.";
  if (!item.skillId) return "A general milestone in your career journey.";
  if (!item.assessed) return "Take a skill assessment to see how this step fits your current level.";
  if (item.gapPercent < 0) return `Your score is ${Math.abs(item.gapPercent)} points below the ${item.targetPercent}% target.`;
  return `Your ${item.skillName} score currently meets the ${item.targetPercent}% target.`;
}

export function StudentRoadmapPage() {
  const [roadmap, setRoadmap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setRoadmap(await api.get("/roadmaps/my")); }
    catch (reason) { setError(reason.message || "Unable to load your roadmap."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function changeStatus(item, status) {
    setSaving(item.itemId);
    setError("");
    try {
      await api.put(`/roadmaps/items/${item.itemId}/status`, { status });
      await load();
    } catch (reason) { setError(reason.message || "Unable to update this step."); }
    finally { setSaving(null); }
  }

  if (loading) return <main className="workspace-page"><div className="notice-card" role="status">Loading your roadmap…</div></main>;
  if (error && !roadmap) return <main className="workspace-page"><header className="workspace-heading"><div><span className="eyebrow">YOUR JOURNEY</span><h1>Couldn’t load your roadmap</h1><p className="muted">{error}</p></div></header><button className="secondary-button" onClick={load}>Try again</button></main>;

  const phases = roadmap?.phases || [];
  return <main className="workspace-page roadmap-page">
    <header className="workspace-heading"><div><span className="eyebrow">YOUR JOURNEY</span><h1>Career roadmap</h1><p className="muted">{roadmap?.hasTarget ? `A practical path toward ${roadmap.careerName}. Work through each phase at your own pace.` : "Choose a target career to get a personal learning path."}</p></div>{roadmap?.hasTarget && <span className="progress-level-badge">{roadmap.progressPercent}% complete</span>}</header>
    {error && <div className="success-banner roadmap-error" role="alert">{error}</div>}
    {!roadmap?.hasTarget ? <section className="dashboard-next"><div><span className="eyebrow">START HERE</span><h2>No target career yet</h2><p>Your roadmap is built from the phases and skills for a target career.</p></div><Link className="primary-button" to="/student/careers">Choose career</Link></section> : <>
      <section className="roadmap-overview"><div><span>Journey progress</span><strong>{roadmap.completedItems} <small>of {roadmap.totalItems} steps</small></strong><div className="readiness-bar"><span style={{ width: `${Math.min(100, roadmap.progressPercent || 0)}%` }} /></div></div><div className="roadmap-overview-stat"><span>In progress</span><strong>{roadmap.inProgressItems}</strong></div><div className="roadmap-overview-stat"><span>Phases</span><strong>{phases.length}</strong></div></section>
      {phases.length === 0 ? <section className="dashboard-empty"><h2>No roadmap published yet</h2><p>Your target career does not have any roadmap phases yet.</p></section> : <div className="roadmap-phases">{phases.map((phase, index) => <section className="roadmap-phase" key={phase.phaseId}>
        <header className="roadmap-phase-heading"><span className="roadmap-phase-number">{index + 1}</span><div><span className="eyebrow">PHASE {index + 1}{phase.durationDays ? ` · ${phase.durationDays} DAYS` : ""}</span><h2>{phase.title}</h2>{phase.description && <p>{phase.description}</p>}</div><span className="roadmap-phase-count">{phase.completedItems}/{phase.totalItems} done</span></header>
        <div className="roadmap-items">{phase.items.map((item) => <article className={`roadmap-item roadmap-item-${item.status.toLowerCase()}`} key={item.itemId}>
          <div className="roadmap-item-marker" aria-hidden="true">{item.status === "COMPLETED" ? "✓" : item.displayOrder + 1}</div>
          <div className="roadmap-item-content"><div className="roadmap-item-title"><h3>{item.title}</h3><span className={`roadmap-status roadmap-status-${item.status.toLowerCase()}`}>{statusLabel[item.status] || item.status}</span></div>
            {item.description && <p>{item.description}</p>}{item.learningGoal && <p className="roadmap-learning-goal"><strong>Learning goal:</strong> {item.learningGoal}</p>}
            <div className="roadmap-item-meta">{item.estimatedHours > 0 && <span>◷ {item.estimatedHours} hours</span>}{item.skillName && <span>{item.skillName}{item.skillCategory ? ` · ${item.skillCategory}` : ""}</span>}{item.targetPercent != null && <span>Target {item.targetPercent}%{item.assessed ? ` · Current ${item.scorePercent}%` : " · Not assessed"}</span>}</div>
            <p className="roadmap-guidance">{guidance(item)}</p>
          </div>
          <div className="roadmap-actions"><button className="secondary-button roadmap-action" disabled={saving === item.itemId} onClick={() => changeStatus(item, item.status === "NOT_STARTED" ? "IN_PROGRESS" : item.status === "IN_PROGRESS" ? "COMPLETED" : "IN_PROGRESS")}>{saving === item.itemId ? "Saving…" : item.status === "NOT_STARTED" ? "Start step" : item.status === "IN_PROGRESS" ? "Mark complete" : "Reopen"}</button>{item.status === "IN_PROGRESS" && <button className="text-button roadmap-reset" disabled={saving === item.itemId} onClick={() => changeStatus(item, "NOT_STARTED")}>Reset</button>}</div>
        </article>)}</div>
      </section>)}</div>}
    </>}
  </main>;
}
