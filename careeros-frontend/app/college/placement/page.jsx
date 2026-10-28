"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  Building2,
  CalendarDays,
  ExternalLink,
  Pencil,
  Plus,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Breadcrumb } from "@/components/breadcrumb";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import api from "@/lib/api";
import { formatDate } from "@/lib/format";

const COMPANY_STATUSES = ["PROSPECT", "ACTIVE", "PAUSED", "BLOCKED"];
const JOB_STATUSES = ["DRAFT", "OPEN", "CLOSED"];
const DRIVE_STATUSES = ["DRAFT", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING", "COMPLETED", "CANCELLED"];
const EMPLOYMENT_TYPES = ["FULL_TIME", "INTERNSHIP", "PART_TIME", "CONTRACT"];

const emptyCompany = {
  name: "",
  industry: "",
  sector: "",
  website: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  recruitmentStatus: "PROSPECT",
  source: "",
  notes: "",
};

const emptyJob = {
  companyId: "",
  title: "",
  description: "",
  requiredSkills: "",
  location: "",
  employmentType: "FULL_TIME",
  eligibilityCriteria: "",
  salaryMin: "",
  salaryMax: "",
  currency: "INR",
  applicationDeadline: "",
  status: "DRAFT",
};

const emptyDrive = {
  companyId: "",
  jobId: "",
  name: "",
  registrationStart: "",
  registrationEnd: "",
  driveDate: "",
  eligibilityCriteria: "",
  eligibleDepartmentId: "",
  eligibleProgramId: "",
  eligibleBatchId: "",
  eligibleGraduationYear: "",
  minimumReadinessPercent: "",
  status: "DRAFT",
};

function label(value) {
  if (!value) return "Not set";
  return String(value)
    .toLowerCase()
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function money(value, currency = "INR") {
  if (value == null || value === "") return "Not set";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 0,
    }).format(Number(value));
  } catch {
    return `${currency || ""} ${value}`.trim();
  }
}

function statusTone(status) {
  if (status === "ACTIVE" || status === "OPEN" || status === "REGISTRATION_OPEN") {
    return "bg-chart-3/15 text-chart-3";
  }
  if (status === "CANCELLED" || status === "BLOCKED" || status === "CLOSED") {
    return "bg-destructive/10 text-destructive";
  }
  if (status === "ONGOING" || status === "COMPLETED") return "bg-primary/10 text-primary";
  return "bg-muted text-muted-foreground";
}

export default function CollegePlacementPage() {
  const [me, setMe] = useState(null);
  const [structure, setStructure] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [drives, setDrives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [companyOpen, setCompanyOpen] = useState(false);
  const [companyId, setCompanyId] = useState(null);
  const [companyForm, setCompanyForm] = useState(emptyCompany);
  const [jobOpen, setJobOpen] = useState(false);
  const [jobId, setJobId] = useState(null);
  const [jobForm, setJobForm] = useState(emptyJob);
  const [driveOpen, setDriveOpen] = useState(false);
  const [driveId, setDriveId] = useState(null);
  const [driveForm, setDriveForm] = useState(emptyDrive);

  const permissions = new Set(me?.permissions || []);
  const canManageCompanies = permissions.has("MANAGE_COMPANIES");
  const canManageJobs = permissions.has("MANAGE_JOBS");
  const canManageDrives = permissions.has("MANAGE_DRIVES");
  const canViewContacts = permissions.has("VIEW_COMPANY_CONTACTS");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [meData, structureData, companyData, jobData, driveData] = await Promise.all([
        api.get("/college/me"),
        api.get("/college/structure"),
        api.get("/college/placement/companies"),
        api.get("/college/placement/jobs"),
        api.get("/college/placement/drives"),
      ]);
      setMe(meData);
      setStructure(structureData);
      setCompanies(companyData || []);
      setJobs(jobData || []);
      setDrives(driveData || []);
    } catch (err) {
      setError(err.message || "Could not load placement data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async placement loader; state updates happen in promise callbacks
    load();
  }, [load]);

  const companyOptions = useMemo(
    () => [
      { value: "", label: "Select a company" },
      ...companies.map((company) => ({ value: String(company.id), label: company.name })),
    ],
    [companies],
  );

  const driveJobOptions = useMemo(() => {
    const filtered = driveForm.companyId
      ? jobs.filter((job) => String(job.companyId) === String(driveForm.companyId))
      : jobs;
    return [
      { value: "", label: filtered.length ? "Select a job" : "Create a job for this company first" },
      ...filtered.map((job) => ({ value: String(job.id), label: `${job.title} · ${job.companyName}` })),
    ];
  }, [jobs, driveForm.companyId]);

  const departmentOptions = useMemo(
    () => [
      { value: "", label: "Any department" },
      ...(structure?.departments || []).map((department) => ({
        value: String(department.id),
        label: `${department.code} · ${department.name}`,
      })),
    ],
    [structure],
  );

  const programOptions = useMemo(
    () => [
      { value: "", label: "Any program" },
      ...(structure?.programs || [])
        .filter((program) => !driveForm.eligibleDepartmentId || String(program.departmentId) === driveForm.eligibleDepartmentId)
        .map((program) => ({ value: String(program.id), label: `${program.code} · ${program.name}` })),
    ],
    [driveForm.eligibleDepartmentId, structure],
  );

  const batchOptions = useMemo(
    () => [
      { value: "", label: "Any batch" },
      ...(structure?.batches || [])
        .filter((batch) => !driveForm.eligibleProgramId || String(batch.programId) === driveForm.eligibleProgramId)
        .map((batch) => ({ value: String(batch.id), label: batch.label })),
    ],
    [driveForm.eligibleProgramId, structure],
  );

  function openCompany(company = null) {
    setCompanyId(company?.id ?? null);
    setCompanyForm(
      company
        ? {
            name: company.name || "",
            industry: company.industry || "",
            sector: company.sector || "",
            website: company.website || "",
            contactName: company.contactName || "",
            contactEmail: company.contactEmail || "",
            contactPhone: company.contactPhone || "",
            recruitmentStatus: company.recruitmentStatus || "PROSPECT",
            source: company.source || "",
            notes: company.notes || "",
          }
        : emptyCompany,
    );
    setCompanyOpen(true);
  }

  function openJob(job = null) {
    setJobId(job?.id ?? null);
    setJobForm(
      job
        ? {
            companyId: String(job.companyId || ""),
            title: job.title || "",
            description: job.description || "",
            requiredSkills: job.requiredSkills || "",
            location: job.location || "",
            employmentType: job.employmentType || "FULL_TIME",
            eligibilityCriteria: job.eligibilityCriteria || "",
            salaryMin: job.salaryMin ?? "",
            salaryMax: job.salaryMax ?? "",
            currency: job.currency || "INR",
            applicationDeadline: job.applicationDeadline || "",
            status: job.status || "DRAFT",
          }
        : emptyJob,
    );
    setJobOpen(true);
  }

  function openDrive(drive = null) {
    setDriveId(drive?.id ?? null);
    setDriveForm(
      drive
        ? {
            companyId: String(drive.companyId || ""),
            jobId: String(drive.jobId || ""),
            name: drive.name || "",
            registrationStart: drive.registrationStart || "",
            registrationEnd: drive.registrationEnd || "",
            driveDate: drive.driveDate || "",
            eligibilityCriteria: drive.eligibilityCriteria || "",
            eligibleDepartmentId: drive.eligibleDepartmentId ? String(drive.eligibleDepartmentId) : "",
            eligibleProgramId: drive.eligibleProgramId ? String(drive.eligibleProgramId) : "",
            eligibleBatchId: drive.eligibleBatchId ? String(drive.eligibleBatchId) : "",
            eligibleGraduationYear: drive.eligibleGraduationYear ?? "",
            minimumReadinessPercent: drive.minimumReadinessPercent ?? "",
            status: drive.status || "DRAFT",
          }
        : emptyDrive,
    );
    setDriveOpen(true);
  }

  async function saveCompany(event) {
    event.preventDefault();
    if (!companyForm.name.trim()) {
      toast.error("Enter a company name.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        ...companyForm,
        name: companyForm.name.trim(),
        industry: companyForm.industry.trim() || null,
        sector: companyForm.sector.trim() || null,
        website: companyForm.website.trim() || null,
        contactName: companyForm.contactName.trim() || null,
        contactEmail: companyForm.contactEmail.trim() || null,
        contactPhone: companyForm.contactPhone.trim() || null,
        source: companyForm.source.trim() || null,
        notes: companyForm.notes.trim() || null,
      };
      if (companyId) {
        await api.put(`/college/placement/companies/${companyId}`, body);
        toast.success("Company updated.");
      } else {
        await api.post("/college/placement/companies", body);
        toast.success("Company created.");
      }
      setCompanyOpen(false);
      await load();
    } catch (err) {
      toast.error(err.message || "Could not save the company.");
    } finally {
      setSaving(false);
    }
  }

  async function saveJob(event) {
    event.preventDefault();
    if (!jobForm.companyId || !jobForm.title.trim()) {
      toast.error("Choose a company and enter a job title.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        ...jobForm,
        companyId: Number(jobForm.companyId),
        title: jobForm.title.trim(),
        description: jobForm.description.trim() || null,
        requiredSkills: jobForm.requiredSkills.trim() || null,
        location: jobForm.location.trim() || null,
        eligibilityCriteria: jobForm.eligibilityCriteria.trim() || null,
        salaryMin: jobForm.salaryMin === "" ? null : Number(jobForm.salaryMin),
        salaryMax: jobForm.salaryMax === "" ? null : Number(jobForm.salaryMax),
        currency: jobForm.currency.trim() || null,
        applicationDeadline: jobForm.applicationDeadline || null,
      };
      if (jobId) {
        await api.put(`/college/placement/jobs/${jobId}`, body);
        toast.success("Job opening updated.");
      } else {
        await api.post("/college/placement/jobs", body);
        toast.success("Job opening created.");
      }
      setJobOpen(false);
      await load();
    } catch (err) {
      toast.error(err.message || "Could not save the job opening.");
    } finally {
      setSaving(false);
    }
  }

  async function saveDrive(event) {
    event.preventDefault();
    if (!driveForm.companyId || !driveForm.jobId || !driveForm.name.trim()) {
      toast.error("Choose a company, job and drive name.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        ...driveForm,
        companyId: Number(driveForm.companyId),
        jobId: Number(driveForm.jobId),
        name: driveForm.name.trim(),
        registrationStart: driveForm.registrationStart || null,
        registrationEnd: driveForm.registrationEnd || null,
        driveDate: driveForm.driveDate || null,
        eligibilityCriteria: driveForm.eligibilityCriteria.trim() || null,
        eligibleDepartmentId: driveForm.eligibleDepartmentId ? Number(driveForm.eligibleDepartmentId) : null,
        eligibleProgramId: driveForm.eligibleProgramId ? Number(driveForm.eligibleProgramId) : null,
        eligibleBatchId: driveForm.eligibleBatchId ? Number(driveForm.eligibleBatchId) : null,
        eligibleGraduationYear: driveForm.eligibleGraduationYear === ""
          ? null
          : Number(driveForm.eligibleGraduationYear),
        minimumReadinessPercent: driveForm.minimumReadinessPercent === ""
          ? null
          : Number(driveForm.minimumReadinessPercent),
      };
      if (driveId) {
        await api.put(`/college/placement/drives/${driveId}`, body);
        toast.success("Placement drive updated.");
      } else {
        await api.post("/college/placement/drives", body);
        toast.success("Placement drive created.");
      }
      setDriveOpen(false);
      await load();
    } catch (err) {
      toast.error(err.message || "Could not save the placement drive.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState label="Loading placement workspace..." />;

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Placement"
          breadcrumb={<Breadcrumb items={[{ label: "Placement" }]} />}
        />
        <ErrorState title="Couldn't load placement data" description={error} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Placement"
        description="Companies, job openings and placement drives inside your institution and academic scope."
        breadcrumb={<Breadcrumb items={[{ label: "Placement" }]} />}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Refresh
            </Button>
            {canManageDrives && (
              <Button size="sm" onClick={() => openDrive()}>
                <Plus className="size-3.5" aria-hidden="true" />
                New drive
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Companies</p>
              <p className="text-2xl font-bold">{companies.length}</p>
            </div>
            <Building2 className="size-5 text-muted-foreground" aria-hidden="true" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Open jobs</p>
              <p className="text-2xl font-bold">{jobs.filter((job) => job.status === "OPEN").length}</p>
            </div>
            <Briefcase className="size-5 text-muted-foreground" aria-hidden="true" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Drives</p>
              <p className="text-2xl font-bold">{drives.length}</p>
            </div>
            <CalendarDays className="size-5 text-muted-foreground" aria-hidden="true" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="size-4" aria-hidden="true" />
                Companies
              </CardTitle>
              <CardDescription>Contact details are visible only to roles that manage placements.</CardDescription>
            </div>
            {canManageCompanies && (
              <Button variant="outline" size="sm" onClick={() => openCompany()}>
                <Plus className="size-3.5" aria-hidden="true" />
                Add company
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {companies.length === 0 ? (
            <EmptyState
              compact
              icon={Building2}
              title="No companies yet"
              description={canManageCompanies ? "Add the first recruiting company." : "Companies added by your TPO will appear here."}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-2.5 pr-3 font-semibold">Company</th>
                    <th className="py-2.5 pr-3 font-semibold">Industry</th>
                    <th className="py-2.5 pr-3 font-semibold">Recruitment</th>
                    <th className="py-2.5 pr-3 font-semibold">Contact</th>
                    <th className="py-2.5 pr-3 font-semibold">Source</th>
                    <th className="py-2.5 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => (
                    <tr key={company.id} className="border-b border-border/40 last:border-0">
                      <td className="py-3 pr-3">
                        <p className="font-medium">{company.name}</p>
                        {company.website && (
                          <a
                            href={company.website}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            Website <ExternalLink className="size-3" aria-hidden="true" />
                          </a>
                        )}
                      </td>
                      <td className="py-3 pr-3">{company.industry || "Not set"}</td>
                      <td className="py-3 pr-3">
                        <Badge className={`border-0 ${statusTone(company.recruitmentStatus)}`}>
                          {label(company.recruitmentStatus)}
                        </Badge>
                      </td>
                      <td className="py-3 pr-3 text-xs">
                        {canViewContacts ? (
                          <>
                            <p>{company.contactName || "No contact name"}</p>
                            <p className="text-muted-foreground">{company.contactEmail || company.contactPhone || "No contact details"}</p>
                          </>
                        ) : (
                          <span className="text-muted-foreground">Restricted</span>
                        )}
                      </td>
                      <td className="py-3 pr-3">{company.source || "Not set"}</td>
                      <td className="py-3">
                        {canManageCompanies && (
                          <Button variant="ghost" size="sm" onClick={() => openCompany(company)}>
                            <Pencil className="size-3.5" aria-hidden="true" />
                            Edit
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Briefcase className="size-4" aria-hidden="true" />
                Job openings
              </CardTitle>
              <CardDescription>Role details, eligibility and salary bands.</CardDescription>
            </div>
            {canManageJobs && (
              <Button variant="outline" size="sm" onClick={() => openJob()} disabled={companies.length === 0}>
                <Plus className="size-3.5" aria-hidden="true" />
                Add job
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <EmptyState
              compact
              icon={Briefcase}
              title="No job openings yet"
              description={canManageJobs ? "Create a job for a company before scheduling a drive." : "Job openings added by your TPO will appear here."}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-2.5 pr-3 font-semibold">Role</th>
                    <th className="py-2.5 pr-3 font-semibold">Company</th>
                    <th className="py-2.5 pr-3 font-semibold">Type</th>
                    <th className="py-2.5 pr-3 font-semibold">Salary</th>
                    <th className="py-2.5 pr-3 font-semibold">Deadline</th>
                    <th className="py-2.5 pr-3 font-semibold">Status</th>
                    <th className="py-2.5 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} className="border-b border-border/40 last:border-0">
                      <td className="py-3 pr-3">
                        <p className="font-medium">{job.title}</p>
                        <p className="text-xs text-muted-foreground">{job.location || "Location not set"}</p>
                      </td>
                      <td className="py-3 pr-3">{job.companyName}</td>
                      <td className="py-3 pr-3">{label(job.employmentType)}</td>
                      <td className="py-3 pr-3 text-xs">
                        {job.salaryMin == null && job.salaryMax == null
                          ? "Not disclosed"
                          : `${money(job.salaryMin, job.currency)} - ${money(job.salaryMax, job.currency)}`}
                      </td>
                      <td className="py-3 pr-3">{job.applicationDeadline ? formatDate(job.applicationDeadline) : "Not set"}</td>
                      <td className="py-3 pr-3">
                        <Badge className={`border-0 ${statusTone(job.status)}`}>{label(job.status)}</Badge>
                      </td>
                      <td className="py-3">
                        {canManageJobs && (
                          <Button variant="ghost" size="sm" onClick={() => openJob(job)}>
                            <Pencil className="size-3.5" aria-hidden="true" />
                            Edit
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="size-4" aria-hidden="true" />
                Placement drives
              </CardTitle>
              <CardDescription>Registration windows, eligibility and application counts.</CardDescription>
            </div>
            {canManageDrives && (
              <Button variant="outline" size="sm" onClick={() => openDrive()} disabled={jobs.length === 0}>
                <Plus className="size-3.5" aria-hidden="true" />
                Add drive
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {drives.length === 0 ? (
            <EmptyState
              compact
              icon={CalendarDays}
              title="No placement drives yet"
              description={canManageDrives ? "Schedule a drive for a company and job opening." : "Drives scheduled by your TPO will appear here."}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-2.5 pr-3 font-semibold">Drive</th>
                    <th className="py-2.5 pr-3 font-semibold">Company / Role</th>
                    <th className="py-2.5 pr-3 font-semibold">Registration</th>
                    <th className="py-2.5 pr-3 font-semibold">Eligibility</th>
                    <th className="py-2.5 pr-3 font-semibold">Applications</th>
                    <th className="py-2.5 pr-3 font-semibold">Status</th>
                    <th className="py-2.5 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {drives.map((drive) => (
                    <tr key={drive.id} className="border-b border-border/40 last:border-0">
                      <td className="py-3 pr-3">
                        <Link href={`/college/placement/drives/${drive.id}`} className="font-medium text-primary hover:underline">
                          {drive.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{drive.driveDate ? formatDate(drive.driveDate) : "Date not set"}</p>
                      </td>
                      <td className="py-3 pr-3">
                        <p>{drive.companyName}</p>
                        <p className="text-xs text-muted-foreground">{drive.jobTitle}</p>
                      </td>
                      <td className="py-3 pr-3 text-xs">
                        {drive.registrationStart ? formatDate(drive.registrationStart) : "Open"} -{" "}
                        {drive.registrationEnd ? formatDate(drive.registrationEnd) : "No deadline"}
                      </td>
                      <td className="py-3 pr-3 text-xs">
                        {[
                          drive.eligibleDepartmentName,
                          drive.eligibleProgramName,
                          drive.eligibleBatchLabel,
                          drive.eligibleGraduationYear ? `Class of ${drive.eligibleGraduationYear}` : null,
                          drive.minimumReadinessPercent != null ? `${drive.minimumReadinessPercent}% readiness` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "All students"}
                      </td>
                      <td className="py-3 pr-3">{drive.applicationCount}</td>
                      <td className="py-3 pr-3">
                        <Badge className={`border-0 ${statusTone(drive.status)}`}>{label(drive.status)}</Badge>
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-1">
                          <Button variant="ghost" size="sm" render={<Link href={`/college/placement/drives/${drive.id}`} />}>
                            Open
                          </Button>
                          {canManageDrives && (
                            <Button variant="ghost" size="sm" onClick={() => openDrive(drive)}>
                              <Pencil className="size-3.5" aria-hidden="true" />
                              Edit
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={companyOpen}
        onOpenChange={setCompanyOpen}
        title={companyId ? "Edit company" : "Add company"}
        description="Company contact details are stored inside your institution only."
        className="max-w-2xl"
      >
        <form onSubmit={saveCompany} className="mt-4 space-y-4">
          <Field label="Company name" required htmlFor="company-name">
            {(id) => (
              <Input
                id={id}
                value={companyForm.name}
                onChange={(event) => setCompanyForm((prev) => ({ ...prev, name: event.target.value }))}
                maxLength={200}
              />
            )}
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Industry" htmlFor="company-industry">
              {(id) => (
                <Input
                  id={id}
                  value={companyForm.industry}
                  onChange={(event) => setCompanyForm((prev) => ({ ...prev, industry: event.target.value }))}
                  maxLength={120}
                />
              )}
            </Field>
            <Field label="Sector" htmlFor="company-sector">
              {(id) => (
                <Input
                  id={id}
                  value={companyForm.sector}
                  onChange={(event) => setCompanyForm((prev) => ({ ...prev, sector: event.target.value }))}
                  maxLength={120}
                />
              )}
            </Field>
          </div>
          <Field label="Website" htmlFor="company-website">
            {(id) => (
              <Input
                id={id}
                type="url"
                value={companyForm.website}
                onChange={(event) => setCompanyForm((prev) => ({ ...prev, website: event.target.value }))}
                maxLength={250}
              />
            )}
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Contact name" htmlFor="company-contact-name">
              {(id) => (
                <Input
                  id={id}
                  value={companyForm.contactName}
                  onChange={(event) => setCompanyForm((prev) => ({ ...prev, contactName: event.target.value }))}
                  maxLength={120}
                />
              )}
            </Field>
            <Field label="Contact email" htmlFor="company-contact-email">
              {(id) => (
                <Input
                  id={id}
                  type="email"
                  value={companyForm.contactEmail}
                  onChange={(event) => setCompanyForm((prev) => ({ ...prev, contactEmail: event.target.value }))}
                  maxLength={190}
                />
              )}
            </Field>
            <Field label="Contact phone" htmlFor="company-contact-phone">
              {(id) => (
                <Input
                  id={id}
                  value={companyForm.contactPhone}
                  onChange={(event) => setCompanyForm((prev) => ({ ...prev, contactPhone: event.target.value }))}
                  maxLength={30}
                />
              )}
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Recruitment status" htmlFor="company-status">
              {(id) => (
                <Select
                  id={id}
                  value={companyForm.recruitmentStatus}
                  onChange={(event) => setCompanyForm((prev) => ({ ...prev, recruitmentStatus: event.target.value }))}
                  options={COMPANY_STATUSES.map((value) => ({ value, label: label(value) }))}
                />
              )}
            </Field>
            <Field label="Source" htmlFor="company-source">
              {(id) => (
                <Input
                  id={id}
                  value={companyForm.source}
                  onChange={(event) => setCompanyForm((prev) => ({ ...prev, source: event.target.value }))}
                  maxLength={120}
                />
              )}
            </Field>
          </div>
          <Field label="Notes" htmlFor="company-notes">
            {(id) => (
              <Textarea
                id={id}
                value={companyForm.notes}
                onChange={(event) => setCompanyForm((prev) => ({ ...prev, notes: event.target.value }))}
                maxLength={1000}
              />
            )}
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCompanyOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : companyId ? "Save company" : "Create company"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={jobOpen}
        onOpenChange={setJobOpen}
        title={jobId ? "Edit job opening" : "Add job opening"}
        description="A drive must reference a job that belongs to the same company."
        className="max-w-2xl"
      >
        <form onSubmit={saveJob} className="mt-4 space-y-4">
          <Field label="Company" required htmlFor="job-company">
            {(id) => (
              <Select
                id={id}
                value={jobForm.companyId}
                onChange={(event) => setJobForm((prev) => ({ ...prev, companyId: event.target.value }))}
                options={companyOptions}
              />
            )}
          </Field>
          <Field label="Job title" required htmlFor="job-title">
            {(id) => (
              <Input
                id={id}
                value={jobForm.title}
                onChange={(event) => setJobForm((prev) => ({ ...prev, title: event.target.value }))}
                maxLength={200}
              />
            )}
          </Field>
          <Field label="Description" htmlFor="job-description">
            {(id) => (
              <Textarea
                id={id}
                value={jobForm.description}
                onChange={(event) => setJobForm((prev) => ({ ...prev, description: event.target.value }))}
                maxLength={4000}
              />
            )}
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Required skills" htmlFor="job-skills">
              {(id) => (
                <Input
                  id={id}
                  value={jobForm.requiredSkills}
                  onChange={(event) => setJobForm((prev) => ({ ...prev, requiredSkills: event.target.value }))}
                  maxLength={1000}
                />
              )}
            </Field>
            <Field label="Location" htmlFor="job-location">
              {(id) => (
                <Input
                  id={id}
                  value={jobForm.location}
                  onChange={(event) => setJobForm((prev) => ({ ...prev, location: event.target.value }))}
                  maxLength={160}
                />
              )}
            </Field>
          </div>
          <Field label="Eligibility criteria" htmlFor="job-eligibility">
            {(id) => (
              <Textarea
                id={id}
                value={jobForm.eligibilityCriteria}
                onChange={(event) => setJobForm((prev) => ({ ...prev, eligibilityCriteria: event.target.value }))}
                maxLength={2000}
              />
            )}
          </Field>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Employment type" htmlFor="job-type">
              {(id) => (
                <Select
                  id={id}
                  value={jobForm.employmentType}
                  onChange={(event) => setJobForm((prev) => ({ ...prev, employmentType: event.target.value }))}
                  options={EMPLOYMENT_TYPES.map((value) => ({ value, label: label(value) }))}
                />
              )}
            </Field>
            <Field label="Salary min" htmlFor="job-salary-min">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min="0"
                  step="0.01"
                  value={jobForm.salaryMin}
                  onChange={(event) => setJobForm((prev) => ({ ...prev, salaryMin: event.target.value }))}
                />
              )}
            </Field>
            <Field label="Salary max" htmlFor="job-salary-max">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min="0"
                  step="0.01"
                  value={jobForm.salaryMax}
                  onChange={(event) => setJobForm((prev) => ({ ...prev, salaryMax: event.target.value }))}
                />
              )}
            </Field>
            <Field label="Currency" htmlFor="job-currency">
              {(id) => (
                <Input
                  id={id}
                  value={jobForm.currency}
                  onChange={(event) => setJobForm((prev) => ({ ...prev, currency: event.target.value }))}
                  maxLength={10}
                />
              )}
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Application deadline" htmlFor="job-deadline">
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  value={jobForm.applicationDeadline}
                  onChange={(event) => setJobForm((prev) => ({ ...prev, applicationDeadline: event.target.value }))}
                />
              )}
            </Field>
            <Field label="Status" htmlFor="job-status">
              {(id) => (
                <Select
                  id={id}
                  value={jobForm.status}
                  onChange={(event) => setJobForm((prev) => ({ ...prev, status: event.target.value }))}
                  options={JOB_STATUSES.map((value) => ({ value, label: label(value) }))}
                />
              )}
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setJobOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : jobId ? "Save job" : "Create job"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={driveOpen}
        onOpenChange={setDriveOpen}
        title={driveId ? "Edit placement drive" : "Schedule placement drive"}
        description="Academic eligibility is validated against your institution's hierarchy on the server."
        className="max-w-3xl"
      >
        <form onSubmit={saveDrive} className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Company" required htmlFor="drive-company">
              {(id) => (
                <Select
                  id={id}
                  value={driveForm.companyId}
                  onChange={(event) =>
                    setDriveForm((prev) => ({ ...prev, companyId: event.target.value, jobId: "" }))
                  }
                  options={companyOptions}
                />
              )}
            </Field>
            <Field label="Job opening" required htmlFor="drive-job">
              {(id) => (
                <Select
                  id={id}
                  value={driveForm.jobId}
                  onChange={(event) => setDriveForm((prev) => ({ ...prev, jobId: event.target.value }))}
                  options={driveJobOptions}
                />
              )}
            </Field>
          </div>
          <Field label="Drive name" required htmlFor="drive-name">
            {(id) => (
              <Input
                id={id}
                value={driveForm.name}
                onChange={(event) => setDriveForm((prev) => ({ ...prev, name: event.target.value }))}
                maxLength={200}
              />
            )}
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Registration starts" htmlFor="drive-registration-start">
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  value={driveForm.registrationStart}
                  onChange={(event) => setDriveForm((prev) => ({ ...prev, registrationStart: event.target.value }))}
                />
              )}
            </Field>
            <Field label="Registration deadline" htmlFor="drive-registration-end">
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  value={driveForm.registrationEnd}
                  onChange={(event) => setDriveForm((prev) => ({ ...prev, registrationEnd: event.target.value }))}
                />
              )}
            </Field>
            <Field label="Drive date" htmlFor="drive-date">
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  value={driveForm.driveDate}
                  onChange={(event) => setDriveForm((prev) => ({ ...prev, driveDate: event.target.value }))}
                />
              )}
            </Field>
          </div>
          <Field label="Eligibility criteria" htmlFor="drive-eligibility">
            {(id) => (
              <Textarea
                id={id}
                value={driveForm.eligibilityCriteria}
                onChange={(event) => setDriveForm((prev) => ({ ...prev, eligibilityCriteria: event.target.value }))}
                maxLength={2000}
              />
            )}
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Eligible department" htmlFor="drive-department">
              {(id) => (
                <Select
                  id={id}
                  value={driveForm.eligibleDepartmentId}
                  onChange={(event) =>
                    setDriveForm((prev) => ({
                      ...prev,
                      eligibleDepartmentId: event.target.value,
                      eligibleProgramId: "",
                      eligibleBatchId: "",
                    }))
                  }
                  options={departmentOptions}
                />
              )}
            </Field>
            <Field label="Eligible program" htmlFor="drive-program">
              {(id) => (
                <Select
                  id={id}
                  value={driveForm.eligibleProgramId}
                  onChange={(event) =>
                    setDriveForm((prev) => ({ ...prev, eligibleProgramId: event.target.value, eligibleBatchId: "" }))
                  }
                  options={programOptions}
                />
              )}
            </Field>
            <Field label="Eligible batch" htmlFor="drive-batch">
              {(id) => (
                <Select
                  id={id}
                  value={driveForm.eligibleBatchId}
                  onChange={(event) => setDriveForm((prev) => ({ ...prev, eligibleBatchId: event.target.value }))}
                  options={batchOptions}
                />
              )}
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Graduation year" htmlFor="drive-graduation">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min="2000"
                  max="2100"
                  value={driveForm.eligibleGraduationYear}
                  onChange={(event) => setDriveForm((prev) => ({ ...prev, eligibleGraduationYear: event.target.value }))}
                />
              )}
            </Field>
            <Field label="Minimum readiness (%)" htmlFor="drive-readiness">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min="0"
                  max="100"
                  value={driveForm.minimumReadinessPercent}
                  onChange={(event) => setDriveForm((prev) => ({ ...prev, minimumReadinessPercent: event.target.value }))}
                />
              )}
            </Field>
            <Field label="Status" htmlFor="drive-status">
              {(id) => (
                <Select
                  id={id}
                  value={driveForm.status}
                  onChange={(event) => setDriveForm((prev) => ({ ...prev, status: event.target.value }))}
                  options={DRIVE_STATUSES.map((value) => ({ value, label: label(value) }))}
                />
              )}
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDriveOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : driveId ? "Save drive" : "Create drive"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
