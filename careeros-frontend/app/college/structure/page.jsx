"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Building2,
  CalendarDays,
  Layers,
  Plus,
  RefreshCw,
  School,
  UsersRound,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Breadcrumb } from "@/components/breadcrumb";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import api from "@/lib/api";
import { labelOf } from "@/lib/college";
import { formatDate, prettifyEnum } from "@/lib/format";
import { cn } from "cn";

const emptyForms = {
  institution: { code: "", name: "", timezone: "Asia/Kolkata", contactEmail: "", status: "ACTIVE" },
  department: { code: "", name: "", status: "ACTIVE" },
  program: { departmentId: "", code: "", name: "", degreeType: "B.Tech", durationYears: "4", status: "ACTIVE" },
  academicYear: { label: "", startDate: "", endDate: "", active: true },
  batch: { programId: "", academicYearId: "", label: "", graduationYear: "", status: "ACTIVE" },
  section: { batchId: "", name: "", status: "ACTIVE" },
};

export default function CollegeStructurePage() {
  const [me, setMe] = useState(null);
  const [structure, setStructure] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null);
  const [forms, setForms] = useState(emptyForms);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [meData, structureData] = await Promise.all([
        api.get("/college/me"),
        api.get("/college/structure"),
      ]);
      setMe(meData);
      setStructure(structureData);
      setForms((prev) => ({
        ...prev,
        institution: {
          code: structureData.institution?.code || "",
          name: structureData.institution?.name || "",
          timezone: structureData.institution?.timezone || "Asia/Kolkata",
          contactEmail: structureData.institution?.contactEmail || "",
          status: structureData.institution?.status || "ACTIVE",
        },
      }));
    } catch (err) {
      setError(err.message || "Failed to load the academic structure.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async structure loader; state updates happen in promise callbacks
    load();
  }, [load]);

  const canManage = me?.permissions?.includes("MANAGE_STRUCTURE");

  function open(type) {
    setDialog(type);
    setError("");
  }

  function updateForm(type, field, value) {
    setForms((prev) => ({ ...prev, [type]: { ...prev[type], [field]: value } }));
  }

  async function saveInstitution(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.put("/college/institution", {
        ...forms.institution,
        contactEmail: forms.institution.contactEmail.trim() || null,
      });
      setDialog(null);
      await load();
    } catch (err) {
      setError(err.message || "Could not update the institution.");
    } finally {
      setSaving(false);
    }
  }

  async function createEntity(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (dialog === "department") {
        await api.post("/college/departments", forms.department);
      } else if (dialog === "program") {
        await api.post("/college/programs", {
          ...forms.program,
          departmentId: Number(forms.program.departmentId),
          durationYears: Number(forms.program.durationYears),
        });
      } else if (dialog === "academicYear") {
        await api.post("/college/academic-years", forms.academicYear);
      } else if (dialog === "batch") {
        await api.post("/college/batches", {
          ...forms.batch,
          programId: Number(forms.batch.programId),
          academicYearId: Number(forms.batch.academicYearId),
          graduationYear: forms.batch.graduationYear ? Number(forms.batch.graduationYear) : null,
        });
      } else if (dialog === "section") {
        await api.post("/college/sections", {
          ...forms.section,
          batchId: Number(forms.section.batchId),
        });
      }
      setDialog(null);
      setForms((prev) => ({ ...prev, [dialog]: emptyForms[dialog] }));
      await load();
    } catch (err) {
      setError(err.message || "Could not create this record.");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !structure) return <LoadingState label="Loading academic structure…" />;

  if (!canManage) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Academic Structure"
          description="Departments, programs, academic years, batches and sections."
          breadcrumb={<Breadcrumb items={[{ label: "Academic Structure" }]} />}
        />
        <ErrorState
          title="Structure management is not available for your role"
          description={error || "Only a college administrator can manage the academic structure."}
        />
      </div>
    );
  }

  const institution = structure?.institution || {};
  const departments = structure?.departments || [];
  const programs = structure?.programs || [];
  const years = structure?.academicYears || [];
  const batches = structure?.batches || [];
  const sections = structure?.sections || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academic Structure"
        description="Everything students can be enrolled into. Codes must be unique within the institution."
        breadcrumb={<Breadcrumb items={[{ label: "Academic Structure" }]} />}
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn("size-3.5", loading && "animate-spin")} aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <School className="size-4" aria-hidden="true" />
              {institution.name || "Institution"}
            </CardTitle>
            <CardDescription>
              {institution.code} · {institution.timezone || "Timezone not set"} · {labelOf(institution.status)}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => open("institution")}>
            Edit institution
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Summary label="Departments" value={departments.length} />
          <Summary label="Programs" value={programs.length} />
          <Summary label="Academic years" value={years.length} />
          <Summary label="Batches" value={batches.length} />
          <Summary label="Sections" value={sections.length} />
          <Summary label="Contact email" value={institution.contactEmail || "Not set"} />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <EntityCard
          icon={Building2}
          title="Departments"
          description="Departments own programs and bound HOD/faculty access."
          onAdd={() => open("department")}
          empty="No departments yet."
          items={departments.map((item) => ({
            id: item.id,
            title: `${item.code} · ${item.name}`,
            meta: labelOf(item.status),
          }))}
        />
        <EntityCard
          icon={Layers}
          title="Programs"
          description="Degree programs belong to one department."
          onAdd={() => open("program")}
          empty="No programs yet."
          items={programs.map((item) => ({
            id: item.id,
            title: `${item.code} · ${item.name}`,
            meta: `${item.departmentName} · ${item.degreeType || "Degree"} · ${item.durationYears || "—"} years`,
          }))}
        />
        <EntityCard
          icon={CalendarDays}
          title="Academic years"
          description="Only one year should normally be active at a time."
          onAdd={() => open("academicYear")}
          empty="No academic years yet."
          items={years.map((item) => ({
            id: item.id,
            title: item.label,
            meta: `${formatDate(item.startDate)} → ${formatDate(item.endDate)}${item.active ? " · Active" : ""}`,
          }))}
        />
        <EntityCard
          icon={UsersRound}
          title="Batches"
          description="A batch is a program's graduating cohort for an academic year."
          onAdd={() => open("batch")}
          empty="No batches yet."
          items={batches.map((item) => ({
            id: item.id,
            title: item.label,
            meta: `${item.programName} · ${item.academicYearLabel} · Class of ${item.graduationYear || "—"}`,
          }))}
        />
        <EntityCard
          icon={UsersRound}
          title="Sections"
          description="Sections split a batch into class groups."
          onAdd={() => open("section")}
          empty="No sections yet."
          items={sections.map((item) => ({
            id: item.id,
            title: item.name,
            meta: `${item.batchLabel} · ${item.programName}`,
          }))}
        />
      </div>

      <Dialog
        open={dialog === "institution"}
        onOpenChange={(open) => setDialog(open ? "institution" : null)}
        title="Edit institution"
        description="Institution code is immutable here; contact details can be updated."
        footer={
          <>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveInstitution} disabled={saving}>
              {saving ? "Saving…" : "Save institution"}
            </Button>
          </>
        }
      >
        <form onSubmit={saveInstitution} className="mt-4 space-y-3">
          <Field id="institution-code" label="Code">
            {(inputId) => <Input id={inputId} value={forms.institution.code} readOnly />}
          </Field>
          <Field id="institution-name" label="Name" required>
            {(inputId) => (
              <Input
                id={inputId}
                value={forms.institution.name}
                onChange={(event) => updateForm("institution", "name", event.target.value)}
                required
              />
            )}
          </Field>
          <Field id="institution-timezone" label="Timezone">
            {(inputId) => (
              <Input
                id={inputId}
                value={forms.institution.timezone}
                onChange={(event) => updateForm("institution", "timezone", event.target.value)}
                placeholder="Asia/Kolkata"
              />
            )}
          </Field>
          <Field id="institution-email" label="Contact email">
            {(inputId) => (
              <Input
                id={inputId}
                type="email"
                value={forms.institution.contactEmail}
                onChange={(event) => updateForm("institution", "contactEmail", event.target.value)}
              />
            )}
          </Field>
          <p className="rounded-lg bg-muted/60 p-2.5 text-xs text-muted-foreground">
            Institution status is managed by the platform administrator. Contact them if the institution must be
            deactivated or reactivated.
          </p>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(dialog && dialog !== "institution")}
        onOpenChange={(open) => setDialog(open ? dialog : null)}
        title={`Add ${dialog ? prettifyEnum(dialog) : "record"}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={createEntity} disabled={saving}>
              {saving ? "Creating…" : "Create"}
            </Button>
          </>
        }
      >
        <form onSubmit={createEntity} className="mt-4 space-y-3">
          {dialog === "department" && (
            <>
              <Field id="department-code" label="Code" required hint="2–40 characters; letters, digits, dot, underscore or dash.">
                {(inputId) => (
                  <Input id={inputId} value={forms.department.code} onChange={(event) => updateForm("department", "code", event.target.value)} required />
                )}
              </Field>
              <Field id="department-name" label="Name" required>
                {(inputId) => (
                  <Input id={inputId} value={forms.department.name} onChange={(event) => updateForm("department", "name", event.target.value)} required />
                )}
              </Field>
            </>
          )}
          {dialog === "program" && (
            <>
              <Select
                label="Department"
                value={forms.program.departmentId}
                onChange={(event) => updateForm("program", "departmentId", event.target.value)}
                options={[{ value: "", label: "Select department" }, ...departments.map((item) => ({ value: String(item.id), label: `${item.code} · ${item.name}` }))]}
              />
              <Field id="program-code" label="Code" required>
                {(inputId) => (
                  <Input id={inputId} value={forms.program.code} onChange={(event) => updateForm("program", "code", event.target.value)} required />
                )}
              </Field>
              <Field id="program-name" label="Name" required>
                {(inputId) => (
                  <Input id={inputId} value={forms.program.name} onChange={(event) => updateForm("program", "name", event.target.value)} required />
                )}
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="program-degree" label="Degree type">
                  {(inputId) => (
                    <Input id={inputId} value={forms.program.degreeType} onChange={(event) => updateForm("program", "degreeType", event.target.value)} />
                  )}
                </Field>
                <Field id="program-duration" label="Duration (years)">
                  {(inputId) => (
                    <Input id={inputId} type="number" min="1" max="10" value={forms.program.durationYears} onChange={(event) => updateForm("program", "durationYears", event.target.value)} />
                  )}
                </Field>
              </div>
            </>
          )}
          {dialog === "academicYear" && (
            <>
              <Field id="year-label" label="Label" required hint="For example 2026-27.">
                {(inputId) => (
                  <Input id={inputId} value={forms.academicYear.label} onChange={(event) => updateForm("academicYear", "label", event.target.value)} required />
                )}
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="year-start" label="Start date" required>
                  {(inputId) => (
                    <Input id={inputId} type="date" value={forms.academicYear.startDate} onChange={(event) => updateForm("academicYear", "startDate", event.target.value)} required />
                  )}
                </Field>
                <Field id="year-end" label="End date" required>
                  {(inputId) => (
                    <Input id={inputId} type="date" value={forms.academicYear.endDate} onChange={(event) => updateForm("academicYear", "endDate", event.target.value)} required />
                  )}
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={forms.academicYear.active}
                  onChange={(event) => updateForm("academicYear", "active", event.target.checked)}
                  className="size-4 accent-green-700"
                />
                Mark as active academic year
              </label>
            </>
          )}
          {dialog === "batch" && (
            <>
              <Select
                label="Program"
                value={forms.batch.programId}
                onChange={(event) => updateForm("batch", "programId", event.target.value)}
                options={[{ value: "", label: "Select program" }, ...programs.map((item) => ({ value: String(item.id), label: `${item.code} · ${item.name}` }))]}
              />
              <Select
                label="Academic year"
                value={forms.batch.academicYearId}
                onChange={(event) => updateForm("batch", "academicYearId", event.target.value)}
                options={[{ value: "", label: "Select academic year" }, ...years.map((item) => ({ value: String(item.id), label: item.label }))]}
              />
              <Field id="batch-label" label="Batch label" required hint="For example 2026-2030.">
                {(inputId) => (
                  <Input id={inputId} value={forms.batch.label} onChange={(event) => updateForm("batch", "label", event.target.value)} required />
                )}
              </Field>
              <Field id="batch-graduation" label="Graduation year">
                {(inputId) => (
                  <Input id={inputId} type="number" min="2000" max={new Date().getFullYear() + 20} value={forms.batch.graduationYear} onChange={(event) => updateForm("batch", "graduationYear", event.target.value)} />
                )}
              </Field>
            </>
          )}
          {dialog === "section" && (
            <>
              <Select
                label="Batch"
                value={forms.section.batchId}
                onChange={(event) => updateForm("section", "batchId", event.target.value)}
                options={[{ value: "", label: "Select batch" }, ...batches.map((item) => ({ value: String(item.id), label: `${item.label} · ${item.programName}` }))]}
              />
              <Field id="section-name" label="Section name" required>
                {(inputId) => (
                  <Input id={inputId} value={forms.section.name} onChange={(event) => updateForm("section", "name", event.target.value)} required />
                )}
              </Field>
            </>
          )}
        </form>
      </Dialog>
    </div>
  );
}

function Summary({ label, value }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function EntityCard({ icon: Icon, title, description, onAdd, empty, items }) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="size-4" aria-hidden="true" />
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={onAdd}>
          <Plus className="size-3.5" aria-hidden="true" />
          Add
        </Button>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState compact icon={Icon} title={empty} description="Use Add to create the first one." />
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.meta}</p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  #{item.id}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
