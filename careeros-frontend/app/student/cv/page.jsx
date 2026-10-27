"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  Award,
  BookOpen,
  Briefcase,
  CheckCircle2,
  Contact,
  Download,
  Eye,
  FileCheck,
  FileText,
  FileUp,
  FolderKanban,
  GraduationCap,
  ListChecks,
  Loader2,
  RefreshCw,
  Route,
  Target,
  TriangleAlert,
  Upload,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CircularProgress } from "@/components/ui/circular-progress";
import { Dialog } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Breadcrumb } from "@/components/breadcrumb";
import { CvSkillsChart } from "@/components/cv-skills-chart";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import api from "@/lib/api";
import { formatDateTime, prettifyEnum } from "@/lib/format";
import { cn } from "cn";

const ACCEPTED_EXTENSIONS = ["pdf", "doc", "docx"];
const MAX_SIZE = 5 * 1024 * 1024;

const SECTION_ICONS = {
  contact: Contact,
  summary: BookOpen,
  skills: Wrench,
  experience: Briefcase,
  education: GraduationCap,
  projects: FolderKanban,
  certifications: Award,
  structure: FileCheck,
};

function formatSize(bytes) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileTypeLabel(document) {
  const type = String(document?.contentType || "").toLowerCase();
  if (type.includes("pdf")) return "PDF";
  if (type.includes("wordprocessingml")) return "DOCX";
  if (type.includes("msword")) return "DOC";
  const name = String(document?.originalFilename || "");
  const ext = name.split(".").pop()?.toUpperCase() || "";
  return ext || "File";
}

function isPdf(document) {
  if (String(document?.contentType || "").toLowerCase().includes("pdf")) return true;
  return String(document?.originalFilename || "").toLowerCase().endsWith(".pdf");
}

function validateFile(file) {
  if (!file) return "Please choose a file first.";
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ACCEPTED_EXTENSIONS.includes(extension)) {
    return "Only PDF, DOC or DOCX files are accepted.";
  }
  if (file.size > MAX_SIZE) {
    return "CV file must be at most 5 MB.";
  }
  return null;
}

/** Green >= 80, primary >= 55, gold >= 35, muted below — same scale as the dashboard. */
function scoreTone(score) {
  if (score >= 80) return "green";
  if (score >= 55) return "primary";
  if (score >= 35) return "gold";
  return "muted";
}

function scoreLabel(score) {
  if (score >= 80) return "Excellent";
  if (score >= 55) return "Strong";
  if (score >= 35) return "Fair";
  return "Needs work";
}

export default function StudentCvPage() {
  const [document, setDocument] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [uploadNote, setUploadNote] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const fileInput = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [doc, result] = await Promise.all([api.get("/cvs/me"), api.get("/cvs/analysis")]);
      setDocument(doc || null);
      setAnalysis(result || null);
    } catch (err) {
      setLoadError(err?.message || "Failed to load your CV.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data loader; state updates happen in promise callbacks
    load();
  }, [load]);

  function closePreview() {
    // Revoke the blob URL at close-time (event handler, not an effect) so
    // no object URL ever leaks and no setState-in-effect is needed.
    setPreviewUrl((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
    setPreviewOpen(false);
  }

  async function handleFile(file) {
    const problem = validateFile(file);
    if (problem) {
      setUploadNote({ type: "error", text: problem });
      toast.error(problem);
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setUploadNote({ type: "info", text: `Uploading ${file.name} (${formatSize(file.size)})…` });
    const formData = new FormData();
    formData.append("file", file);
    setUploading(true);
    try {
      const saved = await api.post("/cvs", formData);
      const doneText = saved?.originalFilename
        ? `Uploaded ${saved.originalFilename} — analysis is ready below.`
        : "CV uploaded — analysis is ready below.";
      setUploadNote({ type: "success", text: doneText });
      toast.success(doneText);
      await load();
    } catch (err) {
      const message = err?.message || "Failed to upload your CV.";
      setUploadNote({ type: "error", text: message });
      toast.error(message);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = globalThis.document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    globalThis.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function handleDownload() {
    if (!document) return;
    setDownloading(true);
    try {
      const blob = await api.get("/cvs/download", { responseType: "blob" });
      downloadBlob(blob, document.originalFilename || "cv");
      toast.success("CV downloaded.");
    } catch (err) {
      toast.error(err?.message || "Failed to download your CV.");
    } finally {
      setDownloading(false);
    }
  }

  async function handleReportDownload() {
    setDownloadingReport(true);
    try {
      const blob = await api.get("/reports/overall/download", { responseType: "blob" });
      downloadBlob(blob, "careeros-overall-report.pdf");
      toast.success("Report downloaded.");
    } catch (err) {
      toast.error(err?.message || "Could not download the report.");
    } finally {
      setDownloadingReport(false);
    }
  }

  async function handlePreview() {
    if (!document || previewLoading) return;
    if (!isPdf(document)) {
      setPreviewOpen(true);
      return;
    }
    setPreviewLoading(true);
    try {
      const blob = await api.get("/cvs/download", { responseType: "blob" });
      setPreviewUrl(URL.createObjectURL(blob));
      setPreviewOpen(true);
    } catch (err) {
      toast.error(err?.message || "Could not preview your CV.");
    } finally {
      setPreviewLoading(false);
    }
  }

  if (loading) return <LoadingState label="Loading your CV analysis…" />;

  if (loadError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="CV Analysis"
          description="Analyze your resume, identify strengths and gaps, and improve your career readiness."
          breadcrumb={<Breadcrumb items={[{ label: "CV Analysis" }]} />}
        />
        <ErrorState title="Couldn't load your CV" description={loadError} onRetry={load} />
      </div>
    );
  }

  const parsed = document?.status === "PARSED";
  const failed = document?.status === "FAILED";
  const detected = analysis?.detectedSkills || [];
  const matched = analysis?.matchedSkills || [];
  const missing = analysis?.missingSkills || [];
  const completeness = analysis?.completeness || null;
  const sections = analysis?.sections || [];
  const atsScore = analysis?.atsScore ?? 0;
  const overallScore = analysis?.overallScore ?? 0;
  const frameworkTotal = matched.length + missing.length;
  const alignment = frameworkTotal > 0 ? Math.round((matched.length / frameworkTotal) * 100) : 0;
  const topMissing = [...missing].sort((a, b) => (b.weightPercent ?? 0) - (a.weightPercent ?? 0)).slice(0, 3);

  return (
    <div className="space-y-6">
      <PageHeader
        title="CV Analysis"
        description="Analyze your resume, identify strengths and gaps, and improve your career readiness."
        breadcrumb={<Breadcrumb items={[{ label: "CV Analysis" }]} />}
        actions={
          <>
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.doc,.docx"
              className="hidden"
              aria-label="Choose your CV file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <Button size="sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
              {uploading ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Upload className="size-3.5" aria-hidden="true" />
              )}
              {uploading ? "Uploading…" : document ? "Upload New CV" : "Upload CV"}
            </Button>
            {document && (
              <Button variant="outline" size="sm" disabled={downloadingReport} onClick={handleReportDownload}>
                {downloadingReport ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="size-3.5" aria-hidden="true" />
                )}
                Download Report
              </Button>
            )}
          </>
        }
      />

      {uploadNote && (
        <p
          role={uploadNote.type === "error" ? "alert" : "status"}
          className={
            uploadNote.type === "error"
              ? "rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive"
              : uploadNote.type === "success"
                ? "rounded-xl border border-chart-3/40 bg-chart-3/10 px-3 py-2 text-xs font-semibold text-chart-3"
                : "inline-flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary"
          }
        >
          {uploadNote.type === "info" && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
          {uploadNote.text}
        </p>
      )}

      {!document ? (
        <EmptyState
          icon={FileUp}
          title="Upload your CV to get started"
          description="PDF, DOC or DOCX · max 5 MB · stored privately. We'll detect your skills, score each section, and match you against your target career."
          action={
            <Button size="sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
              {uploading ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Upload className="size-3.5" aria-hidden="true" />
              )}
              {uploading ? "Uploading…" : "Upload CV"}
            </Button>
          }
        />
      ) : (
        <>
          {/* ── CV overview: document + overall score ── */}
          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="shadow-card lg:col-span-2">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <FileText className="size-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base leading-snug">{document.originalFilename}</CardTitle>
                      <CardDescription>
                        {fileTypeLabel(document)} · {formatSize(document.fileSize)} · uploaded{" "}
                        {formatDateTime(document.uploadedAt)}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "shrink-0",
                      parsed && "bg-chart-3/15 text-chart-3",
                      failed && "bg-destructive/10 text-destructive",
                    )}
                  >
                    {parsed ? "Parsed" : failed ? "Couldn't parse" : document.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {failed && (
                  <p className="flex items-start gap-1.5 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    {document.parseError || "We couldn't read that file — try another export."}
                  </p>
                )}
                {parsed && (
                  <dl className="grid gap-2 text-sm">
                    {[
                      ["Name", document.candidateName],
                      ["Email", document.candidateEmail],
                      ["Phone", document.candidatePhone],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-background/40 px-3 py-2"
                      >
                        <dt className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</dt>
                        <dd className="truncate font-medium">{value || "—"}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" disabled={previewLoading} onClick={handlePreview}>
                    {previewLoading ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Eye className="size-3.5" aria-hidden="true" />
                    )}
                    Preview
                  </Button>
                  <Button variant="outline" size="sm" disabled={downloading} onClick={handleDownload}>
                    {downloading ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Download className="size-3.5" aria-hidden="true" />
                    )}
                    Download
                  </Button>
                  <Button variant="outline" size="sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
                    <RefreshCw className="size-3.5" aria-hidden="true" />
                    Replace
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/25 shadow-card lg:col-span-3">
              <CardHeader>
                <CardTitle className="text-base">Overall CV Score</CardTitle>
                <CardDescription>
                  {analysis?.hasTarget
                    ? `Profile quality, career match and readability combined for ${analysis.careerName}.`
                    : "Profile quality and readability combined — choose a career to add the match score."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="flex shrink-0 flex-col items-center gap-1 text-center">
                  <CircularProgress
                    value={overallScore}
                    size={128}
                    strokeWidth={11}
                    tone={scoreTone(overallScore)}
                    label="Overall CV score"
                  >
                    <span className="text-3xl font-bold tracking-tight text-primary">{overallScore}</span>
                    <span className="text-[11px] font-bold">{scoreLabel(overallScore)}</span>
                  </CircularProgress>
                </div>
                <div className="min-w-0 flex-1 space-y-4">
                  {[
                    {
                      label: "ATS Compatibility",
                      hint: "6 machine-readability checks: contact as text, standard headings, text layer.",
                      value: atsScore,
                    },
                    {
                      label: "Profile Completeness",
                      hint: completeness
                        ? `${completeness.passedChecks} of ${completeness.totalChecks} quality checks passing.`
                        : "Education, experience, projects, skills and contact basics.",
                      value: completeness?.scorePercent ?? 0,
                    },
                    {
                      label: "Career Alignment",
                      hint: analysis?.hasTarget
                        ? `${matched.length} of ${frameworkTotal} required ${analysis.careerName} skills found.`
                        : "Choose a target career to unlock this score.",
                      value: analysis?.hasTarget ? alignment : 0,
                    },
                  ].map((meter) => (
                    <div key={meter.label}>
                      <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                        <span>
                          <span className="font-semibold">{meter.label}</span>
                          <span className="mt-0.5 block text-[11px] font-normal text-muted-foreground">
                            {meter.hint}
                          </span>
                        </span>
                        <span className="tnum shrink-0 text-sm font-bold text-primary">{meter.value}%</span>
                      </div>
                      <Progress
                        value={meter.value}
                        tone={scoreTone(meter.value)}
                        className="h-2"
                        aria-label={`${meter.label} ${meter.value} percent`}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Section-wise analysis ── */}
          {failed ? (
            <Card className="shadow-card">
              <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
                <span className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                  <TriangleAlert className="size-7" aria-hidden="true" />
                </span>
                <p className="text-base font-bold">We couldn&apos;t read this file</p>
                <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                  {document.parseError || "The file has no readable text."} Scanned images without a text layer
                  can&apos;t be analysed — export your CV as PDF with selectable text and upload it again.
                </p>
                <Button size="sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
                  <Upload className="size-3.5" aria-hidden="true" />
                  Upload a readable CV
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {sections.length > 0 && (
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle className="text-base">Section-wise Analysis</CardTitle>
                    <CardDescription>
                      Each section scored from your actual CV text — green means a recruiter finds it, amber means
                      fix it next.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {sections.map((section) => {
                        const Icon = SECTION_ICONS[section.key] || FileCheck;
                        return (
                          <li
                            key={section.key}
                            className="rounded-2xl border border-border/60 bg-card p-4 transition hover:border-primary/40 hover:shadow-card-hover"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <Icon className="size-4" aria-hidden="true" />
                              </span>
                              <Badge
                                variant="secondary"
                                className={cn(
                                  "shrink-0",
                                  section.passed
                                    ? "bg-chart-3/15 text-chart-3"
                                    : "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                                )}
                              >
                                {section.passed ? "Good" : "Needs work"}
                              </Badge>
                            </div>
                            <p className="mt-3 text-sm font-bold">{section.title}</p>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{section.note}</p>
                            {section.evidence ? (
                              <p className="mt-2 truncate text-[11px] italic leading-relaxed text-muted-foreground/80" title={section.evidence}>
                                “{section.evidence}”
                              </p>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* ── Skill analysis ── */}
              <Card className="shadow-card">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">Skill Analysis</CardTitle>
                      <CardDescription>
                        Matched against the CareerOS skill catalog
                        {analysis?.hasTarget ? ` and your ${analysis.careerName} framework` : ""} —{" "}
                        {detected.length} detected.
                      </CardDescription>
                    </div>
                    {detected.length > 0 && <Badge variant="secondary">{detected.length} detected</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <CvSkillsChart
                    detected={detected}
                    matched={matched}
                    missing={missing}
                    hasTarget={analysis?.hasTarget}
                    careerName={analysis?.careerName}
                    alignment={alignment}
                  />
                  {detected.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {parsed
                        ? "No catalog skills detected. Add a Skills section listing the tools and technologies you know."
                        : "Skills appear here once your CV is parsed."}
                    </p>
                  ) : (
                    <ul className="flex flex-wrap gap-2">
                      {detected.map((skill) => (
                        <li key={skill.skillId}>
                          <Badge variant="secondary" className="bg-primary/10 text-primary">
                            {skill.skillName}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                  {analysis?.hasTarget ? (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-2xl border border-chart-3/25 bg-chart-3/5 p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-chart-3">
                          Matched ({matched.length})
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Required for {analysis.careerName} — and already on your CV.
                        </p>
                        {matched.length === 0 ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            None yet — the missing list on the right is your study plan.
                          </p>
                        ) : (
                          <ul className="mt-2 space-y-2">
                            {matched.map((skill) => (
                              <li
                                key={skill.skillId}
                                className="flex items-center justify-between gap-2 text-sm"
                              >
                                <span className="inline-flex min-w-0 items-center gap-1.5">
                                  <CheckCircle2 className="size-4 shrink-0 text-chart-3" aria-hidden="true" />
                                  <span className="truncate font-medium">{skill.skillName}</span>
                                </span>
                                <span className="tnum shrink-0 text-xs font-semibold text-muted-foreground">
                                  {skill.assessed
                                    ? `Tested ${skill.scorePercent}% · needs ${skill.targetPercent}%`
                                    : `Needs ${skill.targetPercent}%`}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                          Missing ({missing.length})
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Required for {analysis.careerName} — add proof or learn them next.
                        </p>
                        {missing.length === 0 ? (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Your CV covers every required skill. Excellent!
                          </p>
                        ) : (
                          <ul className="mt-2 space-y-2">
                            {missing.map((skill) => (
                              <li
                                key={skill.skillId}
                                className="flex items-center justify-between gap-2 text-sm"
                              >
                                <span className="min-w-0">
                                  <span className="block truncate font-medium">{skill.skillName}</span>
                                  <span className="block text-[11px] text-muted-foreground">
                                    {prettifyEnum(skill.skillCategory)} · weight {skill.weightPercent ?? 0}%
                                  </span>
                                </span>
                                <span className="tnum shrink-0 text-xs font-semibold text-muted-foreground">
                                  Needs {skill.targetPercent}%
                                  {skill.assessed ? ` · tested ${skill.scorePercent}%` : ""}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-6 text-center">
                      <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Target className="size-6" aria-hidden="true" />
                      </span>
                      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                        Choose a target career to split your skills into matched and missing against what employers
                        expect.
                      </p>
                      <Button size="sm" render={<Link href="/student/careers" />}>
                        Choose career
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ── Strengths + improvements (from the analysis service) ── */}
              {completeness && (
                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="shadow-card">
                    <CardHeader>
                      <CardTitle className="text-base">Key Strengths</CardTitle>
                      <CardDescription>
                        {completeness.passedChecks} of {completeness.totalChecks} quality checks passing.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {(completeness.strengths || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Nothing confirmed yet — strengths appear as you complete each section.
                        </p>
                      ) : (
                        <ul className="space-y-2">
                          {(completeness.strengths || []).map((item) => (
                            <li key={item} className="flex items-start gap-2 text-sm">
                              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-chart-3" aria-hidden="true" />
                              <span className="font-medium">{item}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="shadow-card">
                    <CardHeader>
                      <CardTitle className="text-base">Areas for Improvement</CardTitle>
                      <CardDescription>Fix these to raise your score — biggest impact first.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {(completeness.suggestions || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nothing to fix — solid CV.</p>
                      ) : (
                        <ul className="space-y-2">
                          {(completeness.suggestions || []).map((item) => (
                            <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <span
                                aria-hidden="true"
                                className="mt-1.5 size-1.5 shrink-0 rounded-full bg-chart-2"
                              />
                              {item}
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* ── How to improve + career alignment ── */}
              <div className="grid gap-4 lg:grid-cols-5">
                <Card className="border-primary/25 shadow-card lg:col-span-3">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                        <ListChecks className="size-4" aria-hidden="true" />
                      </span>
                      How to Improve Your CV
                    </CardTitle>
                    <CardDescription>Prioritized from your analysis — do these in order.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ol className="space-y-2.5">
                      {analysis?.hasTarget && topMissing.length > 0 && (
                        <li className="flex items-start gap-3 rounded-xl border border-border/50 bg-background/40 p-3">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                            1
                          </span>
                          <p className="text-sm leading-relaxed">
                            <span className="font-bold">Add your highest-weight missing skills: </span>
                            {topMissing.map((s) => s.skillName).join(", ")}. These carry the most weight for{" "}
                            {analysis.careerName} — one project line each is enough proof.
                          </p>
                        </li>
                      )}
                      {(completeness?.suggestions || []).slice(0, 2).map((item, index) => (
                        <li
                          key={item}
                          className="flex items-start gap-3 rounded-xl border border-border/50 bg-background/40 p-3"
                        >
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                            {analysis?.hasTarget && topMissing.length > 0 ? index + 2 : index + 1}
                          </span>
                          <p className="text-sm leading-relaxed">{item}</p>
                        </li>
                      ))}
                      {!analysis?.hasTarget && (
                        <li className="flex items-start gap-3 rounded-xl border border-border/50 bg-background/40 p-3">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                            1
                          </span>
                          <p className="text-sm leading-relaxed">
                            <span className="font-bold">Choose your target career</span> to unlock skill matching,
                            career alignment and a personalized improvement plan.
                          </p>
                        </li>
                      )}
                    </ol>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button size="sm" render={<Link href="/student/roadmap" />}>
                        <Route className="size-3.5" aria-hidden="true" />
                        Follow my learning plan
                      </Button>
                      {!analysis?.hasTarget && (
                        <Button size="sm" variant="outline" render={<Link href="/student/careers" />}>
                          Choose career
                          <ArrowRight className="size-3.5" aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-card lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base">Career Alignment</CardTitle>
                    <CardDescription>
                      {analysis?.hasTarget
                        ? `How your CV matches ${analysis.careerName}.`
                        : "Select a career to see your match."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {analysis?.hasTarget ? (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="secondary" className="bg-primary/10 text-primary">
                            {analysis.careerName}
                          </Badge>
                          <span className="tnum text-2xl font-bold text-primary">{alignment}%</span>
                        </div>
                        <Progress
                          value={alignment}
                          tone={scoreTone(alignment)}
                          className="h-2.5"
                          aria-label={`Career alignment ${alignment} percent`}
                        />
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="rounded-xl border border-chart-3/25 bg-chart-3/5 p-3">
                            <p className="tnum text-xl font-bold text-chart-3">{matched.length}</p>
                            <p className="text-[11px] font-semibold text-muted-foreground">Matching skills</p>
                          </div>
                          <div className="rounded-xl border border-border/50 bg-background/40 p-3">
                            <p className="tnum text-xl font-bold">{missing.length}</p>
                            <p className="text-[11px] font-semibold text-muted-foreground">Missing skills</p>
                          </div>
                        </div>
                        {topMissing.length > 0 && (
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            <span className="font-bold text-foreground">Focus next: </span>
                            {topMissing.map((s) => s.skillName).join(", ")}.
                          </p>
                        )}
                        <Button variant="outline" size="sm" className="w-full" render={<Link href="/student/roadmap" />}>
                          Close gaps with my roadmap
                          <ArrowRight className="size-3.5" aria-hidden="true" />
                        </Button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-3 py-4 text-center">
                        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          <Target className="size-6" aria-hidden="true" />
                        </span>
                        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                          Choose a target career to see how well your CV matches what employers expect.
                        </p>
                        <Button size="sm" render={<Link href="/student/careers" />}>
                          Choose career
                          <ArrowRight className="size-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Private PDF preview (owner-only blob, never a public URL) ── */}
      <Dialog
        open={previewOpen}
        onOpenChange={(open) => {
          if (open) setPreviewOpen(true);
          else closePreview();
        }}
        title={document?.originalFilename || "CV Preview"}
        description={isPdf(document) ? "Private preview loaded from your own upload." : undefined}
        className="max-w-4xl"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={closePreview}>
              Close
            </Button>
            <Button size="sm" disabled={downloading} onClick={handleDownload}>
              {downloading ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="size-3.5" aria-hidden="true" />
              )}
              Download
            </Button>
          </>
        }
      >
        {isPdf(document) && previewUrl ? (
          <iframe
            title="CV preview"
            src={previewUrl}
            className="mt-4 h-[70vh] w-full rounded-xl border border-border/60 bg-muted/40"
          />
        ) : (
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            In-browser preview is available for PDF files. Your {fileTypeLabel(document)} file can be read after
            downloading it with the button below.
          </p>
        )}
      </Dialog>
    </div>
  );
}
