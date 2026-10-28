import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Search, Target } from "lucide-react";
import api from "../lib/api.js";

const label = (value = "") => value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function CareerCatalogPage() {
  const [careers, setCareers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [profile, setProfile] = useState(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeCareer, setActiveCareer] = useState(null);
  const [skills, setSkills] = useState([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillsError, setSkillsError] = useState("");
  const [savingCareerId, setSavingCareerId] = useState(null);
  const requestSequence = useRef(0);

  useEffect(() => {
    let active = true;
    Promise.all([api.get("/careers"), api.get("/students/me"), api.get("/meta/catalog")])
      .then(([careerData, student, catalog]) => {
        if (!active) return;
        setCareers(Array.isArray(careerData) ? careerData : []);
        setProfile(student || null);
        setCategories(catalog?.careerCategories || []);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || "Could not load the career catalog.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visibleCareers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return careers.filter((career) => {
      if (category !== "ALL" && career.category !== category) return false;
      return !query || career.name?.toLowerCase().includes(query) || career.description?.toLowerCase().includes(query);
    });
  }, [careers, search, category]);

  const openCareer = async (career) => {
    const sequence = ++requestSequence.current;
    setActiveCareer(career);
    setSkills([]);
    setSkillsError("");
    setSkillsLoading(true);
    try {
      const result = await api.get(`/careers/${career.id}/skills`);
      if (sequence === requestSequence.current) setSkills(Array.isArray(result) ? result : []);
    } catch (requestError) {
      if (sequence === requestSequence.current) setSkillsError(requestError.message || "Could not load required skills.");
    } finally {
      if (sequence === requestSequence.current) setSkillsLoading(false);
    }
  };

  const chooseCareer = async (career) => {
    if (savingCareerId !== null || profile?.targetCareerId === career.id) return;
    setSavingCareerId(career.id);
    setError("");
    try {
      const updated = await api.put("/students/me/career", { careerId: career.id });
      setProfile(updated);
    } catch (requestError) {
      setError(requestError.message || "Could not update your target career.");
    } finally {
      setSavingCareerId(null);
    }
  };

  if (loading) return <section className="page-card" role="status">Loading careers…</section>;
  if (error && careers.length === 0) return <section className="page-card"><h1>Career catalog unavailable</h1><p role="alert">{error}</p><button className="button button-quiet" onClick={() => window.location.reload()}>Try again</button></section>;

  return <div className="career-page">
    <header className="career-heading"><div><p className="eyebrow">EXPLORE YOUR OPTIONS</p><h1>Career paths</h1><p className="muted">Browse career tracks and choose one to focus your readiness plan.</p></div>
      {profile?.targetCareerName && <div className="target-summary"><Target size={18} aria-hidden="true"/><span><small>YOUR TARGET</small><strong>{profile.targetCareerName}</strong></span></div>}
    </header>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="career-filters"><label className="search-field"><Search size={17} aria-hidden="true"/><span className="sr-only">Search careers</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search careers" /></label>
      <label className="category-field"><span className="sr-only">Filter by category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="ALL">All categories</option>{categories.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></label>
    </div>
    {visibleCareers.length === 0 ? <section className="page-card"><h2>No careers match</h2><p>Try another search or select a different category.</p></section> :
      <div className="career-grid">{visibleCareers.map((career) => {
        const isTarget = profile?.targetCareerId === career.id;
        const isActive = activeCareer?.id === career.id;
        return <article className={isActive ? "career-card selected" : "career-card"} key={career.id}>
          <div className="career-card-top"><span className="career-icon"><BookOpen size={18} aria-hidden="true"/></span><span className="career-level">{label(career.difficultyLevel)}</span></div>
          <span className="career-category">{label(career.category)}</span><h2>{career.name}</h2><p className="career-description">{career.description || "Explore the skills and competencies for this career path."}</p>
          <p className="career-skill-count">{career.skillCount} {career.skillCount === 1 ? "required skill" : "required skills"}</p>
          <div className="career-card-actions"><button className="button button-quiet" type="button" aria-expanded={isActive} onClick={() => isActive ? (requestSequence.current += 1, setActiveCareer(null)) : openCareer(career)}>{isActive ? "Hide details" : "View skills"}</button><button className={isTarget ? "button button-selected" : "button button-primary"} type="button" disabled={isTarget || savingCareerId !== null} onClick={() => chooseCareer(career)}>{savingCareerId === career.id ? "Saving…" : isTarget ? "Current target" : "Choose career"}</button></div>
          {isActive && <div className="career-skill-panel"><h3>Required skills</h3>{skillsLoading ? <p className="muted">Loading skills…</p> : skillsError ? <p className="form-error" role="alert">{skillsError}</p> : skills.length === 0 ? <p className="muted">No skill requirements are listed yet.</p> : <ul>{skills.map((skill) => <li key={skill.skillId}><span><strong>{skill.skillName}</strong><small>{label(skill.skillCategory)} · {label(skill.requiredLevel)}</small></span><span className="skill-weight">{skill.weightPercent}%</span></li>)}</ul>}</div>}
        </article>;
      })}</div>}
  </div>;
}
