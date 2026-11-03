import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../../lib/api.js";
import { Badge, DataTable, EmptyState, ErrorBlock, LoadingBlock, PageHeader, Panel, StatCard } from "../../components/ui.jsx";
import { Icon } from "../../components/Icon.jsx";
import { Modal, formatDate } from "./shared.jsx";

function prettify(value) {
  if (!value) return "Not set";
  return String(value).toLowerCase().split("_").map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join(" ");
}

function ConfirmModal({ title, description, confirmLabel, busy, onConfirm, onClose }) {
  return (
    <Modal title={title} description={description} onClose={onClose}>
      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
        <button type="button" className="danger-button" disabled={busy} onClick={onConfirm}>{busy ? "Working…" : confirmLabel}</button>
      </div>
    </Modal>
  );
}

function useCatalog() {
  const [catalog, setCatalog] = useState(null);
  const [catalogError, setCatalogError] = useState("");
  useEffect(() => {
    api.get("/meta/catalog")
      .then(setCatalog)
      .catch((reason) => setCatalogError(reason.message || "Could not load catalog options."));
  }, []);
  return { catalog, catalogError };
}

export function AdminSkillsPage() {
  const { catalog, catalogError } = useCatalog();
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setSkills(await api.get("/admin/skills"));
    } catch (reason) {
      setError(reason.message || "Could not load the skill catalog.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return skills.filter((skill) => {
      if (categoryFilter !== "ALL" && skill.category !== categoryFilter) return false;
      if (!term) return true;
      return `${skill.name} ${skill.description || ""}`.toLowerCase().includes(term);
    });
  }, [skills, search, categoryFilter]);

  function openCreate() {
    setForm({ id: null, name: "", category: "", description: "", active: true });
  }
  function openEdit(skill) {
    setForm({ id: skill.id, name: skill.name, category: skill.category, description: skill.description || "", active: skill.active !== false });
  }
  function patch(value) {
    setForm((current) => ({ ...current, ...value }));
  }

  async function save(event) {
    event.preventDefault();
    if (!form.name.trim() || !form.category) {
      toast.error("A skill needs a name and a category.");
      return;
    }
    setBusy(true);
    try {
      const body = { name: form.name.trim(), category: form.category, description: form.description.trim() || null, active: form.active };
      if (form.id) await api.put(`/admin/skills/${form.id}`, body);
      else await api.post("/admin/skills", body);
      toast.success(form.id ? "Skill updated." : "Skill created.");
      setForm(null);
      await load();
    } catch (reason) {
      toast.error(reason.message || "Could not save the skill.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.delete(`/admin/skills/${deleteTarget.id}`);
      toast.success(`Skill “${deleteTarget.name}” deleted.`);
      setDeleteTarget(null);
      await load();
    } catch (reason) {
      toast.error(reason.message || "Could not delete the skill.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingBlock label="Loading skill catalog…" />;
  if (error) return <div className="workspace-page-content"><PageHeader eyebrow="MASTER DATA" title="Skills" description="Maintain the skill catalog." /><ErrorBlock message={error} onRetry={load} /></div>;

  const categories = catalog?.skillCategories || [];
  return (
    <div className="workspace-page-content">
      <PageHeader
        eyebrow="MASTER DATA"
        title="Skills"
        description="Maintain the skill catalog that powers career mappings and assessments."
        actions={<button type="button" className="primary-button" onClick={openCreate}>Add skill</button>}
      />
      <div className="stat-grid stat-grid-3">
        <StatCard label="Skills" value={skills.length} hint="Across all categories" icon="chart" />
        <StatCard label="Active" value={skills.filter((skill) => skill.active !== false).length} hint="Visible to students" icon="check" />
        <StatCard label="Categories" value={new Set(skills.map((skill) => skill.category)).size} hint="Distinct skill groups" icon="layers" />
      </div>
      {catalogError && <div className="success-banner roadmap-error" role="alert"><span>{catalogError}</span></div>}
      <Panel
        title="Skill catalog"
        description="Search, filter and edit skills used across the platform."
        actions={
          <div className="button-row">
            <input className="search-input" placeholder="Search skills…" value={search} onChange={(event) => setSearch(event.target.value)} />
            <select className="inline-select" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="ALL">All categories</option>
              {categories.map((category) => <option key={category} value={category}>{prettify(category)}</option>)}
            </select>
          </div>
        }
      >
        <DataTable
          empty="No skills match this filter"
          rows={filtered}
          getKey={(skill) => skill.id}
          columns={[
            { key: "name", label: "Skill", render: (skill) => <div><strong>{skill.name}</strong><p className="muted">{skill.description || "No description"}</p></div> },
            { key: "category", label: "Category", render: (skill) => <Badge tone="info">{prettify(skill.category)}</Badge> },
            { key: "active", label: "Status", render: (skill) => <Badge tone={skill.active ? "positive" : "muted"}>{skill.active ? "Active" : "Inactive"}</Badge> },
            {
              key: "actions",
              label: "",
              render: (skill) => (
                <div className="button-row">
                  <button type="button" className="link-button" onClick={() => openEdit(skill)}>Edit</button>
                  <button type="button" className="link-button danger-link" onClick={() => setDeleteTarget(skill)}>Delete</button>
                </div>
              ),
            },
          ]}
        />
      </Panel>

      {form && (
        <Modal title={form.id ? "Edit skill" : "Add skill"} description="Skills are shared across every career framework and assessment." onClose={() => setForm(null)}>
          <form className="stack-form" onSubmit={save}>
            <label className="form-field">Skill name
              <input required maxLength={120} value={form.name} onChange={(event) => patch({ name: event.target.value })} />
            </label>
            <div className="form-grid">
              <label className="form-field">Category
                <select required value={form.category} onChange={(event) => patch({ category: event.target.value })}>
                  <option value="">Select category</option>
                  {categories.map((category) => <option key={category} value={category}>{prettify(category)}</option>)}
                </select>
              </label>
              <label className="form-field">Status
                <select value={form.active ? "ACTIVE" : "INACTIVE"} onChange={(event) => patch({ active: event.target.value === "ACTIVE" })}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </label>
            </div>
            <label className="form-field">Description
              <textarea maxLength={300} value={form.description} onChange={(event) => patch({ description: event.target.value })} />
            </label>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setForm(null)}>Cancel</button>
              <button type="submit" className="primary-button" disabled={busy}>{busy ? "Saving…" : form.id ? "Save skill" : "Create skill"}</button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmModal
          title={`Delete ${deleteTarget.name}?`}
          description="This removes the skill from the catalog. Careers and assessments that reference it may need attention."
          confirmLabel="Delete skill"
          busy={busy}
          onConfirm={remove}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

export function AdminCareersPage() {
  const { catalog } = useCatalog();
  const [careers, setCareers] = useState([]);
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(null);
  const [framework, setFramework] = useState(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [careerData, skillData] = await Promise.all([api.get("/admin/careers"), api.get("/admin/skills")]);
      setCareers(careerData || []);
      setSkills(skillData || []);
    } catch (reason) {
      setError(reason.message || "Could not load careers.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return careers.filter((career) => !term || `${career.name} ${career.category} ${career.description || ""}`.toLowerCase().includes(term));
  }, [careers, search]);

  function openCreate() {
    setForm({ id: null, name: "", description: "", category: "", difficultyLevel: "INTERMEDIATE", published: true });
  }
  function openEdit(career) {
    setForm({
      id: career.id,
      name: career.name,
      description: career.description || "",
      category: career.category,
      difficultyLevel: career.difficultyLevel,
      published: career.published !== false,
    });
  }
  function patch(value) {
    setForm((current) => ({ ...current, ...value }));
  }

  async function save(event) {
    event.preventDefault();
    if (!form.name.trim() || !form.category) {
      toast.error("A career needs a name and a category.");
      return;
    }
    setBusy(true);
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        category: form.category,
        difficultyLevel: form.difficultyLevel,
        published: form.published,
      };
      if (form.id) await api.put(`/admin/careers/${form.id}`, body);
      else await api.post("/admin/careers", body);
      toast.success(form.id ? "Career updated." : "Career created.");
      setForm(null);
      await load();
      if (form.id) {
        setForm(null);
      }
    } catch (reason) {
      toast.error(reason.message || "Could not save the career.");
    } finally {
      setBusy(false);
    }
  }

  async function openFramework(career) {
    setBusy(true);
    try {
      const detail = await api.get(`/admin/careers/${career.id}`);
      setFramework({
        career: detail,
        rows: (detail.skills || []).map((row) => ({
          skillId: String(row.skillId),
          weightPercent: String(row.weightPercent),
          requiredLevel: row.requiredLevel,
          targetPercent: String(row.targetPercent),
        })),
      });
    } catch (reason) {
      toast.error(reason.message || "Could not load the competency framework.");
    } finally {
      setBusy(false);
    }
  }

  function patchRow(index, value) {
    setFramework((current) => ({
      ...current,
      rows: current.rows.map((row, position) => position === index ? { ...row, ...value } : row),
    }));
  }

  const frameworkTotal = framework?.rows.reduce((sum, row) => sum + (Number(row.weightPercent) || 0), 0) || 0;

  async function saveFramework(event) {
    event.preventDefault();
    const rows = framework.rows.filter((row) => row.skillId);
    if (!rows.length) {
      toast.error("Add at least one skill to the framework.");
      return;
    }
    if (new Set(rows.map((row) => row.skillId)).size !== rows.length) {
      toast.error("Each skill can only appear once.");
      return;
    }
    if (frameworkTotal !== 100) {
      toast.error(`Skill weights must total 100% (currently ${frameworkTotal}%).`);
      return;
    }
    setBusy(true);
    try {
      await api.put(`/admin/careers/${framework.career.id}/skills`, rows.map((row) => ({
        skillId: Number(row.skillId),
        weightPercent: Number(row.weightPercent) || 0,
        requiredLevel: row.requiredLevel,
        targetPercent: row.targetPercent === "" ? undefined : Number(row.targetPercent),
      })));
      toast.success("Competency framework updated.");
      setFramework(null);
      await load();
    } catch (reason) {
      toast.error(reason.message || "Could not save the framework.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.delete(`/admin/careers/${deleteTarget.id}`);
      toast.success(`Career “${deleteTarget.name}” deleted.`);
      setDeleteTarget(null);
      await load();
    } catch (reason) {
      toast.error(reason.message || "Could not delete the career.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingBlock label="Loading careers…" />;
  if (error) return <div className="workspace-page-content"><PageHeader eyebrow="MASTER DATA" title="Career paths" description="Maintain career catalogues." /><ErrorBlock message={error} onRetry={load} /></div>;

  return (
    <div className="workspace-page-content">
      <PageHeader
        eyebrow="MASTER DATA"
        title="Career paths"
        description="Maintain career catalogues and the competency framework students are measured against."
        actions={<button type="button" className="primary-button" onClick={openCreate}>Add career</button>}
      />
      <div className="stat-grid stat-grid-3">
        <StatCard label="Careers" value={careers.length} hint="Published and draft paths" icon="target" />
        <StatCard label="Published" value={careers.filter((career) => career.published).length} hint="Visible to students" icon="check" />
        <StatCard label="Mapped skills" value={careers.reduce((sum, career) => sum + (career.skillCount || 0), 0)} hint="Across all frameworks" icon="layers" />
      </div>
      <Panel
        title="Career catalogue"
        description="Open a framework to tune weights, required levels and target scores."
        actions={<input className="search-input" placeholder="Search careers…" value={search} onChange={(event) => setSearch(event.target.value)} />}
      >
        <DataTable
          empty="No careers match this search"
          rows={filtered}
          getKey={(career) => career.id}
          columns={[
            { key: "name", label: "Career", render: (career) => <div><strong>{career.name}</strong><p className="muted">{career.description || "No description"}</p></div> },
            { key: "category", label: "Category", render: (career) => <Badge tone="info">{prettify(career.category)}</Badge> },
            { key: "difficulty", label: "Difficulty", render: (career) => prettify(career.difficultyLevel) },
            { key: "skills", label: "Skills", render: (career) => career.skillCount || 0 },
            { key: "published", label: "Status", render: (career) => <Badge tone={career.published ? "positive" : "muted"}>{career.published ? "Published" : "Draft"}</Badge> },
            {
              key: "actions",
              label: "",
              render: (career) => (
                <div className="button-row">
                  <button type="button" className="link-button" onClick={() => openFramework(career)}>Skills</button>
                  <button type="button" className="link-button" onClick={() => openEdit(career)}>Edit</button>
                  <button type="button" className="link-button danger-link" onClick={() => setDeleteTarget(career)}>Delete</button>
                </div>
              ),
            },
          ]}
        />
      </Panel>

      {form && (
        <Modal title={form.id ? "Edit career" : "Add career"} description="Career metadata appears in the student career catalogue." onClose={() => setForm(null)} wide>
          <form className="stack-form" onSubmit={save}>
            <label className="form-field">Career name
              <input required maxLength={140} value={form.name} onChange={(event) => patch({ name: event.target.value })} />
            </label>
            <label className="form-field">Description
              <textarea maxLength={1000} value={form.description} onChange={(event) => patch({ description: event.target.value })} />
            </label>
            <div className="form-grid">
              <label className="form-field">Category
                <select required value={form.category} onChange={(event) => patch({ category: event.target.value })}>
                  <option value="">Select category</option>
                  {(catalog?.careerCategories || []).map((category) => <option key={category} value={category}>{prettify(category)}</option>)}
                </select>
              </label>
              <label className="form-field">Difficulty
                <select value={form.difficultyLevel} onChange={(event) => patch({ difficultyLevel: event.target.value })}>
                  {(catalog?.difficultyLevels || []).map((level) => <option key={level} value={level}>{prettify(level)}</option>)}
                </select>
              </label>
            </div>
            <label className="form-field">Visibility
              <select value={form.published ? "PUBLISHED" : "DRAFT"} onChange={(event) => patch({ published: event.target.value === "PUBLISHED" })}>
                <option value="PUBLISHED">Published</option>
                <option value="DRAFT">Draft</option>
              </select>
            </label>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setForm(null)}>Cancel</button>
              <button type="submit" className="primary-button" disabled={busy}>{busy ? "Saving…" : form.id ? "Save career" : "Create career"}</button>
            </div>
          </form>
        </Modal>
      )}

      {framework && (
        <Modal
          title={`${framework.career.name} framework`}
          description={`Weights must total 100%. Current total: ${frameworkTotal}%.`}
          onClose={() => setFramework(null)}
          wide
        >
          <form className="stack-form" onSubmit={saveFramework}>
            <div className="stack-form">
              {framework.rows.map((row, index) => (
                <div className="form-grid" key={`${row.skillId}-${index}`}>
                  <label className="form-field">Skill
                    <select required value={row.skillId} onChange={(event) => patchRow(index, { skillId: event.target.value })}>
                      <option value="">Select skill</option>
                      {skills.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}
                    </select>
                  </label>
                  <label className="form-field">Weight %
                    <input type="number" min="0" max="100" required value={row.weightPercent} onChange={(event) => patchRow(index, { weightPercent: event.target.value })} />
                  </label>
                  <label className="form-field">Required level
                    <select value={row.requiredLevel} onChange={(event) => patchRow(index, { requiredLevel: event.target.value })}>
                      {(catalog?.skillLevels || []).map((level) => <option key={level} value={level}>{prettify(level)}</option>)}
                    </select>
                  </label>
                  <label className="form-field">Target %
                    <input type="number" min="1" max="100" value={row.targetPercent} onChange={(event) => patchRow(index, { targetPercent: event.target.value })} />
                  </label>
                  <button type="button" className="link-button danger-link" onClick={() => setFramework((current) => ({ ...current, rows: current.rows.filter((_, position) => position !== index) }))}>Remove</button>
                </div>
              ))}
            </div>
            <button type="button" className="secondary-button" onClick={() => setFramework((current) => ({ ...current, rows: [...current.rows, { skillId: "", weightPercent: "", requiredLevel: "BEGINNER", targetPercent: "80" }] }))}>Add skill row</button>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setFramework(null)}>Cancel</button>
              <button type="submit" className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save framework"}</button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmModal
          title={`Delete ${deleteTarget.name}?`}
          description="Students who selected this career will need to choose a new direction."
          confirmLabel="Delete career"
          busy={busy}
          onConfirm={remove}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

export function AdminAssessmentsPage() {
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState([]);
  const [careers, setCareers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [assessmentData, careerData] = await Promise.all([api.get("/admin/assessments"), api.get("/admin/careers")]);
      setAssessments(assessmentData || []);
      setCareers(careerData || []);
    } catch (reason) {
      setError(reason.message || "Could not load assessments.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return assessments.filter((assessment) => !term || `${assessment.title} ${assessment.careerName}`.toLowerCase().includes(term));
  }, [assessments, search]);

  function openCreate() {
    setForm({ id: null, careerId: careers[0] ? String(careers[0].id) : "", title: "", description: "", durationMinutes: "30", published: true });
  }
  function openEdit(assessment) {
    setForm({
      id: assessment.id,
      careerId: String(assessment.careerId),
      title: assessment.title,
      description: assessment.description || "",
      durationMinutes: String(assessment.durationMinutes),
      published: assessment.published !== false,
    });
  }
  function patch(value) {
    setForm((current) => ({ ...current, ...value }));
  }

  async function save(event) {
    event.preventDefault();
    if (!form.careerId || !form.title.trim()) {
      toast.error("Choose a career and enter an assessment title.");
      return;
    }
    setBusy(true);
    try {
      const body = {
        careerId: Number(form.careerId),
        title: form.title.trim(),
        description: form.description.trim() || null,
        durationMinutes: Number(form.durationMinutes) || 30,
        published: form.published,
      };
      if (form.id) await api.put(`/admin/assessments/${form.id}`, body);
      else await api.post("/admin/assessments", body);
      toast.success(form.id ? "Assessment updated." : "Assessment created.");
      setForm(null);
      await load();
    } catch (reason) {
      toast.error(reason.message || "Could not save the assessment.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.delete(`/admin/assessments/${deleteTarget.id}`);
      toast.success("Assessment deleted.");
      setDeleteTarget(null);
      await load();
    } catch (reason) {
      toast.error(reason.message || "Could not delete the assessment.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingBlock label="Loading assessments…" />;
  if (error) return <div className="workspace-page-content"><PageHeader eyebrow="MASTER DATA" title="Assessments" description="Maintain assessment tests." /><ErrorBlock message={error} onRetry={load} /></div>;

  return (
    <div className="workspace-page-content">
      <PageHeader
        eyebrow="MASTER DATA"
        title="Assessments"
        description="Career-aligned tests, durations and question banks students take from their workspace."
        actions={<button type="button" className="primary-button" onClick={openCreate} disabled={!careers.length}>Add assessment</button>}
      />
      <div className="stat-grid stat-grid-3">
        <StatCard label="Assessments" value={assessments.length} hint="One per career" icon="clipboard" />
        <StatCard label="Published" value={assessments.filter((assessment) => assessment.published).length} hint="Available to students" icon="check" />
        <StatCard label="Questions" value={assessments.reduce((sum, assessment) => sum + (assessment.questionCount || 0), 0)} hint="Active question bank size" icon="book" />
      </div>
      <Panel
        title="Assessment catalogue"
        description="Open an assessment to manage its question bank."
        actions={<input className="search-input" placeholder="Search assessments…" value={search} onChange={(event) => setSearch(event.target.value)} />}
      >
        <DataTable
          empty="No assessments match this search"
          rows={filtered}
          getKey={(assessment) => assessment.id}
          columns={[
            { key: "title", label: "Assessment", render: (assessment) => <div><strong>{assessment.title}</strong><p className="muted">{assessment.description || "No description"}</p></div> },
            { key: "career", label: "Career", render: (assessment) => assessment.careerName },
            { key: "duration", label: "Duration", render: (assessment) => `${assessment.durationMinutes} min` },
            { key: "questions", label: "Questions", render: (assessment) => assessment.questionCount || 0 },
            { key: "published", label: "Status", render: (assessment) => <Badge tone={assessment.published ? "positive" : "muted"}>{assessment.published ? "Published" : "Draft"}</Badge> },
            {
              key: "actions",
              label: "",
              render: (assessment) => (
                <div className="button-row">
                  <Link className="link-button" to={`/platform/assessments/${assessment.id}`}>Questions</Link>
                  <button type="button" className="link-button" onClick={() => openEdit(assessment)}>Edit</button>
                  <button type="button" className="link-button danger-link" onClick={() => setDeleteTarget(assessment)}>Delete</button>
                </div>
              ),
            },
          ]}
        />
      </Panel>

      {form && (
        <Modal title={form.id ? "Edit assessment" : "Add assessment"} description="Assessments are tied to one career and a question bank." onClose={() => setForm(null)} wide>
          <form className="stack-form" onSubmit={save}>
            <div className="form-grid">
              <label className="form-field">Career
                <select required value={form.careerId} onChange={(event) => patch({ careerId: event.target.value })}>
                  <option value="">Select career</option>
                  {careers.map((career) => <option key={career.id} value={career.id}>{career.name}</option>)}
                </select>
              </label>
              <label className="form-field">Duration (minutes)
                <input type="number" min="1" required value={form.durationMinutes} onChange={(event) => patch({ durationMinutes: event.target.value })} />
              </label>
            </div>
            <label className="form-field">Title
              <input required maxLength={150} value={form.title} onChange={(event) => patch({ title: event.target.value })} />
            </label>
            <label className="form-field">Description
              <textarea maxLength={500} value={form.description} onChange={(event) => patch({ description: event.target.value })} />
            </label>
            <label className="form-field">Visibility
              <select value={form.published ? "PUBLISHED" : "DRAFT"} onChange={(event) => patch({ published: event.target.value === "PUBLISHED" })}>
                <option value="PUBLISHED">Published</option>
                <option value="DRAFT">Draft</option>
              </select>
            </label>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setForm(null)}>Cancel</button>
              <button type="submit" className="primary-button" disabled={busy}>{busy ? "Saving…" : form.id ? "Save assessment" : "Create assessment"}</button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmModal
          title={`Delete ${deleteTarget.title}?`}
          description="The assessment and its questions will be removed. Existing submitted attempts are kept."
          confirmLabel="Delete assessment"
          busy={busy}
          onConfirm={remove}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

const EMPTY_OPTIONS = () => ([
  { optionText: "", correct: true },
  { optionText: "", correct: false },
  { optionText: "", correct: false },
  { optionText: "", correct: false },
]);

export function AdminAssessmentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { catalog } = useCatalog();
  const [assessment, setAssessment] = useState(null);
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [detail, skillData] = await Promise.all([
        api.get(`/admin/assessments/${id}`),
        api.get("/admin/skills"),
      ]);
      setAssessment(detail);
      setSkills(skillData || []);
    } catch (reason) {
      setError(reason.message || "Could not load the assessment.");
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setForm({
      id: null,
      skillId: skills[0] ? String(skills[0].id) : "",
      questionText: "",
      difficulty: "INTERMEDIATE",
      explanation: "",
      displayOrder: String((assessment?.questions?.length || 0) + 1),
      active: true,
      options: EMPTY_OPTIONS(),
    });
  }
  function openEdit(question) {
    setForm({
      id: question.id,
      skillId: String(question.skillId),
      questionText: question.questionText,
      difficulty: question.difficulty,
      explanation: question.explanation || "",
      displayOrder: String(question.displayOrder ?? ""),
      active: question.active !== false,
      options: question.options.map((option) => ({ optionText: option.optionText, correct: option.correct })),
    });
  }
  function patch(value) {
    setForm((current) => ({ ...current, ...value }));
  }
  function patchOption(index, value) {
    setForm((current) => ({
      ...current,
      options: current.options.map((option, position) => position === index ? { ...option, ...value } : option),
    }));
  }
  function markCorrect(index) {
    setForm((current) => ({
      ...current,
      options: current.options.map((option, position) => ({ ...option, correct: position === index })),
    }));
  }

  async function saveQuestion(event) {
    event.preventDefault();
    if (!form.skillId || !form.questionText.trim()) {
      toast.error("Choose a skill and enter the question text.");
      return;
    }
    if (form.options.filter((option) => option.correct).length !== 1) {
      toast.error("Mark exactly one option as correct.");
      return;
    }
    if (form.options.some((option) => !option.optionText.trim())) {
      toast.error("Every option needs text.");
      return;
    }
    setBusy(true);
    try {
      const body = {
        skillId: Number(form.skillId),
        questionText: form.questionText.trim(),
        difficulty: form.difficulty,
        questionType: "MCQ",
        explanation: form.explanation.trim() || null,
        displayOrder: form.displayOrder === "" ? null : Number(form.displayOrder),
        active: form.active,
        options: form.options.map((option, index) => ({ optionText: option.optionText.trim(), correct: option.correct, displayOrder: index + 1 })),
      };
      if (form.id) await api.put(`/admin/questions/${form.id}`, { ...body, assessmentId: Number(id) });
      else await api.post(`/admin/assessments/${id}/questions`, body);
      toast.success(form.id ? "Question updated." : "Question added.");
      setForm(null);
      await load();
    } catch (reason) {
      toast.error(reason.message || "Could not save the question.");
    } finally {
      setBusy(false);
    }
  }

  async function removeQuestion() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await api.delete(`/admin/questions/${deleteTarget.id}`);
      toast.success("Question deleted.");
      setDeleteTarget(null);
      await load();
    } catch (reason) {
      toast.error(reason.message || "Could not delete the question.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingBlock label="Loading question bank…" />;
  if (error) return <div className="workspace-page-content"><PageHeader eyebrow="MASTER DATA" title="Question bank" description="Manage assessment questions." /><ErrorBlock message={error} onRetry={load} /></div>;

  return (
    <div className="workspace-page-content">
      <PageHeader
        eyebrow="QUESTION BANK"
        title={assessment?.title || "Assessment"}
        description={`${assessment?.careerName || ""} · ${assessment?.durationMinutes || 0} minutes · ${assessment?.questions?.length || 0} questions`}
        actions={
          <div className="button-row">
            <button type="button" className="secondary-button" onClick={() => navigate("/platform/assessments")}>Back</button>
            <button type="button" className="primary-button" onClick={openCreate} disabled={!skills.length}>Add question</button>
          </div>
        }
      />
      {assessment?.questions?.length ? (
        <div className="stack-form">
          {assessment.questions.map((question, index) => (
            <Panel
              key={question.id}
              title={`Q${index + 1}. ${question.questionText}`}
              description={`${question.skillName} · ${prettify(question.difficulty)}${question.active === false ? " · inactive" : ""}`}
              actions={
                <div className="button-row">
                  <button type="button" className="link-button" onClick={() => openEdit(question)}>Edit</button>
                  <button type="button" className="link-button danger-link" onClick={() => setDeleteTarget(question)}>Delete</button>
                </div>
              }
            >
              <ul className="cv-check-list">
                {question.options.map((option) => (
                  <li key={option.id} className={option.correct ? "" : "muted"}>
                    {option.correct ? <Icon name="check" size={14} /> : <span className="option-dot" />} {option.optionText}
                  </li>
                ))}
              </ul>
              {question.explanation && <p className="muted">{question.explanation}</p>}
            </Panel>
          ))}
        </div>
      ) : (
        <EmptyState title="No questions yet" description="Add the first multiple-choice question to this assessment." action={<button type="button" className="primary-button" onClick={openCreate} disabled={!skills.length}>Add question</button>} icon="book" />
      )}

      {form && (
        <Modal title={form.id ? "Edit question" : "Add question"} description="Exactly one option must be marked correct." onClose={() => setForm(null)} wide>
          <form className="stack-form" onSubmit={saveQuestion}>
            <label className="form-field">Question
              <textarea required maxLength={1000} value={form.questionText} onChange={(event) => patch({ questionText: event.target.value })} />
            </label>
            <div className="form-grid-3">
              <label className="form-field">Skill
                <select required value={form.skillId} onChange={(event) => patch({ skillId: event.target.value })}>
                  <option value="">Select skill</option>
                  {skills.map((skill) => <option key={skill.id} value={skill.id}>{skill.name}</option>)}
                </select>
              </label>
              <label className="form-field">Difficulty
                <select value={form.difficulty} onChange={(event) => patch({ difficulty: event.target.value })}>
                  {(catalog?.difficultyLevels || []).map((level) => <option key={level} value={level}>{prettify(level)}</option>)}
                </select>
              </label>
              <label className="form-field">Order
                <input type="number" min="0" value={form.displayOrder} onChange={(event) => patch({ displayOrder: event.target.value })} />
              </label>
            </div>
            <label className="form-field">Explanation
              <textarea maxLength={600} value={form.explanation} onChange={(event) => patch({ explanation: event.target.value })} />
            </label>
            <div className="stack-form">
              {form.options.map((option, index) => (
                <div className="form-grid" key={index}>
                  <label className="form-field">Option {index + 1}
                    <input required value={option.optionText} onChange={(event) => patchOption(index, { optionText: event.target.value })} />
                  </label>
                  <button type="button" className={option.correct ? "primary-button" : "secondary-button"} onClick={() => markCorrect(index)}>{option.correct ? "Correct answer" : "Mark correct"}</button>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setForm(null)}>Cancel</button>
              <button type="submit" className="primary-button" disabled={busy}>{busy ? "Saving…" : form.id ? "Save question" : "Add question"}</button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete this question?"
          description="The question and its options will be removed from the bank."
          confirmLabel="Delete question"
          busy={busy}
          onConfirm={removeQuestion}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

export function AdminRoadmapsPage() {
  const [phases, setPhases] = useState([]);
  const [careers, setCareers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [phaseData, careerData] = await Promise.all([api.get("/admin/roadmaps"), api.get("/admin/careers")]);
      setPhases(phaseData || []);
      setCareers(careerData || []);
    } catch (reason) {
      setError(reason.message || "Could not load roadmaps.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const careerName = useMemo(() => new Map(careers.map((career) => [career.id, career.name])), [careers]);

  if (loading) return <LoadingBlock label="Loading roadmap catalogue…" />;
  if (error) return <div className="workspace-page-content"><PageHeader eyebrow="MASTER DATA" title="Roadmaps" description="Career roadmap phases." /><ErrorBlock message={error} onRetry={load} /></div>;

  return (
    <div className="workspace-page-content">
      <PageHeader eyebrow="MASTER DATA" title="Roadmaps" description="Phase templates used to generate each student's career roadmap." />
      <div className="stat-grid stat-grid-3">
        <StatCard label="Phases" value={phases.length} hint="Across every career" icon="layers" />
        <StatCard label="Careers" value={new Set(phases.map((phase) => phase.careerId)).size} hint="With roadmap content" icon="target" />
        <StatCard label="Average duration" value={`${Math.round(phases.reduce((sum, phase) => sum + (phase.durationDays || 0), 0) / Math.max(1, phases.length))}d`} hint="Per phase" icon="calendar" />
      </div>
      <Panel title="Roadmap phases" description="Read-only catalogue synced from the master roadmap content.">
        <DataTable
          empty="No roadmap phases yet"
          rows={phases}
          getKey={(phase) => phase._id}
          columns={[
            { key: "career", label: "Career", render: (phase) => careerName.get(phase.careerId) || `Career #${phase.careerId}` },
            { key: "title", label: "Phase", render: (phase) => <div><strong>{phase.title}</strong><p className="muted">{phase.description || "No description"}</p></div> },
            { key: "order", label: "Order", render: (phase) => phase.displayOrder },
            { key: "duration", label: "Duration", render: (phase) => `${phase.durationDays} days` },
          ]}
        />
      </Panel>
    </div>
  );
}

export function AdminProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [careers, setCareers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [projectData, careerData] = await Promise.all([api.get("/admin/projects"), api.get("/admin/careers")]);
      setProjects(projectData || []);
      setCareers(careerData || []);
    } catch (reason) {
      setError(reason.message || "Could not load projects.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const careerName = useMemo(() => new Map(careers.map((career) => [career.id, career.name])), [careers]);

  if (loading) return <LoadingBlock label="Loading project catalogue…" />;
  if (error) return <div className="workspace-page-content"><PageHeader eyebrow="MASTER DATA" title="Projects" description="Career project catalogue." /><ErrorBlock message={error} onRetry={load} /></div>;

  return (
    <div className="workspace-page-content">
      <PageHeader eyebrow="MASTER DATA" title="Projects" description="Capstone projects recommended to students for each career path." />
      <div className="stat-grid stat-grid-3">
        <StatCard label="Projects" value={projects.length} hint="Across every career" icon="briefcase" />
        <StatCard label="Published" value={projects.filter((project) => project.published).length} hint="Visible to students" icon="check" />
        <StatCard label="Careers covered" value={new Set(projects.map((project) => project.careerId)).size} hint="With project content" icon="target" />
      </div>
      <Panel title="Project catalogue" description="Read-only catalogue synced from the master project content.">
        <DataTable
          empty="No projects yet"
          rows={projects}
          getKey={(project) => project._id}
          columns={[
            { key: "career", label: "Career", render: (project) => careerName.get(project.careerId) || `Career #${project.careerId}` },
            { key: "title", label: "Project", render: (project) => <div><strong>{project.title}</strong><p className="muted">{project.description || "No description"}</p></div> },
            { key: "difficulty", label: "Difficulty", render: (project) => <Badge tone="info">{prettify(project.difficulty)}</Badge> },
            { key: "weeks", label: "Estimate", render: (project) => `${project.estimatedWeeks} weeks` },
            { key: "published", label: "Status", render: (project) => <Badge tone={project.published ? "positive" : "muted"}>{project.published ? "Published" : "Draft"}</Badge> },
          ]}
        />
      </Panel>
    </div>
  );
}

export function AdminReportsPage() {
  const [stats, setStats] = useState(null);
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [statsData, collegeData] = await Promise.all([api.get("/admin/stats"), api.get("/workspace/colleges")]);
      setStats(statsData);
      setColleges(collegeData || []);
    } catch (reason) {
      setError(reason.message || "Could not load platform reports.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingBlock label="Loading platform reports…" />;
  if (error) return <div className="workspace-page-content"><PageHeader eyebrow="REPORTS" title="Platform reports" description="Cross-institution operational reporting." /><ErrorBlock message={error} onRetry={load} /></div>;

  return (
    <div className="workspace-page-content">
      <PageHeader eyebrow="REPORTS" title="Platform reports" description="Cross-institution adoption, catalogue health and assessment activity." actions={<button type="button" className="secondary-button" onClick={load}>Refresh</button>} />
      <div className="stat-grid stat-grid-4">
        <StatCard label="Colleges" value={stats?.institutions ?? colleges.length} hint="Active workspaces" icon="building" />
        <StatCard label="Students" value={stats?.students ?? 0} hint="Across the platform" icon="users" />
        <StatCard label="Assessments completed" value={stats?.assessmentsCompleted ?? 0} hint={`${stats?.attempts ?? 0} submitted attempts`} icon="clipboard" />
        <StatCard label="Question bank" value={stats?.questions ?? 0} hint={`${stats?.assessments ?? 0} assessments`} icon="book" />
      </div>
      <div className="stat-grid stat-grid-3">
        <StatCard label="Career paths" value={stats?.careers ?? 0} hint="Published and draft" icon="target" />
        <StatCard label="Skills" value={stats?.skills ?? 0} hint="In the master catalogue" icon="chart" />
        <StatCard label="College staff" value={stats?.collegeStaff ?? 0} hint={`${stats?.collegeAdmins ?? 0} administrators`} icon="shield" />
      </div>
      <Panel title="College workspaces" description="Student counts and workspace status by institution.">
        <DataTable
          empty="No college workspaces yet"
          rows={colleges}
          getKey={(college) => college.id}
          columns={[
            { key: "name", label: "College", render: (college) => <div><strong>{college.name}</strong><p className="muted">{college.code}</p></div> },
            { key: "status", label: "Status", render: (college) => <Badge tone={college.status === "ACTIVE" ? "positive" : "muted"}>{prettify(college.status)}</Badge> },
            { key: "students", label: "Students", render: (college) => college.studentCount ?? college.students ?? 0 },
            { key: "staff", label: "Staff", render: (college) => college.staffCount ?? 0 },
            { key: "created", label: "Created", render: (college) => formatDate(college.createdAt) },
          ]}
        />
      </Panel>
    </div>
  );
}

export function AdminAiPage() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setStatus(await api.get("/admin/ai/status"));
    } catch (reason) {
      setError(reason.message || "Could not load AI status.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingBlock label="Loading AI configuration…" />;
  if (error) return <div className="workspace-page-content"><PageHeader eyebrow="AI" title="AI status" description="Runtime AI provider configuration." /><ErrorBlock message={error} onRetry={load} /></div>;

  return (
    <div className="workspace-page-content">
      <PageHeader eyebrow="AI" title="AI status" description="Provider configuration and runtime guardrails for the student career assistant." actions={<button type="button" className="secondary-button" onClick={load}>Refresh</button>} />
      <div className="stat-grid stat-grid-3">
        <StatCard label="Provider" value={status?.provider || "Offline"} hint={status?.model || "Fallback engine"} icon="spark" />
        <StatCard label="Mode" value={prettify(status?.mode)} hint={status?.configured ? "Live provider configured" : "Offline fallback only"} icon="activity" />
        <StatCard label="Rate limit" value={`${status?.rateLimitPerMinute ?? 0}/min`} hint="Per user request budget" icon="shield" />
      </div>
      <Panel title="Runtime configuration" description="Read-only values from the server environment.">
        <dl className="detail-meta">
          <div><dt>Configured</dt><dd>{status?.configured ? "Yes" : "No"}</dd></div>
          <div><dt>Offline fallback</dt><dd>{status?.offlineFallbackEnabled ? "Enabled" : "Disabled"}</dd></div>
          <div><dt>Max tool iterations</dt><dd>{status?.maxToolIterations ?? "—"}</dd></div>
          <div><dt>History limit</dt><dd>{status?.historyLimit ?? "—"}</dd></div>
          <div><dt>Request timeout</dt><dd>{status?.requestTimeoutSeconds ? `${status.requestTimeoutSeconds}s` : "—"}</dd></div>
        </dl>
      </Panel>
    </div>
  );
}
