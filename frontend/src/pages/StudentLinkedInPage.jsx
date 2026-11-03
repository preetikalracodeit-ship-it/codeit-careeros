import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api.js";

const blank = { profileUrl: "", headline: "", about: "", currentRole: "", experienceText: "", skillsText: "", educationText: "" };

export function StudentLinkedInPage() {
  const [form, setForm] = useState(blank);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [profile, snapshot] = await Promise.all([api.get("/linkedin/me"), api.get("/linkedin/analysis")]);
      setForm({ ...blank, ...(profile || {}) });
      setAnalysis(snapshot);
    } catch (reason) { setError(reason.message || "Unable to load your LinkedIn profile."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api.put("/linkedin", form);
      setMessage("Your LinkedIn profile details are saved.");
      const snapshot = await api.get("/linkedin/analysis");
      setAnalysis(snapshot);
    } catch (reason) { setError(reason.message || "Unable to save your profile."); }
    finally { setSaving(false); }
  }

  function update(field, value) { setForm((current) => ({ ...current, [field]: value })); }

  if (loading) return <main className="workspace-page"><div className="notice-card" role="status">Loading your LinkedIn profile…</div></main>;
  return <main className="workspace-page linkedin-page">
    <header className="workspace-heading"><div><span className="eyebrow">PROFILE PRESENCE</span><h1>LinkedIn profile</h1><p className="muted">Add your public profile link and paste the sections you want to review. Nothing is fetched from LinkedIn.</p></div>{analysis?.hasProfile && <span className="progress-level-badge">{analysis.completenessPercent}% complete</span>}</header>
    {error && <div className="roadmap-error success-banner" role="alert">{error}</div>}{message && <div className="success-banner" role="status">{message}</div>}
    <form className="linkedin-form settings-card" onSubmit={save}>
      <div className="settings-section-heading"><span className="settings-icon">in</span><div><h2>Your profile details</h2><p>Paste text from your own profile for skill matching and profile guidance.</p></div></div>
      <label className="profile-field">LinkedIn profile URL<input type="url" required maxLength={500} value={form.profileUrl} onChange={(event) => update("profileUrl", event.target.value)} placeholder="https://www.linkedin.com/in/your-name" /></label>
      <label className="profile-field">Headline<input maxLength={220} value={form.headline || ""} onChange={(event) => update("headline", event.target.value)} placeholder="Target role and key strengths" /></label>
      <label className="profile-field">About<textarea maxLength={3000} rows={5} value={form.about || ""} onChange={(event) => update("about", event.target.value)} placeholder="A short introduction, what you build, and what you want next" /></label>
      <label className="profile-field">Current role<input maxLength={180} value={form.currentRole || ""} onChange={(event) => update("currentRole", event.target.value)} placeholder="Student, developer, analyst…" /></label>
      <label className="profile-field">Experience<textarea maxLength={5000} rows={5} value={form.experienceText || ""} onChange={(event) => update("experienceText", event.target.value)} placeholder="Paste your roles, projects, and impact" /></label>
      <label className="profile-field">Skills<textarea maxLength={2000} rows={3} value={form.skillsText || ""} onChange={(event) => update("skillsText", event.target.value)} placeholder="List skills from your profile" /></label>
      <label className="profile-field">Education<textarea maxLength={2000} rows={3} value={form.educationText || ""} onChange={(event) => update("educationText", event.target.value)} placeholder="Degrees, institutions, and dates" /></label>
      <div className="linkedin-form-actions"><button className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save and analyze"}</button><span>Student-supplied profile data only. CareerOS does not scrape LinkedIn.</span></div>
    </form>
    {analysis?.hasProfile && <section className="linkedin-analysis settings-card"><div className="settings-section-heading"><span className="settings-icon">◎</span><div><h2>Profile analysis</h2><p>{analysis.hasTarget ? `Compared with the ${analysis.careerName} skill framework.` : "Choose a target career to compare your profile with a career skill framework."}</p></div></div>
      <div className="linkedin-score-grid"><article><span>Career skill alignment</span><strong>{analysis.alignmentPercent}%</strong><small>{analysis.matchedSkills.length} matched · {analysis.missingSkills.length} missing</small></article><article><span>Profile completeness</span><strong>{analysis.completenessPercent}%</strong><small>{analysis.detectedSkills.length} skills detected</small></article></div>
      {analysis.detectedSkills.length > 0 && <div className="linkedin-skill-group"><h3>Detected skills</h3><div>{analysis.detectedSkills.map((skill) => <span key={skill.skillId}>{skill.skillName}</span>)}</div></div>}
      <div className="linkedin-analysis-columns"><div><h3>What’s working</h3>{analysis.strengths.length ? <ul>{analysis.strengths.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Add profile details to get tailored feedback.</p>}</div><div><h3>Next improvements</h3>{analysis.suggestions.length ? <ul>{analysis.suggestions.map((item) => <li key={item}>{item}</li>)}</ul> : <p>Your profile meets the current checks.</p>}</div></div>
      {analysis.hasTarget && analysis.missingSkills.length > 0 && <div className="linkedin-skill-group"><h3>Skills to add or demonstrate</h3><div>{analysis.missingSkills.map((skill) => <span key={skill.skillId}>{skill.skillName} · target {skill.targetPercent}%</span>)}</div></div>}
    </section>}
  </main>;
}
