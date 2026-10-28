"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Building2,
  ClipboardCheck,
  ClipboardList,
  Gauge,
  RefreshCw,
  TrendingUp,
  Users,
  UserCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Breadcrumb } from "@/components/breadcrumb";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import api from "@/lib/api";
import { designationLabel, ENROLLMENT_STATUSES } from "@/lib/college";
import { formatDateTime, prettifyEnum } from "@/lib/format";

const emptyFilters = {
  academicYearId: "",
  departmentId: "",
  programId: "",
  batchId: "",
  sectionId: "",
  status: "",
  assessmentCompleted: "",
  assessmentDateFrom: "",
  assessmentDateTo: "",
};

function metricLabel(value) {
  if (!value) return "Metric";
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (character) => character.toUpperCase());
}

export default function CollegeDashboardPage() {
  const [me, setMe] = useState(null);
  const [structure, setStructure] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [filters, setFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    let ignore = false;
    Promise.all([api.get("/college/me"), api.get("/college/structure")])
      .then(([meData, structureData]) => {
        if (ignore) return;
        setMe(meData);
        setStructure(structureData);
      })
      .catch((err) => {
        if (!ignore) setError(err.message || "Failed to load your college membership.");
      });
    return () => {
      ignore = true;
    };
  }, []);

  const load = useCallback(async () => {
    const currentRequestId = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, value]) => value !== "" && value != null),
      );
      const data = await api.get("/college/dashboard", { params });
      if (currentRequestId !== requestId.current) return;
      setDashboard(data);
    } catch (err) {
      if (currentRequestId !== requestId.current) return;
      setError(err.message || "Failed to load the institution dashboard.");
    } finally {
      if (currentRequestId === requestId.current) setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async dashboard loader; state updates happen in promise callbacks
    load();
  }, [load]);

  const academicYearOptions = useMemo(
    () => [
      { value: "", label: "All academic years" },
      ...(structure?.academicYears || []).map((year) => ({
        value: String(year.id),
        label: year.label,
      })),
    ],
    [structure],
  );

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

  const programOptions = useMemo(
    () => [
      { value: "", label: "All programs" },
      ...(structure?.programs || [])
        .filter((program) => !filters.departmentId || String(program.departmentId) === filters.departmentId)
        .map((program) => ({ value: String(program.id), label: `${program.code} · ${program.name}` })),
    ],
    [filters.departmentId, structure],
  );

  const batchOptions = useMemo(
    () => [
      { value: "", label: "All batches" },
      ...(structure?.batches || [])
        .filter((batch) => !filters.programId || String(batch.programId) === filters.programId)
        .map((batch) => ({ value: String(batch.id), label: batch.label })),
    ],
    [filters.programId, structure],
  );

  const sectionOptions = useMemo(
    () => [
      { value: "", label: "All sections" },
      ...(structure?.sections || [])
        .filter((section) => !filters.batchId || String(section.batchId) === filters.batchId)
        .map((section) => ({ value: String(section.id), label: section.name })),
    ],
    [filters.batchId, structure],
  );

  function studentHref(overrides = {}) {
    const values = { ...filters, ...overrides };
    const params = new URLSearchParams();
    Object.entries(values).forEach(([key, value]) => {
      if (value !== "" && value != null) params.set(key, value);
    });
    const query = params.toString();
    return `/college/students${query ? `?${query}` : ""}`;
  }

  if (loading && !dashboard) return <LoadingState label="Loading institution dashboard…" />;

  if (error && !dashboard) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="College Overview"
          description="Scoped institution analytics."
          breadcrumb={<Breadcrumb items={[{ label: "Dashboard" }]} />}
        />
        <ErrorState title="Couldn't load the dashboard" description={error} onRetry={load} />
      </div>
    );
  }

  const maxBand = Math.max(1, ...(dashboard?.readinessDistribution || []).map((band) => band.students));

  return (
    <div className="space-y-6">
      <PageHeader
        title="College Overview"
        description={
          me
            ? `${me.institutionName} · ${designationLabel(me.designation)} · ${me.scopeLabel || "Institution-wide"}`
            : "Scoped institution analytics."
        }
        breadcrumb={<Breadcrumb items={[{ label: "Dashboard" }]} />}
        actions={
          <>
            {me && <Badge variant="secondary">{designationLabel(me.designation)}</Badge>}
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={loading ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden="true" />
              Refresh
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          <Select
            label="Academic year"
            value={filters.academicYearId}
            onChange={(event) => setFilters((prev) => ({ ...prev, academicYearId: event.target.value }))}
            options={academicYearOptions}
          />
          <Select
            label="Department"
            value={filters.departmentId}
            onChange={(event) => setFilters((prev) => ({
              ...prev,
              departmentId: event.target.value,
              programId: "",
              batchId: "",
              sectionId: "",
            }))}
            options={departmentOptions}
          />
          <Select
            label="Program"
            value={filters.programId}
            onChange={(event) => setFilters((prev) => ({ ...prev, programId: event.target.value, batchId: "", sectionId: "" }))}
            options={programOptions}
          />
          <Select
            label="Batch"
            value={filters.batchId}
            onChange={(event) => setFilters((prev) => ({ ...prev, batchId: event.target.value, sectionId: "" }))}
            options={batchOptions}
          />
          <Select
            label="Section"
            value={filters.sectionId}
            onChange={(event) => setFilters((prev) => ({ ...prev, sectionId: event.target.value }))}
            options={sectionOptions}
          />
          <Select
            label="Enrollment status"
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            options={[
              { value: "", label: "All statuses" },
              ...ENROLLMENT_STATUSES.map((status) => ({ value: status, label: prettifyEnum(status) })),
            ]}
          />
          <Select
            label="Assessment status"
            value={filters.assessmentCompleted}
            onChange={(event) => setFilters((prev) => ({
              ...prev,
              assessmentCompleted: event.target.value,
              assessmentDateFrom: "",
              assessmentDateTo: "",
            }))}
            options={[
              { value: "", label: "All students" },
              { value: "true", label: "Assessed" },
              { value: "false", label: "Not assessed" },
            ]}
          />
          <label className="space-y-1 text-sm font-medium">
            <span>Assessment submitted from</span>
            <Input type="date" value={filters.assessmentDateFrom} onChange={(event) => setFilters((prev) => ({ ...prev, assessmentDateFrom: event.target.value, assessmentCompleted: "" }))} />
          </label>
          <label className="space-y-1 text-sm font-medium">
            <span>Assessment submitted through</span>
            <Input type="date" value={filters.assessmentDateTo} onChange={(event) => setFilters((prev) => ({ ...prev, assessmentDateTo: event.target.value, assessmentCompleted: "" }))} />
          </label>
        </CardContent>
      </Card>

      {error && dashboard && (
        <p role="alert" className="text-xs font-semibold text-destructive">
          Refresh failed: {error}{" "}
          <button type="button" className="underline" onClick={load}>
            Retry
          </button>
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          icon={Users}
          label="Enrolled students"
          value={dashboard?.totalEnrolled ?? "—"}
          sub="In the current scope"
          href={studentHref()}
          tone="primary"
        />
        <StatCard
          icon={UserCheck}
          label="Active students"
          value={dashboard?.activeStudents ?? "—"}
          sub="Enrollment status ACTIVE"
          href={studentHref({ status: "ACTIVE" })}
          tone="green"
        />
        <StatCard
          icon={ClipboardCheck}
          label="Assessed students"
          value={dashboard?.assessmentParticipants ?? "—"}
          sub={
            dashboard?.assessmentCompletionPercent == null
              ? "Completion unavailable"
              : `${dashboard.assessmentCompletionPercent}% of active students`
          }
          href={studentHref({ status: "ACTIVE", assessmentCompleted: "true", readinessEvaluated: "" })}
          tone="gold"
        />
        <StatCard
          icon={ClipboardList}
          label="Not assessed"
          value={dashboard?.studentsNotAssessed ?? "—"}
          sub="Active students with no submitted assessment"
          href={studentHref({ status: "ACTIVE", assessmentCompleted: "false", readinessEvaluated: "" })}
          tone="muted"
        />
        <StatCard
          icon={Gauge}
          label="Readiness evaluated"
          value={dashboard?.readinessEvaluated ?? "—"}
          sub={
            dashboard?.readinessUnavailable
              ? `${dashboard.readinessUnavailable} without enough assessment data`
              : "Students with a target career and submitted attempts"
          }
          href={studentHref({
            status: "ACTIVE",
            assessmentCompleted: "",
            readinessEvaluated: "true",
          })}
          tone="muted"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Readiness distribution</CardTitle>
            <CardDescription>
              Bands are computed from real skill scores against the student&apos;s target career.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dashboard?.readinessDistribution?.length ? (
              <ul className="space-y-4">
                {dashboard.readinessDistribution.map((band) => (
                  <li key={band.band}>
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium">{band.band}</span>
                      <span className="tnum text-xs text-muted-foreground">{band.students} students</span>
                    </div>
                    <Progress
                      value={(band.students / maxBand) * 100}
                      tone={band.band === "75-100%" ? "green" : band.band === "50-74%" ? "gold" : "primary"}
                      aria-label={`${band.band}: ${band.students} students`}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                compact
                icon={Gauge}
                title="No readiness data yet"
                description="Students appear here after they choose a target career and submit an assessment."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Most common skill gaps</CardTitle>
            <CardDescription>
              Skills where the most assessed students are below the career target.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dashboard?.commonGaps?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="py-2 pr-3 font-semibold">Skill</th>
                      <th className="py-2 pr-3 font-semibold">Below target</th>
                      <th className="py-2 font-semibold">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.commonGaps.map((gap) => (
                      <tr key={gap.skillId} className="border-b border-border/40 last:border-0">
                        <td className="py-2.5 pr-3 font-medium">
                          <Link
                            href={studentHref({
                              status: "ACTIVE",
                              assessmentCompleted: "true",
                              readinessEvaluated: "true",
                              skillId: gap.skillId,
                              skillName: gap.skillName,
                            })}
                            className="text-primary hover:underline"
                          >
                            {gap.skillName}
                          </Link>
                        </td>
                        <td className="tnum py-2.5 pr-3 text-muted-foreground">
                          {gap.studentsBelowTarget} / {gap.assessedStudents}
                        </td>
                        <td className="tnum py-2.5 font-semibold">{gap.percentBelowTarget}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                compact
                icon={TrendingUp}
                title="No skill-gap data yet"
                description="Common gaps appear once students submit assessments with a target career."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Department comparison</CardTitle>
          <CardDescription>Enrollment and readiness by department within your scope.</CardDescription>
        </CardHeader>
        <CardContent>
          {dashboard?.departmentComparisons?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pr-3 font-semibold">Department</th>
                    <th className="py-2 pr-3 font-semibold">Enrolled</th>
                    <th className="py-2 pr-3 font-semibold">Active</th>
                    <th className="py-2 pr-3 font-semibold">Assessed</th>
                    <th className="py-2 pr-3 font-semibold">Readiness evaluated</th>
                    <th className="py-2 font-semibold">Average readiness</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.departmentComparisons.map((row) => (
                    <tr key={row.departmentId} className="border-b border-border/40 last:border-0">
                      <td className="py-2.5 pr-3 font-medium">
                        <Link href={studentHref({ departmentId: String(row.departmentId) })} className="text-primary hover:underline">
                          {row.departmentName}
                        </Link>
                      </td>
                      <td className="tnum py-2.5 pr-3">{row.enrolled}</td>
                      <td className="tnum py-2.5 pr-3">{row.active}</td>
                      <td className="tnum py-2.5 pr-3">{row.assessmentParticipants}</td>
                      <td className="tnum py-2.5 pr-3">{row.readinessEvaluated}</td>
                      <td className="tnum py-2.5 font-semibold">
                        {row.averageReadinessPercent == null ? "—" : `${row.averageReadinessPercent}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              compact
              icon={Building2}
              title="No departments in scope"
              description="Create departments in Academic Structure before students are enrolled."
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Batch assessment coverage</CardTitle>
          <CardDescription>Submitted assessments among active students in each batch.</CardDescription>
        </CardHeader>
        <CardContent>
          {dashboard?.batchComparisons?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pr-3 font-semibold">Batch</th>
                    <th className="py-2 pr-3 font-semibold">Department / Program</th>
                    <th className="py-2 pr-3 font-semibold">Active</th>
                    <th className="py-2 pr-3 font-semibold">Assessed</th>
                    <th className="py-2 font-semibold">Coverage</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.batchComparisons.map((row) => (
                    <tr key={row.batchId} className="border-b border-border/40 last:border-0">
                      <td className="py-2.5 pr-3 font-medium">
                        <Link
                          href={studentHref({ batchId: String(row.batchId) })}
                          className="text-primary hover:underline"
                        >
                          {row.batchLabel}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-3">
                        {row.departmentName} · {row.programName}
                      </td>
                      <td className="tnum py-2.5 pr-3">{row.active}</td>
                      <td className="tnum py-2.5 pr-3">{row.assessmentParticipants}</td>
                      <td className="tnum py-2.5 font-semibold">
                        {row.assessmentCoveragePercent == null ? "—" : `${row.assessmentCoveragePercent}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              compact
              icon={Users}
              title="No batch data"
              description="Create batches in Academic Structure to compare assessment coverage."
            />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard?.trendAvailable ? (
              <p className="text-sm text-muted-foreground">Trend data is available.</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {dashboard?.trendUnavailableReason || "Historical trend data is not available yet."}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Metric definitions</CardTitle>
            <CardDescription>What each number on this page means.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2.5">
              {(dashboard?.definitions || []).map((definition) => (
                <div key={definition.metric}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {metricLabel(definition.metric)}
                  </dt>
                  <dd className="text-sm">{definition.definition}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-[11px] text-muted-foreground">
              Generated {formatDateTime(dashboard?.generatedAt)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
