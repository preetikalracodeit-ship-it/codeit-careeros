"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Download,
  FileText,
  Gauge,
  Lock,
  Route,
  Share2,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Breadcrumb } from "@/components/breadcrumb";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import api from "@/lib/api";
import { downloadFile } from "@/lib/download";
import { ENROLLMENT_STATUSES, enrollmentTone, labelOf } from "@/lib/college";
import { formatDate, formatDateTime, prettifyEnum } from "@/lib/format";
import { cn } from "cn";

function InfoRow({ label, value }) {
  if (value == null || value === "") return null;
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/40 py-2 text-sm last:border-0">
      <dt className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right">{value}</dd>
    </div>
  );
}

function GapList({ title, gaps, empty }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {gaps?.length ? (
        <ul className="space-y-1.5">
          {gaps.slice(0, 8).map((gap) => (
            <li key={gap.skillId} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{gap.skillName}</span>
              <span className="tnum shrink-0 text-xs text-muted-foreground">
                {gap.assessed ? `${gap.scorePercent ?? 0}% / ${gap.targetPercent ?? 0}%` : "Not assessed"}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

export default function CollegeStudentDetailPage() {
  const params = useParams();
  const id = params?.id;
  const [me, setMe] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [status, setStatus] = useState("");
  const [reason, setReason] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const meData = await api.get("/college/me");
      setMe(meData);
      if (!meData?.permissions?.includes("VIEW_STUDENTS")) {
        setError("Your college role does not have permission to view student records.");
        return;
      }
      const detailData = await api.get(`/college/students/${id}`);
      setDetail(detailData);
      setStatus(detailData?.enrollment?.status || "");
    } catch (err) {
      setError(err.message || "Failed to load this student.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async scoped detail loader; state updates happen in promise callbacks
    load();
  }, [load]);

  async function downloadPdf() {
    setDownloading(true);
    setError("");
    try {
      await downloadFile(`/college/students/${id}/report.pdf`, null, `student-${id}-360.pdf`);
    } catch (err) {
      setError(err.message || "Failed to generate the Student 360 PDF.");
    } finally {
      setDownloading(false);
    }
  }

  async function saveStatus(event) {
    event.preventDefault();
    setSavingStatus(true);
    setError("");
    try {
      await api.patch(`/college/students/${id}/status`, {
        status,
        reason: reason.trim() || null,
      });
      setReason("");
      await load();
    } catch (err) {
      setError(err.message || "Failed to update enrollment status.");
    } finally {
      setSavingStatus(false);
    }
  }

  if (loading && !detail) return <LoadingState label="Loading Student 360…" />;

  if (error && !detail) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Student 360"
          breadcrumb={<Breadcrumb items={[{ label: "Students", href: "/college/students" }, { label: "Student" }]} />}
        />
        <ErrorState title="Couldn't load this student" description={error} onRetry={load} />
      </div>
    );
  }

  const profile = detail?.profile || {};
  const enrollment = detail?.enrollment || {};
  const readiness = detail?.readiness;
  const roadmap = detail?.roadmap;
  const projects = detail?.projects;
  const cv = detail?.cvAnalysis;
  const linkedin = detail?.linkedInAnalysis;
  const permissions = detail?.permissions || {};
  const canManage = me?.permissions?.includes("MANAGE_STUDENTS");
  const canReport = me?.permissions?.includes("GENERATE_REPORTS");

  return (
    <div className="space-y-6">
      <PageHeader
        title={profile.fullName || "Student 360"}
        description={
          [profile.studentId, enrollment.rollNumber, enrollment.departmentName, enrollment.programName]
            .filter(Boolean)
            .join(" · ") || "Scoped student record"
        }
        breadcrumb={<Breadcrumb items={[{ label: "Students", href: "/college/students" }, { label: profile.fullName || "Student" }]} />}
        actions={
          <>
            <Button variant="outline" size="sm" render={<Link href="/college/students" />}>
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Back
            </Button>
            {canReport && (
              <Button variant="outline" size="sm" onClick={downloadPdf} disabled={downloading}>
                <Download className="size-3.5" aria-hidden="true" />
                {downloading ? "Generating…" : "Student 360 PDF"}
              </Button>
            )}
          </>
        }
      />

      {error && detail && (
        <p role="alert" className="text-xs font-semibold text-destructive">
          {error}{" "}
          <button type="button" className="underline" onClick={load}>
            Retry
          </button>
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
            <CardDescription>Field visibility is enforced by the server for your role.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl>
              <InfoRow label="Student ID" value={profile.studentId} />
              <InfoRow label="Email" value={profile.email} />
              <InfoRow label="College" value={profile.college} />
              <InfoRow label="Degree / branch" value={[profile.degree, profile.branch].filter(Boolean).join(" · ")} />
              <InfoRow label="Graduation" value={profile.graduationYear ? `Class of ${profile.graduationYear}` : null} />
              <InfoRow label="Semester" value={profile.semester ? `Semester ${profile.semester}` : null} />
            </dl>
            {!permissions.canViewSensitiveProfile && (
              <p className="mt-3 flex items-start gap-2 rounded-lg bg-muted/60 p-2.5 text-xs text-muted-foreground">
                <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                Email, contact details and profile links are hidden until your institution approves their use.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Enrollment</CardTitle>
            <CardDescription>{enrollment.institutionName || "Institution"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl>
              <InfoRow label="Roll number" value={enrollment.rollNumber} />
              <InfoRow label="Department" value={enrollment.departmentName} />
              <InfoRow label="Program" value={enrollment.programName} />
              <InfoRow label="Batch" value={enrollment.batchLabel} />
              <InfoRow label="Section" value={enrollment.sectionName} />
              <InfoRow label="Academic year" value={enrollment.academicYearLabel} />
              <InfoRow label="Start / end" value={[formatDate(enrollment.startDate), formatDate(enrollment.endDate)].filter((v) => v && v !== "—").join(" → ")} />
            </dl>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</span>
              <Badge className={cn("border-0", enrollmentTone(enrollment.status))}>{labelOf(enrollment.status)}</Badge>
            </div>

            {canManage && (
              <form onSubmit={saveStatus} className="space-y-3 rounded-xl border border-border/60 p-3">
                <Select
                  label="Change enrollment status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  options={ENROLLMENT_STATUSES.map((value) => ({ value, label: prettifyEnum(value) }))}
                />
                <Input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Reason (optional, audited)"
                  maxLength={500}
                  aria-label="Status change reason"
                />
                <Button type="submit" size="sm" disabled={savingStatus || status === enrollment.status}>
                  {savingStatus ? "Saving…" : "Update status"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Career readiness</CardTitle>
            <CardDescription>{readiness?.targetCareerName || "No target career selected"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {readiness?.hasTarget ? (
              <>
                <div className="flex items-end justify-between gap-3">
                  <p className="text-4xl font-bold tracking-tight tnum">
                    {readiness.readinessPercent == null ? "—" : `${readiness.readinessPercent}%`}
                  </p>
                  <Badge variant="secondary">{labelOf(readiness.readinessLevel)}</Badge>
                </div>
                <Progress
                  value={readiness.readinessPercent || 0}
                  tone={readiness.readinessPercent >= 70 ? "green" : readiness.readinessPercent >= 40 ? "gold" : "primary"}
                  aria-label="Career readiness"
                />
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-muted/50 p-2.5">
                    <dt className="text-xs text-muted-foreground">Assessed skills</dt>
                    <dd className="font-semibold tnum">
                      {readiness.assessedSkills ?? 0} / {readiness.totalSkills ?? 0}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2.5">
                    <dt className="text-xs text-muted-foreground">Targets met</dt>
                    <dd className="font-semibold tnum">
                      {readiness.metSkills ?? 0} / {readiness.totalSkills ?? 0}
                    </dd>
                  </div>
                </dl>
                <GapList title="Strengths" gaps={readiness.strengths} empty="No strengths measured yet." />
                <GapList title="Improvements" gaps={readiness.improvements} empty="No improvement areas yet." />
              </>
            ) : (
              <EmptyState
                compact
                icon={Target}
                title="No target career"
                description="Readiness is unavailable until the student selects a target career and submits an assessment."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assessment history</CardTitle>
            <CardDescription>Submitted attempts, newest first.</CardDescription>
          </CardHeader>
          <CardContent>
            {detail?.assessmentHistory?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="py-2 pr-3 font-semibold">Assessment</th>
                      <th className="py-2 pr-3 font-semibold">Score</th>
                      <th className="py-2 font-semibold">Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.assessmentHistory.map((attempt) => (
                      <tr key={attempt.attemptId} className="border-b border-border/40 last:border-0">
                        <td className="py-2.5 pr-3">
                          <p className="font-medium">{attempt.assessmentTitle}</p>
                          <p className="text-xs text-muted-foreground">{attempt.careerName || "—"}</p>
                        </td>
                        <td className="tnum py-2.5 pr-3 font-semibold">
                          {attempt.overallScore == null ? "—" : `${attempt.overallScore}%`}
                        </td>
                        <td className="py-2.5 text-xs text-muted-foreground">
                          {formatDateTime(attempt.submittedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState compact icon={FileText} title="No submitted assessments" description="Attempts appear here after the student submits an assessment." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Roadmap</CardTitle>
            <CardDescription>
              {roadmap?.hasTarget ? `${roadmap.completedItems ?? 0} of ${roadmap.totalItems ?? 0} steps completed` : "No target career"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {roadmap?.hasTarget ? (
              <>
                <Progress value={roadmap.progressPercent || 0} tone="green" aria-label="Roadmap progress" />
                <div className="space-y-3">
                  {(roadmap.phases || []).map((phase) => (
                    <div key={phase.phaseId}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{phase.title}</p>
                        <span className="tnum text-xs text-muted-foreground">
                          {phase.completedItems ?? 0}/{phase.totalItems ?? 0}
                        </span>
                      </div>
                      <ul className="mt-1 space-y-1">
                        {(phase.items || []).slice(0, 6).map((item) => (
                          <li key={item.itemId} className="flex items-center justify-between gap-2 text-xs">
                            <span className="truncate text-muted-foreground">{item.title}</span>
                            <Badge variant="outline">{labelOf(item.status)}</Badge>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState compact icon={Route} title="No roadmap" description="A roadmap is generated after a target career is selected." />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Projects</CardTitle>
            <CardDescription>
              {projects?.hasTarget
                ? `${projects.completedProjects ?? 0} completed · ${projects.inProgressProjects ?? 0} in progress`
                : "No target career"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {projects?.projects?.length ? (
              <ul className="space-y-2">
                {projects.projects.map((project) => (
                  <li key={project.projectId} className="flex items-center justify-between gap-2 border-b border-border/40 py-2 text-sm last:border-0">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{project.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {[labelOf(project.difficulty), project.estimatedWeeks ? `${project.estimatedWeeks} weeks` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <Badge variant="outline">{labelOf(project.status)}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={FileText} title="No project recommendations" description="Projects appear after a target career is selected." />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">CV and LinkedIn analysis</CardTitle>
            <CardDescription>Summaries only. CV file contents are never shown.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!permissions.canViewCvAnalysis ? (
              <p className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
                <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                CV and LinkedIn analysis are hidden for faculty accounts.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <FileText className="size-3.5" aria-hidden="true" /> CV
                    </p>
                    {cv?.hasCv ? (
                      <>
                        <p className="mt-1 text-2xl font-bold tnum">{cv.overallScore ?? "—"}%</p>
                        <p className="text-xs text-muted-foreground">Overall · ATS {cv.atsScore ?? "—"}%</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {cv.matchedSkills?.length || 0} matched · {cv.missingSkills?.length || 0} missing
                        </p>
                      </>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">No CV uploaded.</p>
                    )}
                  </div>
                  <div className="rounded-lg border border-border/60 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Share2 className="size-3.5" aria-hidden="true" /> LinkedIn
                    </p>
                    {linkedin?.hasProfile ? (
                      <>
                        <p className="mt-1 text-2xl font-bold tnum">{linkedin.alignmentPercent ?? "—"}%</p>
                        <p className="text-xs text-muted-foreground">Alignment · {linkedin.completenessPercent ?? "—"}% complete</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {linkedin.matchedSkills?.length || 0} matched · {linkedin.missingSkills?.length || 0} missing
                        </p>
                      </>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">No LinkedIn profile saved.</p>
                    )}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <GapList title="CV missing skills" gaps={cv?.missingSkills} empty="No CV gap data." />
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      LinkedIn suggestions
                    </p>
                    {linkedin?.suggestions?.length ? (
                      <ul className="space-y-1.5">
                        {linkedin.suggestions.slice(0, 6).map((suggestion, index) => (
                          <li key={`${suggestion}-${index}`} className="text-xs text-muted-foreground">
                            {suggestion}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">No LinkedIn suggestions.</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />
      <p className="text-[11px] text-muted-foreground">
        Generated {formatDateTime(detail?.generatedAt)} · <Gauge className="inline size-3" aria-hidden="true" /> Readiness and
        gap values are computed from live assessment data.
      </p>
    </div>
  );
}
