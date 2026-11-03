import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../lib/api.js";
import { Badge, EmptyState, ErrorBlock, LoadingBlock, PageHeader, Panel, ProgressBar } from "../components/ui.jsx";
import { Icon } from "../components/Icon.jsx";

const ACCEPTED = ["pdf", "doc", "docx"];
const MAX_SIZE = 5 * 1024 * 1024;

function formatSize(bytes) {
  if (bytes == null) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function tone(score) {
  if (score >= 80) return "positive";
  if (score >= 65) return "info";
  if (score >= 50) return "warning";
  return "danger";
}

function validateFile(file) {
  if (!file) return "Please choose a file first.";
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ACCEPTED.includes(extension)) return "Only PDF, DOC or DOCX files are accepted.";
  if (file.size > MAX_SIZE) return "CV file must be at most 5 MB.";
  return null;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function StudentCvPage() {
  const [document, setDocument] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState("");
  const [preview, setPreview] = useState(null);
  const fileInput = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [doc, result] = await Promise.all([api.get("/cvs/me"), api.get("/cvs/analysis")]);
      setDocument(doc || null);
      setAnalysis(result || null);
    } catch (reason) {
      setError(reason.message || "Unable to load your CV.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  async function upload(file) {
    const problem = validateFile(file);
    if (problem) {
      toast.error(problem);
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);
    try {
      const saved = await api.post("/cvs", formData);
      toast.success(`${saved.originalFilename} uploaded and analyzed.`);
      await load();
    } catch (reason) {
      toast.error(reason.message || "Unable to upload your CV.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function download() {
    setBusy("download");
    try {
      const blob = await api.get("/cvs/download", { responseType: "blob" });
      downloadBlob(blob, document?.originalFilename || "cv.pdf");
    } catch (reason) {
      toast.error(reason.message || "Unable to download your CV.");
    } finally {
      setBusy("");
    }
  }

  async function downloadReport() {
    setBusy("report");
    try {
      const blob = await api.get("/reports/overall/download", { responseType: "blob" });
      downloadBlob(blob, "careeros-overall-report.pdf");
    } catch (reason) {
      toast.error(reason.message || "Unable to download the report.");
    } finally {
      setBusy("");
    }
  }

  async function openPreview() {
    setBusy("preview");
    try {
      const blob = await api.get("/cvs/download", { responseType: "blob" });
      setPreview(URL.createObjectURL(blob));
    } catch (reason) {
      toast.error(reason.message || "Unable to preview your CV.");
    } finally {
      setBusy("");
    }
  }

  function closePreview() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  }

  if (loading) return <main className="workspace-page"><LoadingBlock label="Loading your CV analysis..." /></main>;
  if (error && !document) return <main className="workspace-page"><ErrorBlock message={error} onRetry={load} /></main>;

  const parsed = document?.status === "PARSED";
  const previewable = (document?.contentType || "").includes("pdf") || /\.pdf$/i.test(document?.originalFilename || "");
  const matched = analysis?.matchedSkills || [];
  const missing = analysis?.missingSkills || [];
  const detected = analysis?.detectedSkills || [];
  const sections = analysis?.sections || [];
  const completeness = analysis?.completeness || null;
  const frameworkTotal = matched.length + missing.length;
  const alignment = frameworkTotal > 0 ? Math.round((matched.length / frameworkTotal) * 100) : 0;

  return <main className="workspace-page cv-page">
    <PageHeader
      eyebrow="RESUME"
      title="CV analysis"
      description="Upload your resume to check ATS readability, section quality, and how well your skills match your target career."
      actions={<>
        <input ref={fileInput} type="file" accept=".pdf,.doc,.docx" className="visually-hidden" aria-label="Choose your CV file" onChange={(event) => { const file = event.target.files?.[0]; if (file) upload(file); }} />
        <button className="primary-button" disabled={uploading} onClick={() => fileInput.current?.click()}>
          <Icon name="upload" size={15} /> {uploading ? "Uploading..." : document ? "Upload new CV" : "Upload CV"}
        </button>
        {document && <button className="secondary-button" disabled={busy === "report"} onClick={downloadReport}><Icon name="download" size={15} /> {busy === "report" ? "Preparing..." : "Download report"}</button>}
      </>}
    />

    {error && <div className="success-banner roadmap-error" role="alert">{error}</div>}

    {!document ? <section className="settings-card">
      <EmptyState
        icon="file"
        title="Upload your CV to get started"
        description="PDF, DOC or DOCX up to 5 MB. Your file stays private and is used only for your own analysis."
        action={<button className="primary-button" disabled={uploading} onClick={() => fileInput.current?.click()}><Icon name="upload" size={15} /> {uploading ? "Uploading..." : "Choose a file"}</button>}
      />
    </section> : <>
      <div className="cv-overview-grid">
        <Panel title="Your document" description="Private to your account.">
          <div className="cv-document-row">
            <span className="settings-icon"><Icon name="file" size={20} /></span>
            <div>
              <strong>{document.originalFilename}</strong>
              <span>{formatSize(document.fileSize)} uploaded {formatDate(document.uploadedAt)}</span>
            </div>
            <Badge tone={parsed ? "positive" : "danger"}>{parsed ? "Parsed" : "Could not parse"}</Badge>
          </div>
          {document.status === "FAILED" && <p className="cv-warning">{document.parseError || "We could not read this file. Upload a text-based PDF or DOCX."}</p>}
          {parsed && <dl className="settings-list">
            <div><dt>Name</dt><dd>{document.candidateName || "-"}</dd></div>
            <div><dt>Email</dt><dd>{document.candidateEmail || "-"}</dd></div>
            <div><dt>Phone</dt><dd>{document.candidatePhone || "-"}</dd></div>
          </dl>}
          <div className="button-row">
            <button className="secondary-button" disabled={busy === "preview"} onClick={openPreview}><Icon name="search" size={14} /> {busy === "preview" ? "Opening..." : "Preview"}</button>
            <button className="secondary-button" disabled={busy === "download"} onClick={download}><Icon name="download" size={14} /> {busy === "download" ? "Downloading..." : "Download"}</button>
            <button className="secondary-button" disabled={uploading} onClick={() => fileInput.current?.click()}><Icon name="upload" size={14} /> Replace</button>
          </div>
        </Panel>

        <Panel title="Overall CV score" description={analysis?.hasTarget ? `Profile quality, career match and readability for ${analysis.careerName}.` : "Choose a target career to add a career match score."}>
          <div className="cv-score-hero">
            <strong className={`cv-score cv-score-${tone(analysis?.overallScore || 0)}`}>{analysis?.overallScore ?? 0}<small>%</small></strong>
            <div>
              <span>ATS compatibility</span><b>{analysis?.atsScore ?? 0}%</b>
              <ProgressBar value={analysis?.atsScore || 0} tone={tone(analysis?.atsScore || 0)} />
              <span>Profile completeness</span><b>{completeness?.scorePercent ?? 0}%</b>
              <ProgressBar value={completeness?.scorePercent || 0} tone={tone(completeness?.scorePercent || 0)} />
              <span>Career alignment</span><b>{analysis?.hasTarget ? `${alignment}%` : "Not set"}</b>
              <ProgressBar value={analysis?.hasTarget ? alignment : 0} tone={tone(alignment)} />
            </div>
          </div>
        </Panel>
      </div>

      {sections.length > 0 && <section className="settings-card">
        <div className="settings-section-heading"><span className="settings-icon"><Icon name="clipboard" size={18} /></span><div><h2>Section-wise analysis</h2><p>Each section checked against your actual CV text.</p></div></div>
        <div className="cv-section-grid">{sections.map((section) => <article key={section.key} className={`cv-section-card ${section.passed ? "cv-section-pass" : "cv-section-fail"}`}>
          <div><strong>{section.title}</strong><Badge tone={section.passed ? "positive" : "warning"}>{section.passed ? "Good" : "Needs work"}</Badge></div>
          <p>{section.note}</p>
          {section.evidence && <small title={section.evidence}>{section.evidence}</small>}
        </article>)}</div>
      </section>}

      <section className="settings-card">
        <div className="settings-section-heading"><span className="settings-icon"><Icon name="target" size={18} /></span><div><h2>Skill analysis</h2><p>{detected.length} detected in this CV{analysis?.hasTarget ? ` against the ${analysis.careerName} framework` : ""}.</p></div></div>
        {detected.length > 0 ? <div className="skill-tags">{detected.map((skill) => <span key={skill.skillId}>{skill.skillName}</span>)}</div> : <p className="muted">No catalog skills detected. Add a Skills section listing the tools and technologies you know.</p>}
        {analysis?.hasTarget ? <div className="cv-skill-columns">
          <div className="cv-skill-panel cv-skill-matched"><h3>Matched ({matched.length})</h3>{matched.length === 0 ? <p>None yet. The missing list is your study plan.</p> : <ul>{matched.map((skill) => <li key={skill.skillId}><span>{skill.skillName}</span><small>{skill.assessed ? `Tested ${skill.scorePercent}% - needs ${skill.targetPercent}%` : `Needs ${skill.targetPercent}%`}</small></li>)}</ul>}</div>
          <div className="cv-skill-panel"><h3>Missing ({missing.length})</h3>{missing.length === 0 ? <p>Your CV covers every required skill.</p> : <ul>{missing.map((skill) => <li key={skill.skillId}><span>{skill.skillName}</span><small>Weight {skill.weightPercent ?? 0}% - needs {skill.targetPercent}%</small></li>)}</ul>}</div>
        </div> : <div className="cv-callout"><p>Choose a target career to split your skills into matched and missing.</p><Link className="primary-button" to="/student/careers">Choose career <Icon name="arrow" size={14} /></Link></div>}
      </section>

      {completeness && <div className="cv-two-column">
        <Panel title="Key strengths" description={`${completeness.passedChecks} of ${completeness.totalChecks} quality checks passing.`}>
          {completeness.strengths.length === 0 ? <p className="muted">Strengths appear as you complete each section.</p> : <ul className="cv-check-list">{completeness.strengths.map((item) => <li key={item}><Icon name="check" size={14} /> {item}</li>)}</ul>}
        </Panel>
        <Panel title="Areas for improvement" description="Fix these to raise your score.">
          {completeness.suggestions.length === 0 ? <p className="muted">Nothing to fix. Solid CV.</p> : <ul className="cv-check-list cv-check-warn">{completeness.suggestions.map((item) => <li key={item}>{item}</li>)}</ul>}
        </Panel>
      </div>}
    </>}

    {preview && <div className="dialog-backdrop" onClick={closePreview} role="presentation">
      <div className="cv-preview" onClick={(event) => event.stopPropagation()}>
        <header><strong>{document?.originalFilename}</strong><button className="icon-button" onClick={closePreview} aria-label="Close preview">x</button></header>
        {previewable ? <iframe title="CV preview" src={preview} /> : <div className="cv-preview-fallback">
          <Icon name="file" size={32} />
          <h3>Preview is available for PDF files</h3>
          <p>Word documents open best in Word, Pages or Google Docs. Download your CV to view the full file.</p>
          <div className="button-row">
            <button className="primary-button" disabled={busy === "download"} onClick={download}><Icon name="download" size={14} /> {busy === "download" ? "Downloading…" : "Download CV"}</button>
            <button className="secondary-button" onClick={closePreview}>Close</button>
          </div>
        </div>}
      </div>
    </div>}
  </main>;
}
