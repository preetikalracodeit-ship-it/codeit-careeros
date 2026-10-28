"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, RefreshCw, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Breadcrumb } from "@/components/breadcrumb";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import api from "@/lib/api";
import { downloadFile } from "@/lib/download";
import { ENROLLMENT_STATUSES } from "@/lib/college";
import { formatDateTime, prettifyEnum } from "@/lib/format";

const EXPORT_TYPES = [
  { value: "placement-summary", label: "Placement summary" },
  { value: "department-outcomes", label: "Department outcomes" },
  { value: "company-outcomes", label: "Company outcomes" },
  { value: "stage-progress", label: "Stage progress" },
];

function metricLabel(value) {
  if (!value) return "Metric";
  return String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (character) => character.toUpperCase());
}

function pct(value) {
  return value == null ? "Unavailable" : `${value}%`;
}

export default function CollegePlacementAnalyticsPage() {
  const [me, setMe] = useState(null);
  const [structure, setStructure] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [filters, setFilters] = useState({
    academicYearId: "",
    departmentId: "",
    programId: "",
    batchId: "",
    sectionId: "",
    status: "ACTIVE",
    assessmentCompleted: "",
    assessmentDateFrom: "",
    assessmentDateTo: "",
  });
  const [exportType, setExportType] = useState("placement-summary");
  const [loading, setLoading] = useState(true);
  const [accessLoading, setAccessLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let ignore = false;
    Promise.all([api.get("/college/me"), api.get("/college/structure")])
      .then(([meData, structureData]) => {
        if (ignore) return;
        setMe(meData);
        setStructure(structureData);
      })
      .catch((err) => {
        if (!ignore) setError(err.message || "Could not load analytics access.");
      })
      .finally(() => {
        if (!ignore) setAccessLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const canView = me?.permissions?.includes("VIEW_PLACEMENT_REPORTS");
  const canExport = me?.permissions?.includes("EXPORT_STUDENTS");

  const params = useMemo(() => {
    const values = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== "" && value != null) values[key] = value;
    });
    return values;
  }, [filters]);

  const load = useCallback(async () => {
    if (!me) return;
    setLoading(true);
    setError("");
    try {
      setAnalytics(await api.get("/college/placement/analytics", { params }));
    } catch (err) {
      setError(err.message || "Could not load placement analytics.");
    } finally {
      setLoading(false);
    }
  }, [me, params]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async analytics loader; state updates happen in promise callbacks
    if (canView) load();
  }, [canView, load]);

  const academicYearOptions = useMemo(
    () => [
      { value: "", label: "All academic years" },
      ...(structure?.academicYears || []).map((year) => ({ value: String(year.id), label: year.label })),
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

  async function exportCsv() {
    setExporting(true);
    try {
      await downloadFile(
        "/college/placement/analytics/export.csv",
        { ...params, type: exportType },
        `careeros-${exportType}.csv`,
      );
      toast.success("Placement CSV downloaded.");
    } catch (err) {
      toast.error(err.message || "Could not export placement data.");
    } finally {
      setExporting(false);
    }
  }

  if (accessLoading) return <LoadingState label="Checking placement analytics access..." />;

  if (!me) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Placement Analytics"
          description="Scoped placement outcomes and rates."
          breadcrumb={<Breadcrumb items={[{ label: "Placement", href: "/college/placement" }, { label: "Analytics" }]} />}
        />
        <ErrorState
          title="Could not verify placement analytics access"
          description={error || "Reload the page to try again."}
        />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Placement Analytics"
          description="Scoped placement outcomes and rates."
          breadcrumb={<Breadcrumb items={[{ label: "Placement", href: "/college/placement" }, { label: "Analytics" }]} />}
        />
        <ErrorState
          title="Placement analytics are not available for your role"
          description="Faculty accounts do not have access to placement data in this phase."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Placement Analytics"
        description="Outcome metrics use distinct students for offers and joining. Every rate has a documented denominator."
        breadcrumb={<Breadcrumb items={[{ label: "Placement", href: "/college/placement" }, { label: "Analytics" }]} />}
        actions={
          <>
            <Button variant="outline" size="sm" render={<Link href="/college/placement" />}>
              Placement workspace
            </Button>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={loading ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden="true" />
              Refresh
            </Button>
            {canExport && (
              <Button size="sm" onClick={exportCsv} disabled={exporting}>
                <Download className="size-3.5" aria-hidden="true" />
                {exporting ? "Exporting..." : "Export CSV"}
              </Button>
            )}
          </>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <Select
            label="Academic year"
            value={filters.academicYearId}
            onChange={(event) => setFilters((prev) => ({ ...prev, academicYearId: event.target.value }))}
            options={academicYearOptions}
          />
          <Select
            label="Department"
            value={filters.departmentId}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                departmentId: event.target.value,
                programId: "",
                batchId: "",
                sectionId: "",
              }))
            }
            options={departmentOptions}
          />
          <Select
            label="Program"
            value={filters.programId}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, programId: event.target.value, batchId: "", sectionId: "" }))
            }
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
            onChange={(event) => setFilters((prev) => ({ ...prev, assessmentCompleted: event.target.value }))}
            options={[
              { value: "", label: "All students" },
              { value: "true", label: "Assessed" },
              { value: "false", label: "Not assessed" },
            ]}
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-sm font-medium">
              <span>Assessed from</span>
              <Input
                type="date"
                value={filters.assessmentDateFrom}
                onChange={(event) => setFilters((prev) => ({ ...prev, assessmentDateFrom: event.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              <span>Assessed through</span>
              <Input
                type="date"
                value={filters.assessmentDateTo}
                onChange={(event) => setFilters((prev) => ({ ...prev, assessmentDateTo: event.target.value }))}
              />
            </label>
          </div>
        </CardContent>
      </Card>

      {loading && !analytics ? (
        <LoadingState label="Loading placement analytics..." />
      ) : !analytics ? (
        <EmptyState
          icon={TrendingUp}
          title="No analytics available"
          description="Adjust the filters or check that students, drives and applications exist in this scope."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={TrendingUp}
              label="Eligible graduating"
              value={analytics.eligibleGraduatingStudents}
              sub="Active students in graduating batches"
              tone="primary"
            />
            <StatCard
              icon={TrendingUp}
              label="Drive participants"
              value={analytics.driveParticipants}
              sub={`${pct(analytics.participationRate)} participation`}
              tone="gold"
            />
            <StatCard
              icon={TrendingUp}
              label="Students with offer"
              value={analytics.studentsWithOffer}
              sub={`${analytics.offersMade} offer record${analytics.offersMade === 1 ? "" : "s"} · ${pct(analytics.offerRate)} offer rate`}
              tone="green"
            />
            <StatCard
              icon={TrendingUp}
              label="Joined students"
              value={analytics.joinedStudents}
              sub={`${pct(analytics.placementRate)} placement rate`}
              tone="muted"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Applications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Total</span>
                  <span className="tnum font-semibold">{analytics.totalApplications}</span>
                </p>
                <p className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Active</span>
                  <span className="tnum font-semibold">{analytics.activeApplications}</span>
                </p>
                <p className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Accepted offers</span>
                  <span className="tnum font-semibold">{analytics.acceptedOffers}</span>
                </p>
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Denominator</CardTitle>
                <CardDescription>Every percentage above uses this definition.</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{analytics.denominatorDefinition}</p>
                <p className="mt-2 text-xs text-muted-foreground">Generated {formatDateTime(analytics.generatedAt)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Department outcomes</CardTitle>
              <CardDescription>Distinct-student counts within each department in scope.</CardDescription>
            </CardHeader>
            <CardContent>
              {analytics.departmentOutcomes?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[780px] text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="py-2.5 pr-3 font-semibold">Department</th>
                        <th className="py-2.5 pr-3 font-semibold">Eligible</th>
                        <th className="py-2.5 pr-3 font-semibold">Participants</th>
                        <th className="py-2.5 pr-3 font-semibold">With offer</th>
                        <th className="py-2.5 pr-3 font-semibold">Joined</th>
                        <th className="py-2.5 pr-3 font-semibold">Participation</th>
                        <th className="py-2.5 font-semibold">Placement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.departmentOutcomes.map((row) => (
                        <tr key={row.departmentId} className="border-b border-border/40 last:border-0">
                          <td className="py-3 pr-3 font-medium">{row.departmentName}</td>
                          <td className="tnum py-3 pr-3">{row.eligibleGraduatingStudents}</td>
                          <td className="tnum py-3 pr-3">{row.driveParticipants}</td>
                          <td className="tnum py-3 pr-3">{row.offers}</td>
                          <td className="tnum py-3 pr-3">{row.joined}</td>
                          <td className="tnum py-3 pr-3">{pct(row.participationRate)}</td>
                          <td className="tnum py-3 font-semibold">{pct(row.placementRate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState compact icon={TrendingUp} title="No department outcomes" description="No eligible graduating students match these filters." />
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Company outcomes</CardTitle>
                <CardDescription>Applications, offers and distinct joined students by company.</CardDescription>
              </CardHeader>
              <CardContent>
                {analytics.companyOutcomes?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] text-sm">
                      <thead>
                        <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                          <th className="py-2.5 pr-3 font-semibold">Company</th>
                          <th className="py-2.5 pr-3 font-semibold">Drives</th>
                          <th className="py-2.5 pr-3 font-semibold">Applications</th>
                          <th className="py-2.5 pr-3 font-semibold">Offers</th>
                          <th className="py-2.5 font-semibold">Joined</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.companyOutcomes.map((row) => (
                          <tr key={row.companyId} className="border-b border-border/40 last:border-0">
                            <td className="py-3 pr-3 font-medium">{row.companyName}</td>
                            <td className="tnum py-3 pr-3">{row.drives}</td>
                            <td className="tnum py-3 pr-3">{row.applications}</td>
                            <td className="tnum py-3 pr-3">{row.offers}</td>
                            <td className="tnum py-3">{row.joined}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState compact icon={TrendingUp} title="No company outcomes" description="No applications match these filters." />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Stage progress</CardTitle>
                <CardDescription>Application records by current stage.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {(analytics.stageCounts || []).map((row) => (
                    <li key={row.stage} className="flex items-center justify-between gap-2 border-b border-border/40 pb-2 last:border-0 last:pb-0">
                      <span>{prettifyEnum(row.stage)}</span>
                      <Badge variant="secondary">{row.applications}</Badge>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Metric definitions</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 sm:grid-cols-2">
                {(analytics.definitions || []).map((definition) => (
                  <div key={definition.metric}>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {metricLabel(definition.metric)}
                    </dt>
                    <dd className="text-sm">{definition.definition}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>

          {canExport && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Export</CardTitle>
                <CardDescription>CSV exports are scoped, formula-neutralized and capped at 10,000 rows.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-3">
                <Select
                  label="Report type"
                  value={exportType}
                  onChange={(event) => setExportType(event.target.value)}
                  options={EXPORT_TYPES}
                />
                <Button variant="outline" onClick={exportCsv} disabled={exporting}>
                  <Download className="size-3.5" aria-hidden="true" />
                  {exporting ? "Preparing..." : "Download CSV"}
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
