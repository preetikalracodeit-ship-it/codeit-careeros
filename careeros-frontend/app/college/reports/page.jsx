"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, FileBarChart, FileText, ShieldCheck, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Breadcrumb } from "@/components/breadcrumb";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import api from "@/lib/api";
import { downloadFile } from "@/lib/download";
import { ENROLLMENT_STATUSES } from "@/lib/college";
import { prettifyEnum } from "@/lib/format";

export default function CollegeReportsPage() {
  const [me, setMe] = useState(null);
  const [structure, setStructure] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [reportType, setReportType] = useState("roster");
  const [filters, setFilters] = useState({ academicYearId: "", departmentId: "", status: "", assessmentDateFrom: "", assessmentDateTo: "" });

  useEffect(() => {
    let ignore = false;
    Promise.all([api.get("/college/me"), api.get("/college/structure")])
      .then(([meData, structureData]) => {
        if (ignore) return;
        setMe(meData);
        setStructure(structureData);
      })
      .catch((err) => {
        if (!ignore) setError(err.message || "Failed to load report access.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const canReport = me?.permissions?.includes("GENERATE_REPORTS");
  const canExport = me?.permissions?.includes("EXPORT_STUDENTS");

  const params = useMemo(() => {
    const values = {};
    if (filters.academicYearId) values.academicYearId = filters.academicYearId;
    if (filters.departmentId) values.departmentId = filters.departmentId;
    if (filters.status) values.status = filters.status;
    if (filters.assessmentDateFrom) values.assessmentDateFrom = filters.assessmentDateFrom;
    if (filters.assessmentDateTo) values.assessmentDateTo = filters.assessmentDateTo;
    return values;
  }, [filters]);

  async function downloadCohort() {
    setDownloading(true);
    setError("");
    try {
      await downloadFile("/college/reports/cohort.pdf", params, "careeros-cohort-report.pdf");
    } catch (err) {
      setError(err.message || "Could not generate the cohort report.");
    } finally {
      setDownloading(false);
    }
  }

  async function downloadCsvReport() {
    setDownloading(true);
    setError("");
    try {
      const filename = `careeros-${reportType}.csv`;
      await downloadFile("/college/reports/export.csv", { ...params, type: reportType }, filename);
    } catch (err) {
      setError(err.message || "Could not download the CSV report.");
    } finally {
      setDownloading(false);
    }
  }

  if (loading) return <LoadingState label="Checking report access…" />;

  if (!canReport) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Reports"
          description="Scoped cohort and student reports."
          breadcrumb={<Breadcrumb items={[{ label: "Reports" }]} />}
        />
        <ErrorState
          title="Reports are not available for your role"
          description={error || "Faculty accounts can view students but cannot generate institution reports."}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Cohort summaries and Student 360 PDFs from live data. CV file contents are never included."
        breadcrumb={<Breadcrumb items={[{ label: "Reports" }]} />}
        actions={
          <Button variant="outline" size="sm" render={<Link href="/college/students" />}>
            <Users className="size-3.5" aria-hidden="true" />
            Students
          </Button>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileBarChart className="size-4" aria-hidden="true" />
            Cohort report
          </CardTitle>
          <CardDescription>
            PDF with enrollment, assessment participation, readiness and common gaps for the selected scope.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <Select
              label="Academic year"
              value={filters.academicYearId}
              onChange={(event) => setFilters((prev) => ({ ...prev, academicYearId: event.target.value }))}
              options={[
                { value: "", label: "All academic years" },
                ...(structure?.academicYears || []).map((year) => ({ value: String(year.id), label: year.label })),
              ]}
            />
            <Select
              label="Department"
              value={filters.departmentId}
              onChange={(event) => setFilters((prev) => ({ ...prev, departmentId: event.target.value }))}
              options={[
                { value: "", label: "All departments" },
                ...(structure?.departments || []).map((department) => ({
                  value: String(department.id),
                  label: `${department.code} · ${department.name}`,
                })),
              ]}
            />
            <Select
              label="Enrollment status"
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
              options={[
                { value: "", label: "All statuses" },
                ...ENROLLMENT_STATUSES.map((value) => ({ value, label: prettifyEnum(value) })),
              ]}
            />
            <label className="space-y-1 text-sm font-medium">
              <span>Assessment submitted from</span>
              <Input type="date" value={filters.assessmentDateFrom} onChange={(event) => setFilters((prev) => ({ ...prev, assessmentDateFrom: event.target.value }))} />
            </label>
            <label className="space-y-1 text-sm font-medium">
              <span>Assessment submitted through</span>
              <Input type="date" value={filters.assessmentDateTo} onChange={(event) => setFilters((prev) => ({ ...prev, assessmentDateTo: event.target.value }))} />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={downloadCohort} disabled={downloading}>
              <Download className="size-3.5" aria-hidden="true" />
              {downloading ? "Generating…" : "Download cohort PDF"}
            </Button>
            {canExport && (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Select
                  label="CSV report"
                  value={reportType}
                  onChange={(event) => setReportType(event.target.value)}
                  options={[
                    { value: "roster", label: "Student roster" },
                    { value: "assessment-completion", label: "Assessment completion" },
                    { value: "readiness-summary", label: "Student readiness summary" },
                    { value: "department-skill-gaps", label: "Department skill gaps" },
                    { value: "batch-assessment-coverage", label: "Batch assessment coverage" },
                  ]}
                />
                <Button variant="outline" className="self-end" onClick={downloadCsvReport} disabled={downloading}>
                <Download className="size-3.5" aria-hidden="true" />
                  {downloading ? "Preparing…" : "Download CSV"}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="size-4" aria-hidden="true" />
              Student 360 PDF
            </CardTitle>
            <CardDescription>
              Open a student from the Students page and use the Student 360 PDF action. The report respects the same
              institution and department scope.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" render={<Link href="/college/students" />}>
              Choose a student
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4" aria-hidden="true" />
              What is excluded
            </CardTitle>
            <CardDescription>Reports never widen access or leak raw documents.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>No CV file contents or uploaded document bytes.</li>
              <li>No passwords, tokens, invitation secrets or full PII beyond the report scope.</li>
              <li>No cross-institution rows; filters can only narrow the server-derived scope.</li>
              <li>Every report download is recorded in the audit trail.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
