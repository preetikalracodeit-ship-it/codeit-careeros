import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../lib/api.js";

export function StudentCareersPage() {
  const [careers, setCareers] = useState([]);
  const [profile, setProfile] = useState(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([api.get("/careers"), api.get("/students/me")])
      .then(([catalog, student]) => {
        if (!active) return;
        setCareers(Array.isArray(catalog) ? catalog : []);
        setProfile(student || null);
      })
      .catch((reason) => {
        if (active) setError(reason.message || "Unable to load careers right now.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const categories = useMemo(() => [...new Set(careers.map((career) => career.category).filter(Boolean))].sort(), [careers]);
  const filteredCareers = useMemo(() => {
    const term = query.trim().toLowerCase();
    return careers.filter((career) => {
      if (category !== "ALL" && career.category !== category) return false;
      return !term || `${career.name} ${career.description || ""}`.toLowerCase().includes(term);
    });
  }, [careers, query, category]);

  async function chooseCareer(career) {
    setSavingId(career.id);
    try {
      const updated = await api.put("/students/me/career", { careerId: career.id });
      setProfile(updated || { ...profile, targetCareerId: career.id, targetCareerName: career.name });
      toast.success(`${career.name} is now your target career.`);
    } catch (reason) {
      toast.error(reason.message || "Could not update your target career.");
    } finally {
      setSavingId(null);
    }
  }

  return <main className="workspace-page">
    <div className="workspace-heading">
      <div><span className="eyebrow">CAREER EXPLORER</span><h1>Choose a direction that fits you.</h1><p className="muted">Compare career paths and set a target. CareerOS will use it to shape your skill assessment and next steps.</p></div>
      <Link className="secondary-button" to="/student/dashboard">Back to dashboard</Link>
    </div>
    {profile?.targetCareerName && <section className="target-banner"><span><strong>Your current target</strong><br />{profile.targetCareerName}</span><span className="target-check" aria-label="Selected">✓</span></section>}
    <section className="career-controls" aria-label="Filter careers">
      <label className="search-field">Search careers<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try software, design, data…" /></label>
      <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="ALL">All categories</option>{categories.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></label>
    </section>
    {loading && <div className="notice-card" role="status">Loading the published career catalog…</div>}
    {!loading && error && <div className="error-banner" role="alert">{error}<button className="text-button" onClick={() => window.location.reload()}>Try again</button></div>}
    {!loading && !error && filteredCareers.length === 0 && <div className="notice-card">No careers match those filters. Try another search or category.</div>}
    <section className="career-grid" aria-label="Published careers">
      {filteredCareers.map((career) => {
        const selected = String(profile?.targetCareerId) === String(career.id);
        return <article className={`career-card${selected ? " career-card-selected" : ""}`} key={career.id}>
          <div className="career-card-meta"><span className="category-pill">{(career.category || "CAREER").replaceAll("_", " ")}</span><span>{career.skillCount ?? 0} skills</span></div>
          <h2>{career.name}</h2><p>{career.description || "Build a focused skill profile and track your readiness for this path."}</p>
          <div className="career-card-footer"><span className="difficulty">{career.difficultyLevel ? career.difficultyLevel.replaceAll("_", " ").toLowerCase() : "Career path"}</span><button className={selected ? "selected-button" : "primary-button"} disabled={selected || savingId !== null} onClick={() => chooseCareer(career)}>{savingId === career.id ? "Saving…" : selected ? "Current target" : "Set as target"}</button></div>
        </article>;
      })}
    </section>
  </main>;
}
