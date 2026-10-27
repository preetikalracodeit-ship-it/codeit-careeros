"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Search,
  Upload,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Breadcrumb } from "@/components/breadcrumb";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import api from "@/lib/api";
import { downloadFile } from "@/lib/download";
import { ENROLLMENT_STATUSES, enrollmentTone, labelOf } from "@/lib/college";
import { prettifyEnum } from "@/lib/format";
import { cn } from "cn";

const PAGE_SIZE = 20;

export default function CollegeStudentsPage() {
  const searchParams = useSearchParams();
  const [me, setMe] = useState(null);
  const [structure, setStructure] = useState(null);
  const [result, setResult] = useState(null);
  const [accessLoading, setAccessLoading] = useState(true);
  const [accessError, setAccessError] = useState("");
  const [page, setPage] = useState(0);
  const [academicYearId, setAcademicYearId] = useState(() => searchParams.get("academicYearId") || "");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState(() => searchParams.get("departmentId") || "");
  const [programId, setProgramId] = useState(() => searchParams.get("programId") || "");
  const [batchId, setBatchId] = useState(() => searchParams.get("batchId") || "");
  const [status, setStatus] = useState(() => searchParams.get("status") || "");
  const [assessmentCompleted, setAssessmentCompleted] = useState(() => searchParams.get("assessmentCompleted") || "");
  const [readinessEvaluated, setReadinessEvaluated] = useState(() => searchParams.get("readinessEvaluated") || "");
  const [assessmentDateFrom, setAssessmentDateFrom] = useState(() => searchParams.get("assessmentDateFrom") || "");
  const [assessmentDateTo, setAssessmentDateTo] = useState(() => searchParams.get("assessmentDateTo") || "");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    let ignore = false;
    api.get("/college/me")
      .then(async (meData) => {
        if (ignore) return;
        setMe(meData);
        if (!meData?.permissions?.includes("VIEW_STUDENTS")) {
          setAccessError("Your college role does not have permission to view student records.");
          return;
        }
        const structureData = await api.get("/college/structure");
        if (ignore) return;
        setStructure(structureData);
      })
      .catch((err) => {
        if (!ignore) setAccessError(err.message || "Failed to verify your college access.");
      })
      .finally(() => {
        if (!ignore) setAccessLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const params = useMemo(() => {
    const values = { page, size: PAGE_SIZE };
    if (search.trim()) values.search = search.trim();
    if (academicYearId) values.academicYearId = academicYearId;
    if (departmentId) values.departmentId = departmentId;
    if (programId) values.programId = programId;
    if (batchId) values.batchId = batchId;
    if (status) values.status = status;
    if (assessmentCompleted) values.assessmentCompleted = assessmentCompleted;
    if (readinessEvaluated) values.readinessEvaluated = readinessEvaluated;
    if (assessmentDateFrom) values.assessmentDateFrom = assessmentDateFrom;
    if (assessmentDateTo) values.assessmentDateTo = assessmentDateTo;
    return values;
  }, [page, search, academicYearId, departmentId, programId, batchId, status, assessmentCompleted, readinessEvaluated, assessmentDateFrom, assessmentDateTo]);

  const load = useCallback(async () => {
    if (!me?.permissions?.includes("VIEW_STUDENTS")) return;
    const currentRequestId = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const data = await api.get("/college/students", { params });
      if (currentRequestId !== requestId.current) return;
      setResult(data);
    } catch (err) {
      if (currentRequestId !== requestId.current) return;
      setError(err.message || "Failed to load students.");
    } finally {
      if (currentRequestId === requestId.current) setLoading(false);
    }
  }, [me, params]);

  useEffect(() => {
    if (!me?.permissions?.includes("VIEW_STUDENTS")) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async scoped list loader; state updates happen in promise callbacks
    load();
  }, [load, me]);

  function applySearch(event) {
    event.preventDefault();
    setPage(0);
    setSearch(searchInput);
  }

  function changeFilter(setter, value) {
    setter(value);
    setPage(0);
  }

  async function exportCsv() {
    setExporting(true);
    setError("");
    try {
      const exportParams = { ...params };
      delete exportParams.page;
      delete exportParams.size;
      await downloadFile("/college/students/export.csv", exportParams, "careeros-students.csv");
    } catch (err) {
      setError(err.message || "Failed to export students.");
    } finally {
      setExporting(false);
    }
  }

  const departmentOptions = useMemo(
    () => [
      { value: "", label: "All departments" },
      ...(structure?.departments || []).map((department) => ({
        value: String(department.id),
        label: `${department.code} · ${department.name}`,
      })),
    ],
    [structure],
  );

  const academicYearOptions = useMemo(
    () => [
      { value: "", label: "All academic years" },
      ...(structure?.academicYears || []).map((year) => ({ value: String(year.id), label: year.label })),
    ],
    [structure],
  );

  const programOptions = useMemo(
    () => [
      { value: "", label: "All programs" },
      ...(structure?.programs || [])
        .filter((program) => !departmentId || String(program.departmentId) === departmentId)
        .map((program) => ({ value: String(program.id), label: `${program.code} · ${program.name}` })),
    ],
    [departmentId, structure],
  );

  const batchOptions = useMemo(
    () => [
      { value: "", label: "All batches" },
      ...(structure?.batches || [])
        .filter((batch) => !programId || String(batch.programId) === programId)
        .map((batch) => ({ value: String(batch.id), label: batch.label })),
    ],
    [programId, structure],
  );

  const canExport = me?.permissions?.includes("EXPORT_STUDENTS");
  const canImport = me?.permissions?.includes("IMPORT_STUDENTS");
  const items = result?.items || [];

  if (accessLoading) return <LoadingState label="Checking student access…" />;

  if (accessError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Students" breadcrumb={<Breadcrumb items={[{ label: "Students" }]} />} />
        <ErrorState title="Student records are unavailable" description={accessError} />
      </div>
    );
  }

  if (loading && !result) return <LoadingState label="Loading students…" />;

  if (error && !result) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Students"
          description="Students inside your institution and academic scope."
          breadcrumb={<Breadcrumb items={[{ label: "Students" }]} />}
        />
        <ErrorState title="Couldn't load students" description={error} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        description={
          result
            ? `${result.totalElements} student${result.totalElements === 1 ? "" : "s"} in your scope.`
            : "Students inside your institution and academic scope."
        }
        breadcrumb={<Breadcrumb items={[{ label: "Students" }]} />}
        actions={
          <>
            {canImport && (
              <Button variant="outline" size="sm" render={<Link href="/college/import" />}>
                <Upload className="size-3.5" aria-hidden="true" />
                Import CSV
              </Button>
            )}
            {canExport && (
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={exporting || items.length === 0}>
                <Download className="size-3.5" aria-hidden="true" />
                {exporting ? "Exporting…" : "Export CSV"}
              </Button>
            )}
          </>
        }
      />

      <Card>
        <CardContent className="space-y-4 p-4">
          <form onSubmit={applySearch} className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search name, roll number or student ID"
                aria-label="Search students"
                className="h-10 pl-9"
              />
            </div>
            <Select
              aria-label="Filter by academic year"
              value={academicYearId}
              onChange={(event) => changeFilter(setAcademicYearId, event.target.value)}
              options={academicYearOptions}
            />
            <Select
              aria-label="Filter by department"
              value={departmentId}
              onChange={(event) => {
                setDepartmentId(event.target.value);
                setProgramId("");
                setBatchId("");
                setPage(0);
              }}
              options={departmentOptions}
            />
            <Select
              aria-label="Filter by program"
              value={programId}
              onChange={(event) => {
                setProgramId(event.target.value);
                setBatchId("");
                setPage(0);
              }}
              options={programOptions}
            />
            <Select
              aria-label="Filter by batch"
              value={batchId}
              onChange={(event) => changeFilter(setBatchId, event.target.value)}
              options={batchOptions}
            />
            <Select
              aria-label="Filter by enrollment status"
              value={status}
              onChange={(event) => changeFilter(setStatus, event.target.value)}
              options={[
                { value: "", label: "All statuses" },
                ...ENROLLMENT_STATUSES.map((value) => ({ value, label: prettifyEnum(value) })),
              ]}
            />
            <Select
              aria-label="Filter by assessment status"
              value={assessmentCompleted}
              onChange={(event) => changeFilter(setAssessmentCompleted, event.target.value)}
              options={[
                { value: "", label: "All assessment statuses" },
                { value: "true", label: "Assessed" },
                { value: "false", label: "Not assessed" },
              ]}
            />
            <Select
              aria-label="Filter by readiness status"
              value={readinessEvaluated}
              onChange={(event) => changeFilter(setReadinessEvaluated, event.target.value)}
              options={[
                { value: "", label: "All readiness statuses" },
                { value: "true", label: "Readiness evaluated" },
                { value: "false", label: "Readiness unavailable" },
              ]}
            />
            <label className="space-y-1 text-sm font-medium">
              <span>Assessment submitted from</span>
              <Input type="date" value={assessmentDateFrom} onChange={(event) => changeFilter(setAssessmentDateFrom, event.target.value)} />
            </label>
            <label className="space-y-1 text-sm font-medium">
              <span>Assessment submitted through</span>
              <Input type="date" value={assessmentDateTo} onChange={(event) => changeFilter(setAssessmentDateTo, event.target.value)} />
            </label>
            <Button type="submit" className="h-10">
              Search
            </Button>
          </form>

          {items.length === 0 ? (
            <EmptyState
              icon={Users}
              title={search || departmentId || status ? "No students match these filters" : "No students enrolled yet"}
              description={
                search || departmentId || status
                  ? "Clear or adjust the filters and try again."
                  : "Import a CSV or ask students to enroll to see them here."
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-2.5 pr-3 font-semibold">Student</th>
                    <th className="py-2.5 pr-3 font-semibold">Roll number</th>
                    <th className="py-2.5 pr-3 font-semibold">Department / Program</th>
                    <th className="py-2.5 pr-3 font-semibold">Batch / Section</th>
                    <th className="py-2.5 pr-3 font-semibold">Status</th>
                    <th className="py-2.5 pr-3 font-semibold">Target career</th>
                    <th className="py-2.5 pr-3 font-semibold">Readiness</th>
                    <th className="py-2.5 font-semibold">Assessment</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((student) => (
                    <tr key={student.id} className="border-b border-border/40 transition last:border-0 hover:bg-accent/40">
                      <td className="py-3 pr-3">
                        <Link
                          href={`/college/students/${student.id}`}
                          className="font-semibold text-primary hover:underline"
                        >
                          {student.fullName || "Unnamed student"}
                        </Link>
                        {student.email && <p className="text-xs text-muted-foreground">{student.email}</p>}
                      </td>
                      <td className="tnum py-3 pr-3">{student.rollNumber}</td>
                      <td className="py-3 pr-3">
                        <p className="font-medium">{student.departmentName || "—"}</p>
                        <p className="text-xs text-muted-foreground">{student.programName || "—"}</p>
                      </td>
                      <td className="py-3 pr-3">
                        <p>{student.batchLabel || "—"}</p>
                        <p className="text-xs text-muted-foreground">{student.sectionName || "—"}</p>
                      </td>
                      <td className="py-3 pr-3">
                        <Badge className={cn("border-0", enrollmentTone(student.status))}>
                          {labelOf(student.status)}
                        </Badge>
                      </td>
                      <td className="py-3 pr-3">{student.targetCareerName || "—"}</td>
                      <td className="tnum py-3 pr-3 font-semibold">
                        {student.readinessPercent == null ? "—" : `${student.readinessPercent}%`}
                      </td>
                      <td className="py-3">
                        <Badge variant={student.assessmentCompleted ? "secondary" : "outline"}>
                          {student.assessmentCompleted ? "Completed" : "Not yet"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result && result.totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 pt-1">
              <p className="tnum text-xs text-muted-foreground">
                Page {result.page + 1} of {result.totalPages} · {result.totalElements} total
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 0 || loading}
                  onClick={() => setPage((value) => Math.max(0, value - 1))}
                >
                  <ArrowLeft className="size-3.5" aria-hidden="true" />
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= result.totalPages - 1 || loading}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {error && result && (
        <p role="alert" className="text-xs font-semibold text-destructive">
          {error}{" "}
          <button type="button" className="underline" onClick={load}>
            Retry
          </button>
        </p>
      )}
    </div>
  );
}
