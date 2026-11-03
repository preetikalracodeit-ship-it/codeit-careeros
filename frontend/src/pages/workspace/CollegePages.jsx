import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../../lib/api.js";
import { useApi } from "../../lib/useApi.js";
import { ROLE_LABELS } from "../../lib/roles.js";
import { Icon } from "../../components/Icon.jsx";
import { Badge, DataTable, ErrorBlock, LoadingBlock, PageHeader, Panel, StatCard, statusTone } from "../../components/ui.jsx";
import { SettingsPage, StudentDetailDrawer, StudentsTable, formatDate, scoreTone } from "./shared.jsx";

const STAFF_ROLE_OPTIONS = ["COLLEGE_ADMIN", "TPO", "HOD", "FACULTY"];

export function CollegeDashboardPage() {
  const { data, loading, error, reload } = useApi("/college/dashboard");
  const staffQuery = useApi("/college/staff/members");
  if (loading || staffQuery.loading) return <LoadingBlock label="Loading college workspace…" />;
  if (error || staffQuery.error) {
    return <ErrorBlock message={error || staffQuery.error} onRetry={() => { reload(); staffQuery.reload(); }} />;
  }
  const staff = (staffQuery.data || []).filter((member) => member.status === "ACTIVE");
  const recentStaff = (staffQuery.data || []).slice(0, 5);

  return (
    <div className="workspace-page-content">
      <PageHeader
        eyebrow="COLLEGE ADMIN"
        title={data?.institutionName || "College workspace"}
        description="Monitor enrollment, assessment participation, readiness, and cohort performance."
        actions={<Link className="primary-button" to="/college/staff">Add staff</Link>}
      />

      <div className="stat-grid stat-grid-4">
        <StatCard label="Enrolled" value={data?.totalEnrolled ?? 0} hint="Matching the current cohort scope" icon="users" />
        <StatCard label="Active students" value={data?.activeStudents ?? 0} icon="activity" />
        <StatCard label="Staff" value={staff.length} hint="Active college memberships" icon="shield" />
        <StatCard label="Assessment participants" value={data?.assessmentParticipants ?? 0} hint={`${data?.assessmentCompletionPercent ?? "—"}% of active students`} icon="clipboard" />
      </div>

      <div className="two-column">
        <Panel title="Readiness distribution" description={`${data?.readinessEvaluated ?? 0} active students evaluated against their target career.`}>
          <DataTable
            empty="No students have an evaluated readiness score yet"
            rows={data?.readinessDistribution || []}
            getKey={(item) => item.band}
            columns={[
              { key: "band", label: "Readiness band" },
              { key: "students", label: "Students" },
            ]}
          />
        </Panel>
        <Panel title="Quick actions" description="Common college administration tasks.">
          <div className="quick-actions">
            <Link to="/college/profile"><Icon name="building" size={18} /> Update college profile</Link>
            <Link to="/college/departments"><Icon name="layers" size={18} /> Manage departments</Link>
            <Link to="/college/batches"><Icon name="calendar" size={18} /> Manage batches</Link>
            <Link to="/college/staff"><Icon name="shield" size={18} /> Staff & permissions</Link>
            <Link to="/college/reports"><Icon name="chart" size={18} /> Readiness reports</Link>
          </div>
        </Panel>
      </div>

      <Panel title="Common skill gaps" description="Skills with the most students currently below their career framework target.">
        <DataTable
          empty="No assessed skill gaps are available for this cohort"
          rows={data?.commonGaps || []}
          getKey={(gap) => gap.skillId}
          columns={[
            { key: "skillName", label: "Skill" },
            { key: "studentsBelowTarget", label: "Below target" },
            { key: "assessedStudents", label: "Assessed" },
            { key: "percentBelowTarget", label: "Below target %" },
          ]}
        />
      </Panel>

      <Panel title="Department comparison" description="Enrollment, assessment participation, and readiness by department.">
        <DataTable
          empty="No department data is available for this cohort"
          rows={data?.departmentComparisons || []}
          getKey={(department) => department.departmentId}
          columns={[
            { key: "departmentName", label: "Department" },
            { key: "enrolled", label: "Enrolled" },
            { key: "active", label: "Active" },
            { key: "assessmentParticipants", label: "Assessed" },
            { key: "readinessEvaluated", label: "Readiness evaluated" },
            { key: "averageReadinessPercent", label: "Average readiness" },
          ]}
        />
      </Panel>

      <Panel title="Batch comparison" description="Assessment coverage across batches in this cohort.">
        <DataTable
          empty="No batch data is available for this cohort"
          rows={data?.batchComparisons || []}
          getKey={(batch) => batch.batchId}
          columns={[
            { key: "departmentName", label: "Department" },
            { key: "programName", label: "Program" },
            { key: "batchLabel", label: "Batch" },
            { key: "enrolled", label: "Enrolled" },
            { key: "active", label: "Active" },
            { key: "assessmentParticipants", label: "Assessed" },
            { key: "assessmentCoveragePercent", label: "Coverage %" },
          ]}
        />
      </Panel>

      <Panel title="Recent staff" description="Administrators and faculty assigned to your college." actions={<Link className="link-button" to="/college/staff">View all</Link>}>
        <DataTable
          empty="No staff assigned yet"
          rows={recentStaff}
          getKey={(member) => member.id}
          columns={[
            {
              key: "name",
              label: "Staff",
              render: (member) => (
                <div className="table-person">
                  <span className="stack-avatar"><Icon name="shield" size={16} /></span>
                  <div><strong>{member.fullName}</strong><span>{member.email}</span></div>
                </div>
              ),
            },
            { key: "role", label: "Role", render: (member) => <Badge tone="info">{ROLE_LABELS[member.designation] || member.designation}</Badge> },
            { key: "status", label: "Status", render: (member) => <Badge tone={statusTone(member.status)}>{member.status}</Badge> },
            { key: "joined", label: "Added", render: (member) => formatDate(member.createdAt) },
          ]}
        />
      </Panel>
    </div>
  );
}

export function CollegeProfilePage() {
  const { data, loading, error, reload } = useApi("/workspace/me");
  const college = data?.college;
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (college) {
      setForm({
        name: college.name || "",
        code: college.code || "",
        city: college.city || "",
        state: college.state || "",
        website: college.website || "",
        contactEmail: college.contactEmail || "",
        status: college.status || "ACTIVE",
      });
    }
  }, [college]);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.patch(`/workspace/colleges/${college.id}`, form);
      toast.success("College profile updated.");
      reload();
    } catch (reason) {
      toast.error(reason.message || "Unable to update the college profile.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!college) {
    return (
      <div className="workspace-page-content">
        <PageHeader eyebrow="COLLEGE PROFILE" title="College profile" description="Your account is not yet attached to a college workspace." />
      </div>
    );
  }

  return (
    <div className="workspace-page-content">
      <PageHeader eyebrow="COLLEGE PROFILE" title="College information" description="Keep your institution details accurate for staff and students." actions={<Badge tone={statusTone(college.status)}>{college.status}</Badge>} />
      <Panel title="Institution details" description="These details appear across the college workspace.">
        {form && (
          <form className="stack-form wide-form" onSubmit={save}>
            <div className="form-row">
              <label className="form-field">College name
                <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </label>
              <label className="form-field">College code
                <input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
              </label>
            </div>
            <div className="form-row">
              <label className="form-field">City
                <input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
              </label>
              <label className="form-field">State
                <input value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} />
              </label>
            </div>
            <div className="form-row">
              <label className="form-field">Website
                <input value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} placeholder="https://college.edu" />
              </label>
              <label className="form-field">Contact email
                <input type="email" value={form.contactEmail} onChange={(event) => setForm({ ...form, contactEmail: event.target.value })} />
              </label>
            </div>
            <label className="form-field">Workspace status
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                <option value="ACTIVE">Active</option>
                <option value="ONBOARDING">Onboarding</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </label>
            <div className="form-actions">
              <button className="primary-button" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
            </div>
          </form>
        )}
      </Panel>
    </div>
  );
}

export function CollegeDepartmentsPage() {
  const { data, loading, error, reload } = useApi("/workspace/department");
  const [form, setForm] = useState({ name: "", code: "", hodName: "" });
  const [busy, setBusy] = useState(false);
  const college = data?.college;

  async function addDepartment(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post(`/workspace/colleges/${college.id}/departments`, form);
      toast.success("Department added.");
      setForm({ name: "", code: "", hodName: "" });
      reload();
    } catch (reason) {
      toast.error(reason.message || "Unable to add the department.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;

  return (
    <div className="workspace-page-content">
      <PageHeader eyebrow="STRUCTURE" title="Departments" description="Define the academic departments inside your college and assign department heads." />
      <div className="split-layout">
        <Panel title={`${data?.departments?.length ?? 0} departments`}>
          <DataTable
            empty="No departments yet"
            rows={data?.departments || []}
            getKey={(department) => department.id}
            columns={[
              { key: "name", label: "Department", render: (department) => <strong>{department.name}</strong> },
              { key: "code", label: "Code", render: (department) => <Badge tone="muted">{department.code}</Badge> },
              { key: "hod", label: "HOD", render: (department) => department.hodName || "—" },
              { key: "batches", label: "Batches", render: (department) => (data?.batches || []).filter((batch) => batch.departmentId === department.id).length },
            ]}
          />
        </Panel>
        <Panel title="Add department" description="Create a department and set its coordinator.">
          <form className="stack-form" onSubmit={addDepartment}>
            <label className="form-field">Department name
              <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Computer Science" />
            </label>
            <label className="form-field">Department code
              <input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="CSE" />
            </label>
            <label className="form-field">HOD name
              <input value={form.hodName} onChange={(event) => setForm({ ...form, hodName: event.target.value })} placeholder="Dr. Anjali Rao" />
            </label>
            <button className="primary-button" disabled={busy}>{busy ? "Adding…" : "Add department"}</button>
          </form>
        </Panel>
      </div>
    </div>
  );
}

export function CollegeBatchesPage() {
  const { data, loading, error, reload } = useApi("/workspace/department");
  const [form, setForm] = useState({ name: "", departmentId: "", year: new Date().getFullYear() });
  const [busy, setBusy] = useState(false);
  const college = data?.college;

  async function addBatch(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post(`/workspace/colleges/${college.id}/batches`, form);
      toast.success("Batch added.");
      setForm({ name: "", departmentId: "", year: new Date().getFullYear() });
      reload();
    } catch (reason) {
      toast.error(reason.message || "Unable to add the batch.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;

  const departmentName = (id) => data?.departments?.find((department) => department.id === id)?.name || id;

  return (
    <div className="workspace-page-content">
      <PageHeader eyebrow="STRUCTURE" title="Batches" description="Group students into graduating cohorts within each department." />
      <div className="split-layout">
        <Panel title={`${data?.batches?.length ?? 0} batches`}>
          <DataTable
            empty="No batches yet"
            rows={data?.batches || []}
            getKey={(batch) => batch.id}
            columns={[
              { key: "name", label: "Batch", render: (batch) => <strong>{batch.name}</strong> },
              { key: "department", label: "Department", render: (batch) => departmentName(batch.departmentId) },
              { key: "year", label: "Start year", render: (batch) => batch.year },
            ]}
          />
        </Panel>
        <Panel title="Add batch" description="Create a new cohort for a department.">
          <form className="stack-form" onSubmit={addBatch}>
            <label className="form-field">Batch name
              <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="CSE 2024-2028" />
            </label>
            <label className="form-field">Department
              <select required value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })}>
                <option value="">Select department</option>
                {(data?.departments || []).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select>
            </label>
            <label className="form-field">Start year
              <input type="number" required value={form.year} onChange={(event) => setForm({ ...form, year: event.target.value })} />
            </label>
            <button className="primary-button" disabled={busy}>{busy ? "Adding…" : "Add batch"}</button>
          </form>
        </Panel>
      </div>
    </div>
  );
}

export function CollegeStaffPage() {
  const { data: staff, loading, error, reload } = useApi("/workspace/staff");
  const { data: structure } = useApi("/workspace/department");
  const [form, setForm] = useState({ fullName: "", email: "", password: "DemoPass123", role: "FACULTY", departmentId: "" });
  const [busy, setBusy] = useState(false);
  const [roleFilter, setRoleFilter] = useState("ALL");

  const filtered = useMemo(
    () => (staff || []).filter((member) => roleFilter === "ALL" || member.role === roleFilter),
    [staff, roleFilter],
  );
  const departmentName = (id) => structure?.departments?.find((department) => department.id === id)?.name || "—";

  async function createStaff(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post("/workspace/staff", {
        ...form,
        departmentId: form.departmentId ? Number(form.departmentId) : undefined,
      });
      toast.success("Staff login created.");
      setForm({ fullName: "", email: "", password: "DemoPass123", role: "FACULTY", departmentId: "" });
      reload();
    } catch (reason) {
      toast.error(reason.message || "Unable to create the staff login.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus(member) {
    try {
      await api.patch(`/workspace/staff/${member.id}`, { status: member.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" });
      toast.success(member.status === "ACTIVE" ? "Staff access suspended." : "Staff access restored.");
      reload();
    } catch (reason) {
      toast.error(reason.message || "Unable to update staff access.");
    }
  }

  return (
    <div className="workspace-page-content">
      <PageHeader eyebrow="STAFF & PERMISSIONS" title="Staff and permissions" description="Manage college administrators, placement officers, HODs, and faculty accounts." />
      <div className="split-layout">
        <Panel
          title={loading ? "Staff" : `${filtered.length} staff accounts`}
          actions={
            <select className="inline-select" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
              <option value="ALL">All roles</option>
              {STAFF_ROLE_OPTIONS.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
            </select>
          }
        >
          {loading ? <LoadingBlock /> : error ? <ErrorBlock message={error} onRetry={reload} /> : (
            <DataTable
              empty="No staff match this filter"
              rows={filtered}
              getKey={(member) => member.id}
              columns={[
                {
                  key: "name",
                  label: "Staff",
                  render: (member) => (
                    <div className="table-person">
                      <span className="stack-avatar"><Icon name="shield" size={16} /></span>
                      <div><strong>{member.fullName}</strong><span>{member.email}</span></div>
                    </div>
                  ),
                },
                { key: "role", label: "Role", render: (member) => <Badge tone="info">{ROLE_LABELS[member.role] || member.role}</Badge> },
                { key: "department", label: "Department", render: (member) => departmentName(member.departmentId) },
                { key: "status", label: "Status", render: (member) => <Badge tone={statusTone(member.status)}>{member.status}</Badge> },
                {
                  key: "action",
                  label: "",
                  render: (member) => <button type="button" className="link-button" onClick={() => toggleStatus(member)}>{member.status === "ACTIVE" ? "Suspend" : "Restore"}</button>,
                },
              ]}
            />
          )}
        </Panel>
        <Panel title="Add staff login" description="Provision a new staff account for your college.">
          <form className="stack-form" onSubmit={createStaff}>
            <label className="form-field">Full name
              <input required value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder="Prof. Vikram Shah" />
            </label>
            <label className="form-field">Work email
              <input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="vikram@college.edu" />
            </label>
            <label className="form-field">Role
              <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
                {STAFF_ROLE_OPTIONS.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
              </select>
            </label>
            <label className="form-field">Department (optional)
              <select value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })}>
                <option value="">No department</option>
                {(structure?.departments || []).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select>
            </label>
            <label className="form-field">Temporary password
              <input required minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
            </label>
            <button className="primary-button" disabled={busy}>{busy ? "Creating…" : "Create staff login"}</button>
          </form>
        </Panel>
      </div>
    </div>
  );
}

export function CollegeStudentsPage() {
  const { data, loading, error, reload } = useApi("/college/students", { params: { size: 100 } });
  const access = useApi("/college/me");
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [importBusy, setImportBusy] = useState(false);
  const students = useMemo(
    () => (data?.items || []).map((student) => ({ ...student, branch: student.branch || student.departmentName })),
    [data],
  );

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return students.filter((student) => !term || `${student.fullName} ${student.studentId} ${student.departmentName || ""} ${student.rollNumber || ""}`.toLowerCase().includes(term));
  }, [students, query]);

  async function openStudent(student) {
    try {
      const detail = await api.get(`/college/students/${student.id}`);
      setDetail({
        ...detail.profile,
        branch: detail.profile.branch || detail.enrollment.departmentName,
        collegeName: detail.enrollment.institutionName,
        attempts: detail.assessmentHistory.map((attempt) => ({
          ...attempt,
          id: attempt.attemptId,
        })),
      });
    } catch (reason) {
      toast.error(reason.message || "Unable to load the student profile.");
    }
  }

  async function createPreview(event) {
    event.preventDefault();
    if (!file) return;
    setImportBusy(true);
    setPreview(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      setPreview(await api.post("/college/students/import/preview", formData));
    } catch (reason) {
      toast.error(reason.message || "Unable to preview this student import.");
    } finally {
      setImportBusy(false);
    }
  }

  async function commitImport() {
    if (!preview?.jobId) return;
    setImportBusy(true);
    try {
      setPreview(await api.post(`/college/students/import/${preview.jobId}/commit`));
      setFile(null);
      reload();
      toast.success("Student import completed.");
    } catch (reason) {
      toast.error(reason.message || "Unable to complete this student import.");
    } finally {
      setImportBusy(false);
    }
  }

  function downloadImportErrors() {
    if (!preview?.errorCsv) return;
    const url = URL.createObjectURL(new Blob([preview.errorCsv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "careeros-student-import-errors.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="workspace-page-content">
      <PageHeader eyebrow="STUDENTS" title="College students" description="View student profiles and career targets across your college." />
      {access.data?.permissions?.includes("IMPORT_STUDENTS") && <Panel title="Import students" description="Upload a CSV to validate the roster, review errors, then commit ready rows. New accounts are not sent credentials or activation links.">
        <form className="form-grid" onSubmit={createPreview}>
          <label className="field">
            <span>Student roster (.csv)</span>
            <input type="file" accept=".csv,text/csv" onChange={(event) => { setFile(event.target.files?.[0] || null); setPreview(null); }} />
          </label>
          <div className="form-actions">
            <button type="submit" className="primary-button" disabled={!file || importBusy}>
              {importBusy ? "Validating…" : "Preview import"}
            </button>
            {preview?.status === "PREVIEW" && (
              <button type="button" className="secondary-button" disabled={importBusy || !preview.readyRows} onClick={commitImport}>
                {importBusy ? "Importing…" : `Commit ${preview.readyRows} ready rows`}
              </button>
            )}
            {preview?.errorCsv && <button type="button" className="link-button" onClick={downloadImportErrors}>Download rejected rows</button>}
          </div>
        </form>
        {preview && (
          <div className="import-preview">
            <p>{preview.totalRows} rows · {preview.readyRows ?? preview.createdRows + preview.linkedRows} ready · {preview.skippedRows} skipped · {preview.rejectedRows} rejected</p>
            <DataTable
              empty="No rows in this import"
              rows={preview.rows || []}
              getKey={(row) => row.rowNumber}
              columns={[
                { key: "row", label: "Row", render: (row) => row.rowNumber },
                { key: "roll", label: "Roll number", render: (row) => row.rollNumber || "—" },
                { key: "email", label: "Email", render: (row) => row.email || "—" },
                { key: "status", label: "Status", render: (row) => <Badge tone={row.status === "REJECTED" ? "danger" : row.status === "READY" ? "info" : "positive"}>{row.status}</Badge> },
                { key: "message", label: "Details", render: (row) => row.message || "—" },
              ]}
            />
          </div>
        )}
      </Panel>}
      <Panel title={loading ? "Students" : `${filtered.length} students`} actions={<input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search students" />}>
        {loading ? <LoadingBlock /> : error ? <ErrorBlock message={error} onRetry={reload} /> : <StudentsTable students={filtered} onView={openStudent} />}
      </Panel>
      <StudentDetailDrawer student={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

export function CollegeReportsPage() {
  const { data, loading, error, reload } = useApi("/college/dashboard");
  const [busy, setBusy] = useState("");
  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;

  async function download(path, filename, action) {
    setBusy(action);
    try {
      const blob = await api.get(path, { responseType: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Report downloaded.");
    } catch (reason) {
      toast.error(reason.message || "Unable to download this report.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="workspace-page-content">
      <PageHeader
        eyebrow="REPORTS"
        title="College readiness report"
        description="Live, institution-scoped cohort analytics and downloadable reports."
        actions={(
          <>
            <button type="button" className="secondary-button" disabled={Boolean(busy)} onClick={() => download("/college/reports/export.csv?type=department-skill-gaps", "careeros-department-skill-gaps.csv", "csv")}>
              {busy === "csv" ? "Preparing…" : "Export skill gaps CSV"}
            </button>
            <button type="button" className="primary-button" disabled={Boolean(busy)} onClick={() => download("/college/reports/cohort.pdf", "careeros-cohort-report.pdf", "pdf")}>
              {busy === "pdf" ? "Preparing…" : "Download cohort PDF"}
            </button>
          </>
        )}
      />
      <div className="stat-grid stat-grid-4">
        <StatCard label="Enrolled" value={data?.totalEnrolled ?? 0} icon="users" />
        <StatCard label="Active" value={data?.activeStudents ?? 0} icon="activity" />
        <StatCard label="Assessment participants" value={data?.assessmentParticipants ?? 0} icon="clipboard" />
        <StatCard label="Readiness evaluated" value={data?.readinessEvaluated ?? 0} icon="target" />
      </div>
      <div className="two-column">
        <Panel title="Readiness distribution">
          <DataTable
            empty="No readiness scores are available"
            rows={data?.readinessDistribution || []}
            getKey={(item) => item.band}
            columns={[
              { key: "band", label: "Band" },
              { key: "students", label: "Students" },
            ]}
          />
        </Panel>
        <Panel title="Report definitions" description="Metrics are calculated from current institution-scoped enrollment and assessment data.">
          <DataTable
            empty="No metric definitions are available"
            rows={data?.definitions || []}
            getKey={(item) => item.metric}
            columns={[
              { key: "metric", label: "Metric" },
              { key: "definition", label: "Definition" },
            ]}
          />
        </Panel>
      </div>
      <Panel title="Common skill gaps" description="Most common skills below target among assessed students.">
        <DataTable
          empty="No assessed skill gaps are available"
          rows={data?.commonGaps || []}
          getKey={(gap) => gap.skillId}
          columns={[
            { key: "skillName", label: "Skill" },
            { key: "studentsBelowTarget", label: "Below target" },
            { key: "assessedStudents", label: "Assessed" },
            { key: "percentBelowTarget", label: "Below target %" },
          ]}
        />
      </Panel>
    </div>
  );
}

export function CollegeSettingsPage() {
  return <SettingsPage label="College Admin" />;
}
