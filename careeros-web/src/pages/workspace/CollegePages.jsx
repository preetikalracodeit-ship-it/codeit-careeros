import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../../lib/api.js";
import { useApi } from "../../lib/useApi.js";
import { ROLE_LABELS } from "../../lib/roles.js";
import { Icon } from "../../components/Icon.jsx";
import { Badge, DataTable, Distribution, ErrorBlock, LoadingBlock, PageHeader, Panel, StatCard, statusTone } from "../../components/ui.jsx";
import { downloadCsv, ReadinessPanel, ReadinessSummary, SettingsPage, SkillGapTable, StudentDetailDrawer, StudentsTable, formatDate, scoreTone } from "./shared.jsx";

const STAFF_ROLE_OPTIONS = ["COLLEGE_ADMIN", "TPO", "HOD", "FACULTY"];

export function CollegeDashboardPage() {
  const { data, loading, error, reload } = useApi("/workspace/summary");
  if (loading) return <LoadingBlock label="Loading college workspace…" />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  const stats = data?.stats || {};
  const staff = data?.staff || [];

  return (
    <div className="workspace-page-content">
      <PageHeader
        eyebrow="COLLEGE ADMIN"
        title={data?.college?.name || "College workspace"}
        description={`Manage departments, batches, staff permissions, and student visibility for ${data?.college?.code || "your college"}.`}
        actions={<Link className="primary-button" to="/college/staff">Add staff</Link>}
      />

      <div className="stat-grid stat-grid-4">
        <StatCard label="Students" value={stats.students ?? 0} hint="Profiles in your college" icon="users" />
        <StatCard label="Staff" value={stats.staff ?? 0} hint="Administrators and faculty" icon="shield" />
        <StatCard label="Departments" value={stats.departments ?? 0} icon="layers" />
        <StatCard label="Batches" value={stats.batches ?? 0} icon="calendar" />
      </div>

      <div className="stat-grid stat-grid-3">
        <StatCard label="Average readiness" value={`${stats.averageReadiness ?? 0}%`} hint="Latest submitted assessments" tone={scoreTone(stats.averageReadiness)} icon="target" />
        <StatCard label="Assessed students" value={stats.assessedStudents ?? 0} hint="Students with a completed assessment" icon="clipboard" />
        <StatCard label="College status" value={data?.college?.status || "—"} hint={data?.college?.city || "Location not set"} tone={statusTone(data?.college?.status)} icon="building" />
      </div>

      <div className="two-column">
        <Panel title="Readiness distribution" description="How students are performing against their target careers.">
          <Distribution distribution={data?.readiness?.distribution} />
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

      <Panel title="Recent staff" description="Administrators and faculty assigned to your college." actions={<Link className="link-button" to="/college/staff">View all</Link>}>
        <DataTable
          empty="No staff assigned yet"
          rows={staff}
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
      <PageHeader eyebrow="STUDENTS" title="College students" description="View student profiles and career targets across your college." />
      <Panel title={loading ? "Students" : `${filtered.length} students`} actions={<input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search students" />}>
        {loading ? <LoadingBlock /> : error ? <ErrorBlock message={error} onRetry={reload} /> : <StudentsTable students={filtered} onView={openStudent} />}
      </Panel>
      <StudentDetailDrawer student={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

export function CollegeReportsPage() {
  const { data: readiness, loading, error, reload } = useApi("/workspace/readiness");
  const { data: gaps } = useApi("/workspace/skill-gaps");

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;

  return (
    <div className="workspace-page-content">
      <PageHeader
        eyebrow="REPORTS"
        title="College readiness report"
        description="Aggregated readiness and skill-gap reporting for your college."
        actions={(
          <button type="button" className="secondary-button" onClick={() => downloadCsv("college-skill-gaps.csv", [
            { label: "Skill", value: (gap) => gap.skillName },
            { label: "Category", value: (gap) => gap.skillCategory },
            { label: "Average", value: (gap) => gap.averageScore },
            { label: "Target", value: (gap) => gap.targetPercent },
            { label: "Gap", value: (gap) => gap.gapPercent },
          ], gaps || [])}>Export gaps CSV</button>
        )}
      />
      <ReadinessSummary readiness={readiness} />
      <div className="two-column">
        <ReadinessPanel readiness={readiness} />
        <Panel title="Report summary" description="How to read this report.">
          <ul className="report-notes">
            <li>Readiness compares each student’s latest submitted assessment with their target career framework.</li>
            <li>Skill gaps are ranked by the difference between target and average score.</li>
            <li>Use the student directory to open individual profiles and career targets.</li>
          </ul>
        </Panel>
      </div>
      <Panel title="Skill gaps" description="Skills with the largest distance to target.">
        <SkillGapTable gaps={gaps} />
      </Panel>
    </div>
  );
}

export function CollegeSettingsPage() {
  return <SettingsPage label="College Admin" />;
}
