import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../../lib/api.js";
import { useApi } from "../../lib/useApi.js";
import { Icon } from "../../components/Icon.jsx";
import { Badge, DataTable, Distribution, ErrorBlock, LoadingBlock, PageHeader, Panel, StatCard } from "../../components/ui.jsx";
import { Modal, ReadinessPanel, ReadinessSummary, SettingsPage, SkillGapTable, StudentDetailDrawer, StudentsTable, downloadCsv, formatDate, scoreTone } from "./shared.jsx";

const COMPANY_STATUSES = ["PROSPECT", "ACTIVE", "PAUSED", "BLOCKED"];
const JOB_STATUSES = ["DRAFT", "OPEN", "CLOSED"];
const DRIVE_STATUSES = ["DRAFT", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING", "COMPLETED", "CANCELLED"];
const EMPLOYMENT_TYPES = ["FULL_TIME", "INTERNSHIP", "PART_TIME", "CONTRACT"];

const EMPTY_COMPANY = {
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

const EMPTY_JOB = {
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

const EMPTY_DRIVE = {
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

export function TpoDashboardPage() {
  const { data, loading, error, reload } = useApi("/workspace/summary");
  const { data: gaps } = useApi("/workspace/skill-gaps");
  if (loading) return <LoadingBlock label="Loading placement overview…" />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  const stats = data?.stats || {};
  const readiness = data?.readiness;

  return (
    <div className="workspace-page-content">
      <PageHeader
        eyebrow="PLACEMENT OFFICER"
        title="Placement readiness overview"
        description={`Track student readiness, surface skill gaps, and prepare placement reports for ${data?.college?.name || "your college"}.`}
        actions={<Link className="primary-button" to="/tpo/reports">Generate report</Link>}
      />

      <div className="stat-grid stat-grid-4">
        <StatCard label="Students" value={stats.students ?? 0} hint="In your placement pool" icon="users" />
        <StatCard label="Assessed" value={readiness?.assessedStudentCount ?? 0} hint="With a submitted assessment" icon="clipboard" />
        <StatCard label="Average readiness" value={`${readiness?.averageScore ?? 0}%`} hint="Latest attempt per student" tone={scoreTone(readiness?.averageScore)} icon="target" />
        <StatCard label="Priority gaps" value={readiness?.distribution?.PRIORITY_GAP ?? 0} hint="Students needing focused support" tone="danger" icon="alert" />
      </div>

      <div className="two-column">
        <Panel title="Readiness distribution" description="Students grouped by latest assessment score.">
          <Distribution distribution={readiness?.distribution} />
        </Panel>
        <Panel title="Placement actions" description="Move from insight to intervention.">
          <div className="quick-actions">
            <Link to="/tpo/students"><Icon name="users" size={18} /> Browse students</Link>
            <Link to="/tpo/readiness"><Icon name="target" size={18} /> Review readiness</Link>
            <Link to="/tpo/skill-gaps"><Icon name="chart" size={18} /> Inspect skill gaps</Link>
            <Link to="/tpo/reports"><Icon name="clipboard" size={18} /> Export reports</Link>
            <Link to="/tpo/placement"><Icon name="briefcase" size={18} /> Placement drives</Link>
          </div>
        </Panel>
      </div>

      <Panel title="Top skill gaps" description="Skills with the largest distance to target across assessed students." actions={<Link className="link-button" to="/tpo/skill-gaps">View all</Link>}>
        <SkillGapTable gaps={(gaps || []).slice(0, 5)} />
      </Panel>
    </div>
  );
}

export function TpoStudentsPage() {
  const { data, loading, error, reload } = useApi("/workspace/students");
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState(null);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (data || []).filter((student) => !term || `${student.fullName} ${student.studentId} ${student.branch || ""}`.toLowerCase().includes(term));
  }, [data, query]);

  async function openStudent(student) {
    try {
      setDetail(await api.get(`/workspace/students/${student.id}`));
    } catch (reason) {
      toast.error(reason.message || "Unable to load the student profile.");
    }
  }

  return (
    <div className="workspace-page-content">
      <PageHeader eyebrow="PLACEMENT POOL" title="Students and career targets" description="Review the students available to your placement programme." />
      <Panel title={loading ? "Students" : `${filtered.length} students`} actions={<input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search students" />}>
        {loading ? <LoadingBlock /> : error ? <ErrorBlock message={error} onRetry={reload} /> : <StudentsTable students={filtered} onView={openStudent} />}
      </Panel>
      <StudentDetailDrawer student={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

export function TpoReadinessPage() {
  const { data, loading, error, reload } = useApi("/workspace/readiness");
  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  return (
    <div className="workspace-page-content">
      <PageHeader eyebrow="READINESS" title="Student readiness" description="A placement-ready view of how students are progressing against their target careers." />
      <ReadinessSummary readiness={data} />
      <div className="two-column">
        <ReadinessPanel readiness={data} />
        <Panel title="How readiness is calculated" description="Weighted from the target career’s skill framework.">
          <ul className="report-notes">
            <li>Each skill score comes from a student’s latest submitted assessment.</li>
            <li>Scores are capped at the target percentage so strengths do not mask gaps.</li>
            <li>Skills are weighted by importance for the selected career.</li>
            <li>Students without a selected career or submitted attempt appear as unassessed.</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}

export function TpoSkillGapsPage() {
  const { data, loading, error, reload } = useApi("/workspace/skill-gaps");
  return (
    <div className="workspace-page-content">
      <PageHeader
        eyebrow="SKILL GAPS"
        title="Skill gap analysis"
        description="Ranked gaps between current student performance and career targets."
        actions={<button type="button" className="secondary-button" onClick={() => downloadCsv("skill-gaps.csv", [
          { label: "Skill", value: (gap) => gap.skillName },
          { label: "Category", value: (gap) => gap.skillCategory },
          { label: "Average", value: (gap) => gap.averageScore },
          { label: "Target", value: (gap) => gap.targetPercent },
          { label: "Gap", value: (gap) => gap.gapPercent },
        ], data || [])}>Export CSV</button>}
      />
      <Panel title="All skill gaps">
        {loading ? <LoadingBlock /> : error ? <ErrorBlock message={error} onRetry={reload} /> : <SkillGapTable gaps={data} />}
      </Panel>
    </div>
  );
}

export function TpoReportsPage() {
  const { data: readiness, loading, error, reload } = useApi("/workspace/readiness");
  const { data: students } = useApi("/workspace/students");
  const { data: gaps } = useApi("/workspace/skill-gaps");

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;

  return (
    <div className="workspace-page-content">
      <PageHeader
        eyebrow="REPORTS"
        title="Placement readiness report"
        description="Share a concise view of readiness, gaps, and student career targets."
        actions={(
          <div className="button-row">
            <button type="button" className="secondary-button" onClick={() => downloadCsv("students.csv", [
              { label: "Student", value: (student) => student.fullName },
              { label: "Student ID", value: (student) => student.studentId },
              { label: "Branch", value: (student) => student.branch },
              { label: "Graduation", value: (student) => student.graduationYear },
              { label: "Target career", value: (student) => student.targetCareerName },
            ], students || [])}>Export students</button>
            <button type="button" className="primary-button" onClick={() => downloadCsv("skill-gaps.csv", [
              { label: "Skill", value: (gap) => gap.skillName },
              { label: "Average", value: (gap) => gap.averageScore },
              { label: "Target", value: (gap) => gap.targetPercent },
              { label: "Gap", value: (gap) => gap.gapPercent },
            ], gaps || [])}>Export gaps</button>
          </div>
        )}
      />
      <ReadinessSummary readiness={readiness} />
      <div className="two-column">
        <ReadinessPanel readiness={readiness} />
        <Panel title="Placement summary" description="Signals to share with college leadership.">
          <dl className="settings-list">
            <div><dt>Students in pool</dt><dd>{readiness?.studentCount ?? 0}</dd></div>
            <div><dt>Assessed</dt><dd>{readiness?.assessedStudentCount ?? 0}</dd></div>
            <div><dt>Average readiness</dt><dd>{readiness?.averageScore ?? 0}%</dd></div>
            <div><dt>Priority gaps</dt><dd><Badge tone="danger">{readiness?.distribution?.PRIORITY_GAP ?? 0}</Badge></dd></div>
            <div><dt>Strong performers</dt><dd><Badge tone="positive">{readiness?.distribution?.STRONG ?? 0}</Badge></dd></div>
          </dl>
        </Panel>
      </div>
      <Panel title="Skill gaps" description="Largest gaps to prioritise in placement preparation.">
        <SkillGapTable gaps={gaps} />
      </Panel>
    </div>
  );
}

export function TpoPlacementPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState(null);
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [me, structure, companies, jobs, drives, analytics] = await Promise.all([
        api.get("/college/me"),
        api.get("/college/structure"),
        api.get("/college/placement/companies"),
        api.get("/college/placement/jobs"),
        api.get("/college/placement/drives"),
        api.get("/college/placement/analytics").catch(() => null),
      ]);
      setData({
        me,
        structure,
        companies: companies || [],
        jobs: jobs || [],
        drives: drives || [],
        analytics,
      });
    } catch (reason) {
      setError(reason.message || "Could not load placement data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const permissions = new Set(data?.me?.permissions || []);
  const canManageCompanies = permissions.has("MANAGE_COMPANIES");
  const canManageJobs = permissions.has("MANAGE_JOBS");
  const canManageDrives = permissions.has("MANAGE_DRIVES");
  const canViewContacts = permissions.has("VIEW_COMPANY_CONTACTS");

  const companies = data?.companies || [];
  const jobs = data?.jobs || [];
  const drives = data?.drives || [];
  const analytics = data?.analytics;

  const companyOptions = useMemo(
    () => [{ value: "", label: "Select a company" }, ...companies.map((company) => ({ value: String(company.id), label: company.name }))],
    [companies],
  );
  const jobOptions = useMemo(() => {
    const companyId = modal?.form?.companyId;
    const filtered = companyId ? jobs.filter((job) => String(job.companyId) === String(companyId)) : jobs;
    return [
      { value: "", label: filtered.length ? "Select a job" : "Create a job for this company first" },
      ...filtered.map((job) => ({ value: String(job.id), label: `${job.title} · ${job.companyName}` })),
    ];
  }, [jobs, modal?.form?.companyId]);
  const departmentOptions = useMemo(
    () => [{ value: "", label: "Any department" }, ...(data?.structure?.departments || []).map((item) => ({ value: String(item.id), label: `${item.code} · ${item.name}` }))],
    [data?.structure?.departments],
  );
  const programOptions = useMemo(
    () => [
      { value: "", label: "Any program" },
      ...(data?.structure?.programs || [])
        .filter((item) => !modal?.form?.eligibleDepartmentId || String(item.departmentId) === modal.form.eligibleDepartmentId)
        .map((item) => ({ value: String(item.id), label: `${item.code} · ${item.name}` })),
    ],
    [data?.structure?.programs, modal?.form?.eligibleDepartmentId],
  );
  const batchOptions = useMemo(
    () => [
      { value: "", label: "Any batch" },
      ...(data?.structure?.batches || [])
        .filter((item) => !modal?.form?.eligibleProgramId || String(item.programId) === modal.form.eligibleProgramId)
        .map((item) => ({ value: String(item.id), label: item.label })),
    ],
    [data?.structure?.batches, modal?.form?.eligibleProgramId],
  );

  function openCompany(company = null) {
    setModal({
      kind: "company",
      id: company?.id ?? null,
      form: company
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
        : { ...EMPTY_COMPANY },
    });
  }

  function openJob(job = null) {
    setModal({
      kind: "job",
      id: job?.id ?? null,
      form: job
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
        : { ...EMPTY_JOB },
    });
  }

  function openDrive(drive = null) {
    setModal({
      kind: "drive",
      id: drive?.id ?? null,
      form: drive
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
        : { ...EMPTY_DRIVE },
    });
  }

  function patchForm(patch) {
    setModal((current) => (current ? { ...current, form: { ...current.form, ...patch } } : current));
  }

  async function saveCompany(event) {
    event.preventDefault();
    if (!modal.form.name.trim()) {
      toast.error("Enter a company name.");
      return;
    }
    setBusy(true);
    try {
      const body = {
        ...modal.form,
        name: modal.form.name.trim(),
        industry: modal.form.industry.trim() || null,
        sector: modal.form.sector.trim() || null,
        website: modal.form.website.trim() || null,
        contactName: modal.form.contactName.trim() || null,
        contactEmail: modal.form.contactEmail.trim() || null,
        contactPhone: modal.form.contactPhone.trim() || null,
        source: modal.form.source.trim() || null,
        notes: modal.form.notes.trim() || null,
      };
      if (modal.id) await api.put(`/college/placement/companies/${modal.id}`, body);
      else await api.post("/college/placement/companies", body);
      toast.success(modal.id ? "Company updated." : "Company created.");
      setModal(null);
      await load();
    } catch (reason) {
      toast.error(reason.message || "Could not save the company.");
    } finally {
      setBusy(false);
    }
  }

  async function saveJob(event) {
    event.preventDefault();
    if (!modal.form.companyId || !modal.form.title.trim()) {
      toast.error("Choose a company and enter a job title.");
      return;
    }
    setBusy(true);
    try {
      const body = {
        ...modal.form,
        companyId: Number(modal.form.companyId),
        title: modal.form.title.trim(),
        description: modal.form.description.trim() || null,
        requiredSkills: modal.form.requiredSkills.trim() || null,
        location: modal.form.location.trim() || null,
        eligibilityCriteria: modal.form.eligibilityCriteria.trim() || null,
        salaryMin: modal.form.salaryMin === "" ? null : Number(modal.form.salaryMin),
        salaryMax: modal.form.salaryMax === "" ? null : Number(modal.form.salaryMax),
        currency: modal.form.currency.trim() || null,
        applicationDeadline: modal.form.applicationDeadline || null,
      };
      if (modal.id) await api.put(`/college/placement/jobs/${modal.id}`, body);
      else await api.post("/college/placement/jobs", body);
      toast.success(modal.id ? "Job opening updated." : "Job opening created.");
      setModal(null);
      await load();
    } catch (reason) {
      toast.error(reason.message || "Could not save the job opening.");
    } finally {
      setBusy(false);
    }
  }

  async function saveDrive(event) {
    event.preventDefault();
    if (!modal.form.companyId || !modal.form.jobId || !modal.form.name.trim()) {
      toast.error("Choose a company, a job and a drive name.");
      return;
    }
    setBusy(true);
    try {
      const body = {
        ...modal.form,
        companyId: Number(modal.form.companyId),
        jobId: Number(modal.form.jobId),
        name: modal.form.name.trim(),
        registrationStart: modal.form.registrationStart || null,
        registrationEnd: modal.form.registrationEnd || null,
        driveDate: modal.form.driveDate || null,
        eligibilityCriteria: modal.form.eligibilityCriteria.trim() || null,
        eligibleDepartmentId: modal.form.eligibleDepartmentId ? Number(modal.form.eligibleDepartmentId) : null,
        eligibleProgramId: modal.form.eligibleProgramId ? Number(modal.form.eligibleProgramId) : null,
        eligibleBatchId: modal.form.eligibleBatchId ? Number(modal.form.eligibleBatchId) : null,
        eligibleGraduationYear: modal.form.eligibleGraduationYear === "" ? null : Number(modal.form.eligibleGraduationYear),
        minimumReadinessPercent: modal.form.minimumReadinessPercent === "" ? null : Number(modal.form.minimumReadinessPercent),
      };
      if (modal.id) await api.put(`/college/placement/drives/${modal.id}`, body);
      else await api.post("/college/placement/drives", body);
      toast.success(modal.id ? "Placement drive updated." : "Placement drive created.");
      setModal(null);
      await load();
    } catch (reason) {
      toast.error(reason.message || "Could not save the placement drive.");
    } finally {
      setBusy(false);
    }
  }

  async function openDetail(drive) {
    setDetail({ loading: true, drive });
    try {
      const snapshot = await api.get(`/college/placement/drives/${drive.id}`);
      setDetail({ loading: false, ...snapshot });
    } catch (reason) {
      setDetail(null);
      toast.error(reason.message || "Could not load this drive.");
    }
  }

  if (loading) return <LoadingBlock label="Loading placement workspace…" />;
  if (error) {
    return (
      <div className="workspace-page-content">
        <PageHeader eyebrow="PLACEMENT" title="Placement drives" description="Companies, job openings and drives inside your institution." />
        <ErrorBlock message={error} onRetry={load} />
      </div>
    );
  }

  const openJobs = jobs.filter((job) => job.status === "OPEN").length;
  const openDrives = drives.filter((drive) => ["REGISTRATION_OPEN", "ONGOING"].includes(drive.status)).length;

  return (
    <div className="workspace-page-content">
      <PageHeader
        eyebrow="PLACEMENT OFFICER"
        title="Placement drives"
        description="Manage recruiting companies, job openings, eligibility and application outcomes for your institution."
        actions={
          <div className="button-row">
            <button type="button" className="secondary-button" onClick={load} disabled={loading}>Refresh</button>
            {canManageDrives && <button type="button" className="primary-button" onClick={() => openDrive()} disabled={!jobs.length}>New drive</button>}
          </div>
        }
      />

      <div className="stat-grid stat-grid-4">
        <StatCard label="Companies" value={companies.length} hint="Recruiting partners" icon="building" />
        <StatCard label="Open jobs" value={openJobs} hint={`${jobs.length} job openings`} icon="briefcase" />
        <StatCard label="Live drives" value={openDrives} hint={`${drives.length} drives scheduled`} icon="calendar" />
        <StatCard label="Applications" value={analytics?.totalApplications ?? 0} hint={`${analytics?.offersMade ?? 0} offers recorded`} icon="users" />
      </div>

      <Panel
        title="Companies"
        description="Contact details are visible only to placement roles."
        actions={canManageCompanies && <button type="button" className="secondary-button" onClick={() => openCompany()}>Add company</button>}
      >
        <DataTable
          empty="No companies yet"
          rows={companies}
          getKey={(company) => company.id}
          columns={[
            { key: "name", label: "Company", render: (company) => <div><strong>{company.name}</strong><p className="muted">{[company.industry, company.sector].filter(Boolean).join(" · ") || "Industry not set"}</p></div> },
            { key: "status", label: "Recruitment", render: (company) => <Badge tone={company.recruitmentStatus === "ACTIVE" ? "positive" : company.recruitmentStatus === "BLOCKED" ? "danger" : "muted"}>{pretty(company.recruitmentStatus)}</Badge> },
            { key: "contact", label: "Contact", render: (company) => canViewContacts ? <div><strong>{company.contactName || "No contact"}</strong><p className="muted">{company.contactEmail || company.contactPhone || "No details"}</p></div> : <span className="muted">Restricted</span> },
            { key: "actions", label: "", render: (company) => canManageCompanies && <button type="button" className="link-button" onClick={() => openCompany(company)}>Edit</button> },
          ]}
        />
      </Panel>

      <Panel
        title="Job openings"
        description="Role details, salary bands and application deadlines."
        actions={canManageJobs && <button type="button" className="secondary-button" onClick={() => openJob()} disabled={!companies.length}>Add job</button>}
      >
        <DataTable
          empty="No job openings yet"
          rows={jobs}
          getKey={(job) => job.id}
          columns={[
            { key: "title", label: "Role", render: (job) => <div><strong>{job.title}</strong><p className="muted">{job.companyName} · {job.location || "Location not set"}</p></div> },
            { key: "type", label: "Type", render: (job) => pretty(job.employmentType) },
            { key: "salary", label: "Salary", render: (job) => job.salaryMin == null && job.salaryMax == null ? "Not disclosed" : `${money(job.salaryMin, job.currency)} – ${money(job.salaryMax, job.currency)}` },
            { key: "deadline", label: "Deadline", render: (job) => job.applicationDeadline ? formatDate(job.applicationDeadline) : "Not set" },
            { key: "status", label: "Status", render: (job) => <Badge tone={job.status === "OPEN" ? "positive" : job.status === "CLOSED" ? "danger" : "muted"}>{pretty(job.status)}</Badge> },
            { key: "actions", label: "", render: (job) => canManageJobs && <button type="button" className="link-button" onClick={() => openJob(job)}>Edit</button> },
          ]}
        />
      </Panel>

      <Panel
        title="Placement drives"
        description="Registration windows, eligibility criteria and application counts."
        actions={canManageDrives && <button type="button" className="secondary-button" onClick={() => openDrive()} disabled={!jobs.length}>Add drive</button>}
      >
        <DataTable
          empty="No placement drives yet"
          rows={drives}
          getKey={(drive) => drive.id}
          columns={[
            { key: "name", label: "Drive", render: (drive) => <div><strong>{drive.name}</strong><p className="muted">{drive.driveDate ? formatDate(drive.driveDate) : "Date not set"}</p></div> },
            { key: "company", label: "Company / role", render: (drive) => <div><strong>{drive.companyName}</strong><p className="muted">{drive.jobTitle}</p></div> },
            { key: "registration", label: "Registration", render: (drive) => <span className="muted">{drive.registrationStart ? formatDate(drive.registrationStart) : "Open"} – {drive.registrationEnd ? formatDate(drive.registrationEnd) : "no deadline"}</span> },
            { key: "eligibility", label: "Eligibility", render: (drive) => <span className="muted">{eligibilityText(drive)}</span> },
            { key: "applications", label: "Applications", render: (drive) => drive.applicationCount },
            { key: "status", label: "Status", render: (drive) => <Badge tone={drive.status === "REGISTRATION_OPEN" ? "positive" : drive.status === "CANCELLED" ? "danger" : "muted"}>{pretty(drive.status)}</Badge> },
            {
              key: "actions",
              label: "",
              render: (drive) => (
                <div className="button-row">
                  <button type="button" className="link-button" onClick={() => openDetail(drive)}>Open</button>
                  {canManageDrives && <button type="button" className="link-button" onClick={() => openDrive(drive)}>Edit</button>}
                </div>
              ),
            },
          ]}
        />
      </Panel>

      {analytics && (
        <div className="two-column">
          <Panel title="Department outcomes" description="Placement performance across your academic scope.">
            <DataTable
              empty="No department outcomes yet"
              rows={analytics.departmentOutcomes || []}
              getKey={(row) => row.departmentId}
              columns={[
                { key: "department", label: "Department", render: (row) => row.departmentName },
                { key: "eligible", label: "Eligible", render: (row) => row.eligibleGraduatingStudents },
                { key: "participants", label: "Participants", render: (row) => row.driveParticipants },
                { key: "offers", label: "Offers", render: (row) => row.offers },
                { key: "placement", label: "Placed", render: (row) => row.placementRate == null ? "—" : `${row.placementRate}%` },
              ]}
            />
          </Panel>
          <Panel title="Company outcomes" description="Applications, offers and joiners by company.">
            <DataTable
              empty="No company outcomes yet"
              rows={analytics.companyOutcomes || []}
              getKey={(row) => row.companyId}
              columns={[
                { key: "company", label: "Company", render: (row) => row.companyName },
                { key: "drives", label: "Drives", render: (row) => row.drives },
                { key: "applications", label: "Applications", render: (row) => row.applications },
                { key: "offers", label: "Offers", render: (row) => row.offers },
                { key: "joined", label: "Joined", render: (row) => row.joined },
              ]}
            />
          </Panel>
        </div>
      )}

      {modal?.kind === "company" && (
        <Modal
          title={modal.id ? "Edit company" : "Add company"}
          description="Company contact details are stored inside your institution only."
          onClose={() => setModal(null)}
          wide
        >
          <form className="stack-form" onSubmit={saveCompany}>
            <label className="form-field">Company name
              <input required maxLength={180} value={modal.form.name} onChange={(event) => patchForm({ name: event.target.value })} />
            </label>
            <div className="form-grid">
              <label className="form-field">Industry
                <input maxLength={120} value={modal.form.industry} onChange={(event) => patchForm({ industry: event.target.value })} />
              </label>
              <label className="form-field">Sector
                <input maxLength={120} value={modal.form.sector} onChange={(event) => patchForm({ sector: event.target.value })} />
              </label>
            </div>
            <label className="form-field">Website
              <input type="url" maxLength={250} value={modal.form.website} onChange={(event) => patchForm({ website: event.target.value })} />
            </label>
            <div className="form-grid-3">
              <label className="form-field">Contact name
                <input maxLength={120} value={modal.form.contactName} onChange={(event) => patchForm({ contactName: event.target.value })} />
              </label>
              <label className="form-field">Contact email
                <input type="email" maxLength={190} value={modal.form.contactEmail} onChange={(event) => patchForm({ contactEmail: event.target.value })} />
              </label>
              <label className="form-field">Contact phone
                <input maxLength={30} value={modal.form.contactPhone} onChange={(event) => patchForm({ contactPhone: event.target.value })} />
              </label>
            </div>
            <div className="form-grid">
              <label className="form-field">Recruitment status
                <select value={modal.form.recruitmentStatus} onChange={(event) => patchForm({ recruitmentStatus: event.target.value })}>
                  {COMPANY_STATUSES.map((value) => <option key={value} value={value}>{pretty(value)}</option>)}
                </select>
              </label>
              <label className="form-field">Source
                <input maxLength={120} value={modal.form.source} onChange={(event) => patchForm({ source: event.target.value })} />
              </label>
            </div>
            <label className="form-field">Notes
              <textarea maxLength={1000} value={modal.form.notes} onChange={(event) => patchForm({ notes: event.target.value })} />
            </label>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="primary-button" disabled={busy}>{busy ? "Saving…" : modal.id ? "Save company" : "Create company"}</button>
            </div>
          </form>
        </Modal>
      )}

      {modal?.kind === "job" && (
        <Modal
          title={modal.id ? "Edit job opening" : "Add job opening"}
          description="A drive must reference a job that belongs to the same company."
          onClose={() => setModal(null)}
          wide
        >
          <form className="stack-form" onSubmit={saveJob}>
            <div className="form-grid">
              <label className="form-field">Company
                <select required value={modal.form.companyId} onChange={(event) => patchForm({ companyId: event.target.value })}>
                  {companyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="form-field">Job title
                <input required maxLength={180} value={modal.form.title} onChange={(event) => patchForm({ title: event.target.value })} />
              </label>
            </div>
            <label className="form-field">Description
              <textarea maxLength={4000} value={modal.form.description} onChange={(event) => patchForm({ description: event.target.value })} />
            </label>
            <div className="form-grid">
              <label className="form-field">Required skills
                <input maxLength={1000} value={modal.form.requiredSkills} onChange={(event) => patchForm({ requiredSkills: event.target.value })} />
              </label>
              <label className="form-field">Location
                <input maxLength={160} value={modal.form.location} onChange={(event) => patchForm({ location: event.target.value })} />
              </label>
            </div>
            <label className="form-field">Eligibility criteria
              <textarea maxLength={2000} value={modal.form.eligibilityCriteria} onChange={(event) => patchForm({ eligibilityCriteria: event.target.value })} />
            </label>
            <div className="form-grid-3">
              <label className="form-field">Employment type
                <select value={modal.form.employmentType} onChange={(event) => patchForm({ employmentType: event.target.value })}>
                  {EMPLOYMENT_TYPES.map((value) => <option key={value} value={value}>{pretty(value)}</option>)}
                </select>
              </label>
              <label className="form-field">Salary min
                <input type="number" min="0" step="0.01" value={modal.form.salaryMin} onChange={(event) => patchForm({ salaryMin: event.target.value })} />
              </label>
              <label className="form-field">Salary max
                <input type="number" min="0" step="0.01" value={modal.form.salaryMax} onChange={(event) => patchForm({ salaryMax: event.target.value })} />
              </label>
            </div>
            <div className="form-grid-3">
              <label className="form-field">Currency
                <input maxLength={10} value={modal.form.currency} onChange={(event) => patchForm({ currency: event.target.value })} />
              </label>
              <label className="form-field">Application deadline
                <input type="date" value={modal.form.applicationDeadline} onChange={(event) => patchForm({ applicationDeadline: event.target.value })} />
              </label>
              <label className="form-field">Status
                <select value={modal.form.status} onChange={(event) => patchForm({ status: event.target.value })}>
                  {JOB_STATUSES.map((value) => <option key={value} value={value}>{pretty(value)}</option>)}
                </select>
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="primary-button" disabled={busy}>{busy ? "Saving…" : modal.id ? "Save job" : "Create job"}</button>
            </div>
          </form>
        </Modal>
      )}

      {modal?.kind === "drive" && (
        <Modal
          title={modal.id ? "Edit placement drive" : "Schedule placement drive"}
          description="Academic eligibility is validated against your institution hierarchy."
          onClose={() => setModal(null)}
          wide
        >
          <form className="stack-form" onSubmit={saveDrive}>
            <div className="form-grid">
              <label className="form-field">Company
                <select required value={modal.form.companyId} onChange={(event) => patchForm({ companyId: event.target.value, jobId: "" })}>
                  {companyOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="form-field">Job opening
                <select required value={modal.form.jobId} onChange={(event) => patchForm({ jobId: event.target.value })}>
                  {jobOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>
            <label className="form-field">Drive name
              <input required maxLength={180} value={modal.form.name} onChange={(event) => patchForm({ name: event.target.value })} />
            </label>
            <div className="form-grid-3">
              <label className="form-field">Registration starts
                <input type="date" value={modal.form.registrationStart} onChange={(event) => patchForm({ registrationStart: event.target.value })} />
              </label>
              <label className="form-field">Registration deadline
                <input type="date" value={modal.form.registrationEnd} onChange={(event) => patchForm({ registrationEnd: event.target.value })} />
              </label>
              <label className="form-field">Drive date
                <input type="date" value={modal.form.driveDate} onChange={(event) => patchForm({ driveDate: event.target.value })} />
              </label>
            </div>
            <label className="form-field">Eligibility criteria
              <textarea maxLength={2000} value={modal.form.eligibilityCriteria} onChange={(event) => patchForm({ eligibilityCriteria: event.target.value })} />
            </label>
            <div className="form-grid-3">
              <label className="form-field">Eligible department
                <select value={modal.form.eligibleDepartmentId} onChange={(event) => patchForm({ eligibleDepartmentId: event.target.value, eligibleProgramId: "", eligibleBatchId: "" })}>
                  {departmentOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="form-field">Eligible program
                <select value={modal.form.eligibleProgramId} onChange={(event) => patchForm({ eligibleProgramId: event.target.value, eligibleBatchId: "" })}>
                  {programOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="form-field">Eligible batch
                <select value={modal.form.eligibleBatchId} onChange={(event) => patchForm({ eligibleBatchId: event.target.value })}>
                  {batchOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>
            <div className="form-grid-3">
              <label className="form-field">Graduation year
                <input type="number" min="2000" max="2100" value={modal.form.eligibleGraduationYear} onChange={(event) => patchForm({ eligibleGraduationYear: event.target.value })} />
              </label>
              <label className="form-field">Minimum readiness (%)
                <input type="number" min="0" max="100" value={modal.form.minimumReadinessPercent} onChange={(event) => patchForm({ minimumReadinessPercent: event.target.value })} />
              </label>
              <label className="form-field">Status
                <select value={modal.form.status} onChange={(event) => patchForm({ status: event.target.value })}>
                  {DRIVE_STATUSES.map((value) => <option key={value} value={value}>{pretty(value)}</option>)}
                </select>
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="primary-button" disabled={busy}>{busy ? "Saving…" : modal.id ? "Save drive" : "Create drive"}</button>
            </div>
          </form>
        </Modal>
      )}

      {detail && (
        <Modal
          title={detail.loading ? "Loading drive…" : detail.drive?.name || "Placement drive"}
          description={detail.loading ? "Fetching eligible students and applications." : `${detail.drive?.companyName || ""} · ${detail.drive?.jobTitle || ""}`}
          onClose={() => setDetail(null)}
          wide
        >
          {detail.loading ? <LoadingBlock label="Loading drive details…" /> : (
            <>
              <dl className="detail-meta">
                <div><dt>Status</dt><dd>{pretty(detail.drive?.status)}</dd></div>
                <div><dt>Drive date</dt><dd>{formatDate(detail.drive?.driveDate)}</dd></div>
                <div><dt>Registration</dt><dd>{formatDate(detail.drive?.registrationStart)} – {formatDate(detail.drive?.registrationEnd)}</dd></div>
                <div><dt>Eligibility</dt><dd>{eligibilityText(detail.drive || {})}</dd></div>
                <div><dt>Eligible students</dt><dd>{detail.eligibleStudents?.length ?? 0}</dd></div>
                <div><dt>Applications</dt><dd>{detail.applications?.length ?? 0}</dd></div>
              </dl>
              <Panel title="Applications" description="Student progress through this drive.">
                <DataTable
                  empty="No applications for this drive yet"
                  rows={detail.applications || []}
                  getKey={(application) => application.id}
                  columns={[
                    { key: "student", label: "Student", render: (application) => <div><strong>{application.studentName || "Unknown"}</strong><p className="muted">{application.rollNumber || application.studentId || "—"}</p></div> },
                    { key: "department", label: "Department", render: (application) => application.departmentName || "—" },
                    { key: "stage", label: "Stage", render: (application) => <Badge tone={application.stage === "OFFERED" || application.stage === "JOINED" ? "positive" : application.stage === "REJECTED" || application.stage === "WITHDRAWN" ? "danger" : "info"}>{pretty(application.stage)}</Badge> },
                    { key: "offer", label: "Offer", render: (application) => application.offer ? <span>{pretty(application.offer.status)} · {money(application.offer.packageAmount, application.offer.currency)}</span> : <span className="muted">—</span> },
                    { key: "applied", label: "Applied", render: (application) => formatDate(application.appliedAt) },
                  ]}
                />
              </Panel>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

function pretty(value) {
  if (!value) return "Not set";
  return String(value).toLowerCase().split("_").map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join(" ");
}

function money(value, currency = "INR") {
  if (value == null || value === "") return "Not set";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "INR", maximumFractionDigits: 0 }).format(Number(value));
  } catch {
    return `${currency || ""} ${value}`.trim();
  }
}

function eligibilityText(drive) {
  return [
    drive.eligibleDepartmentName,
    drive.eligibleProgramName,
    drive.eligibleBatchLabel,
    drive.eligibleGraduationYear ? `Class of ${drive.eligibleGraduationYear}` : null,
    drive.minimumReadinessPercent != null ? `${drive.minimumReadinessPercent}% readiness` : null,
  ].filter(Boolean).join(" · ") || "All students";
}

export function TpoSettingsPage() {
  return <SettingsPage label="TPO / Placement Officer" />;
}
