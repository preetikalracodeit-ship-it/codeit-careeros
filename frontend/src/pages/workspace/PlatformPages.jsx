import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../../lib/api.js";
import { useApi } from "../../lib/useApi.js";
import { ROLE_LABELS } from "../../lib/roles.js";
import { Icon } from "../../components/Icon.jsx";
import { Badge, DataTable, EmptyState, ErrorBlock, LoadingBlock, PageHeader, Panel, StatCard, statusTone } from "../../components/ui.jsx";
import { StudentDetailDrawer, StudentsTable, SettingsPage, formatDate } from "./shared.jsx";

const STAFF_ROLE_OPTIONS = ["COLLEGE_ADMIN", "TPO", "HOD", "FACULTY"];

export function PlatformDashboardPage() {
  const { data, loading, error, reload } = useApi("/workspace/summary");
  const { data: meta } = useApi("/meta/version");

  if (loading) return <LoadingBlock label="Loading platform overview…" />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  const stats = data?.stats || {};
  const colleges = data?.recentColleges || [];

  return (
    <div className="workspace-page-content">
      <PageHeader
        eyebrow="PLATFORM CONTROL"
        title="Platform operations at a glance"
        description="Create and govern college workspaces, monitor administrators, and keep an eye on platform-wide operations."
        actions={<Link className="primary-button" to="/platform/colleges">New college workspace</Link>}
      />

      <div className="stat-grid stat-grid-4">
        <StatCard label="College workspaces" value={stats.colleges ?? 0} hint="Across the platform" icon="building" />
        <StatCard label="Active colleges" value={stats.activeColleges ?? 0} hint="Live and serving students" tone="positive" icon="check" />
        <StatCard label="Onboarding" value={stats.onboardingColleges ?? 0} hint="Awaiting activation" tone="warning" icon="activity" />
        <StatCard label="Students" value={stats.students ?? 0} hint="Registered student profiles" icon="users" />
      </div>

      <div className="stat-grid stat-grid-4">
        <StatCard label="College admins" value={stats.collegeAdmins ?? 0} icon="shield" />
        <StatCard label="TPOs" value={stats.tpos ?? 0} icon="briefcase" />
        <StatCard label="HODs" value={stats.hods ?? 0} icon="layers" />
        <StatCard label="Faculty" value={stats.faculty ?? 0} icon="book" />
      </div>

      <div className="two-column">
        <Panel
          title="Recent college workspaces"
          description="The newest workspaces added to the platform."
          actions={<Link className="link-button" to="/platform/colleges">View all</Link>}
        >
          {colleges.length ? (
            <div className="stack-list">
              {colleges.map((college) => (
                <Link className="stack-row" key={college.id} to={`/platform/colleges/${college.id}`}>
                  <span className="stack-avatar"><Icon name="building" size={18} /></span>
                  <div>
                    <strong>{college.name}</strong>
                    <span>{college.city ? `${college.city}, ${college.state || ""}` : college.code}</span>
                  </div>
                  <Badge tone={statusTone(college.status)}>{college.status}</Badge>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title="No college workspaces yet" description="Create the first college workspace to bring a campus onboard." icon="building" />
          )}
        </Panel>

        <Panel title="Operational information" description="Platform-level service and access signals.">
          <dl className="settings-list">
            <div><dt>API service</dt><dd>{meta?.service || "careeros-api"}</dd></div>
            <div><dt>Version</dt><dd>{meta?.version || "0.1.0"}</dd></div>
            <div><dt>Authentication</dt><dd><Badge tone="positive">Operational</Badge></dd></div>
            <div><dt>Role model</dt><dd><Badge tone="info">6 roles enabled</Badge></dd></div>
            <div><dt>Audit monitoring</dt><dd><Badge tone="positive">Append-only</Badge></dd></div>
          </dl>
        </Panel>
      </div>
    </div>
  );
}

export function PlatformCollegesPage() {
  const { data, loading, error, reload } = useApi("/workspace/colleges");
  const [form, setForm] = useState({ name: "", code: "", city: "", state: "", contactEmail: "", status: "ONBOARDING" });
  const [busy, setBusy] = useState(false);

  async function createCollege(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post("/workspace/colleges", form);
      toast.success("College workspace created.");
      setForm({ name: "", code: "", city: "", state: "", contactEmail: "", status: "ONBOARDING" });
      reload();
    } catch (reason) {
      toast.error(reason.message || "Unable to create the college workspace.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workspace-page-content">
      <PageHeader
        eyebrow="COLLEGE WORKSPACES"
        title="Manage college workspaces"
        description="Create and monitor every college tenant on the platform, including their departments, staff, and students."
      />

      <div className="split-layout">
        <Panel title={loading ? "College workspaces" : `${data?.length ?? 0} college workspaces`}>
          {loading ? (
            <LoadingBlock />
          ) : error ? (
            <ErrorBlock message={error} onRetry={reload} />
          ) : (
            <DataTable
              empty="No college workspaces yet"
              rows={data || []}
              getKey={(college) => college.id}
              columns={[
                {
                  key: "name",
                  label: "College",
                  render: (college) => (
                    <div className="table-person">
                      <span className="stack-avatar"><Icon name="building" size={16} /></span>
                      <div>
                        <strong>{college.name}</strong>
                        <span>{college.code}</span>
                      </div>
                    </div>
                  ),
                },
                { key: "location", label: "Location", render: (college) => college.city ? `${college.city}${college.state ? `, ${college.state}` : ""}` : "—" },
                { key: "departments", label: "Depts", render: (college) => college.departmentCount },
                { key: "students", label: "Students", render: (college) => college.studentCount ?? 0 },
                { key: "staff", label: "Staff", render: (college) => college.staffCount ?? 0 },
                { key: "status", label: "Status", render: (college) => <Badge tone={statusTone(college.status)}>{college.status}</Badge> },
                { key: "action", label: "", render: (college) => <Link className="link-button" to={`/platform/colleges/${college.id}`}>Open</Link> },
              ]}
            />
          )}
        </Panel>

        <Panel title="Create college workspace" description="Start a new tenant and assign its founding college admin next.">
          <form className="stack-form" onSubmit={createCollege}>
            <label className="form-field">College name
              <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Northfield Institute of Technology" />
            </label>
            <label className="form-field">College code
              <input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="NIT" />
            </label>
            <div className="form-row">
              <label className="form-field">City
                <input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} placeholder="Bengaluru" />
              </label>
              <label className="form-field">State
                <input value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} placeholder="Karnataka" />
              </label>
            </div>
            <label className="form-field">Contact email
              <input type="email" value={form.contactEmail} onChange={(event) => setForm({ ...form, contactEmail: event.target.value })} placeholder="admin@college.edu" />
            </label>
            <label className="form-field">Initial status
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                <option value="ONBOARDING">Onboarding</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </label>
            <button className="primary-button" disabled={busy}>{busy ? "Creating…" : "Create workspace"}</button>
          </form>
        </Panel>
      </div>
    </div>
  );
}

export function PlatformCollegeDetailPage() {
  const { id } = useParams();
  const { data, loading, error, reload } = useApi(`/workspace/colleges/${id}`);
  const [department, setDepartment] = useState({ name: "", code: "", hodName: "" });
  const [batch, setBatch] = useState({ name: "", departmentId: "", year: new Date().getFullYear() });
  const [busy, setBusy] = useState(false);

  async function addDepartment(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post(`/workspace/colleges/${id}/departments`, department);
      toast.success("Department added.");
      setDepartment({ name: "", code: "", hodName: "" });
      reload();
    } catch (reason) {
      toast.error(reason.message || "Unable to add the department.");
    } finally {
      setBusy(false);
    }
  }

  async function addBatch(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post(`/workspace/colleges/${id}/batches`, batch);
      toast.success("Batch added.");
      setBatch({ name: "", departmentId: "", year: new Date().getFullYear() });
      reload();
    } catch (reason) {
      toast.error(reason.message || "Unable to add the batch.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingBlock label="Loading college workspace…" />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;

  return (
    <div className="workspace-page-content">
      <PageHeader
        eyebrow={`WORKSPACE · ${data.code}`}
        title={data.name}
        description={`${data.city ? `${data.city}${data.state ? `, ${data.state}` : ""} · ` : ""}${data.contactEmail || "No contact email"}`}
        actions={<Badge tone={statusTone(data.status)}>{data.status}</Badge>}
      />

      <div className="stat-grid stat-grid-4">
        <StatCard label="Departments" value={data.departmentCount} icon="layers" />
        <StatCard label="Batches" value={data.batchCount} icon="calendar" />
        <StatCard label="Staff" value={data.staffCount} icon="shield" />
        <StatCard label="Students" value={data.studentCount} icon="users" />
      </div>

      <div className="two-column">
        <Panel title="Departments" description="Academic units inside this college.">
          <DataTable
            empty="No departments yet"
            rows={data.departments || []}
            getKey={(item) => item.id}
            columns={[
              { key: "name", label: "Department", render: (item) => <strong>{item.name}</strong> },
              { key: "code", label: "Code", render: (item) => <Badge tone="muted">{item.code}</Badge> },
              { key: "hod", label: "HOD", render: (item) => item.hodName || "—" },
            ]}
          />
          <form className="stack-form compact-form" onSubmit={addDepartment}>
            <div className="form-row">
              <label className="form-field">Department name
                <input required value={department.name} onChange={(event) => setDepartment({ ...department, name: event.target.value })} placeholder="Computer Science" />
              </label>
              <label className="form-field">Code
                <input required value={department.code} onChange={(event) => setDepartment({ ...department, code: event.target.value })} placeholder="CSE" />
              </label>
            </div>
            <label className="form-field">HOD name
              <input value={department.hodName} onChange={(event) => setDepartment({ ...department, hodName: event.target.value })} placeholder="Dr. Anjali Rao" />
            </label>
            <button className="secondary-button" disabled={busy}>Add department</button>
          </form>
        </Panel>

        <Panel title="Batches" description="Cohorts grouped by department.">
          <DataTable
            empty="No batches yet"
            rows={data.batches || []}
            getKey={(item) => item.id}
            columns={[
              { key: "name", label: "Batch", render: (item) => <strong>{item.name}</strong> },
              { key: "department", label: "Department", render: (item) => data.departments?.find((dept) => dept.id === item.departmentId)?.code || item.departmentId },
              { key: "year", label: "Start year", render: (item) => item.year },
            ]}
          />
          <form className="stack-form compact-form" onSubmit={addBatch}>
            <label className="form-field">Batch name
              <input required value={batch.name} onChange={(event) => setBatch({ ...batch, name: event.target.value })} placeholder="CSE 2024-2028" />
            </label>
            <div className="form-row">
              <label className="form-field">Department
                <select required value={batch.departmentId} onChange={(event) => setBatch({ ...batch, departmentId: event.target.value })}>
                  <option value="">Select department</option>
                  {(data.departments || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label className="form-field">Start year
                <input type="number" required value={batch.year} onChange={(event) => setBatch({ ...batch, year: event.target.value })} />
              </label>
            </div>
            <button className="secondary-button" disabled={busy}>Add batch</button>
          </form>
        </Panel>
      </div>

      <Panel title="Assigned staff" description="Administrators and coordinators working in this workspace." actions={<Link className="link-button" to="/platform/staff">Manage administrators</Link>}>
        <DataTable
          empty="No staff assigned yet"
          rows={data.staff || []}
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

export function PlatformStaffPage() {
  const { data: staff, loading, error, reload } = useApi("/workspace/staff");
  const { data: colleges } = useApi("/workspace/colleges");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [form, setForm] = useState({ fullName: "", email: "", password: "DemoPass123", role: "COLLEGE_ADMIN", collegeId: "", departmentId: "" });
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(
    () => (staff || []).filter((member) => roleFilter === "ALL" || member.role === roleFilter),
    [staff, roleFilter],
  );
  const selectedCollege = (colleges || []).find((college) => String(college.id) === String(form.collegeId));

  async function createStaff(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post("/workspace/staff", {
        ...form,
        collegeId: form.collegeId ? Number(form.collegeId) : undefined,
        departmentId: form.departmentId ? Number(form.departmentId) : undefined,
      });
      toast.success("Staff account created.");
      setForm({ fullName: "", email: "", password: "DemoPass123", role: "COLLEGE_ADMIN", collegeId: "", departmentId: "" });
      reload();
    } catch (reason) {
      toast.error(reason.message || "Unable to create the staff account.");
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
      <PageHeader
        eyebrow="AUTHORIZED ADMINISTRATORS"
        title="Manage platform and college administrators"
        description="Review every authorized staff login, confirm college assignments, and provision new administrators."
      />

      <div className="split-layout">
        <Panel
          title={loading ? "Administrators" : `${filtered.length} administrators`}
          actions={
            <select className="inline-select" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
              <option value="ALL">All roles</option>
              {STAFF_ROLE_OPTIONS.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
            </select>
          }
        >
          {loading ? <LoadingBlock /> : error ? <ErrorBlock message={error} onRetry={reload} /> : (
            <DataTable
              empty="No administrators match this filter"
              rows={filtered}
              getKey={(member) => member.id}
              columns={[
                {
                  key: "name",
                  label: "Administrator",
                  render: (member) => (
                    <div className="table-person">
                      <span className="stack-avatar"><Icon name="shield" size={16} /></span>
                      <div><strong>{member.fullName}</strong><span>{member.email}</span></div>
                    </div>
                  ),
                },
                { key: "role", label: "Role", render: (member) => <Badge tone="info">{ROLE_LABELS[member.role] || member.role}</Badge> },
                { key: "college", label: "College", render: (member) => member.collegeName || "Platform" },
                { key: "status", label: "Status", render: (member) => <Badge tone={statusTone(member.status)}>{member.status}</Badge> },
                {
                  key: "action",
                  label: "",
                  render: (member) => (
                    <button type="button" className="link-button" onClick={() => toggleStatus(member)}>
                      {member.status === "ACTIVE" ? "Suspend" : "Restore"}
                    </button>
                  ),
                },
              ]}
            />
          )}
        </Panel>

        <Panel title="Provision staff login" description="Create an authorized college administrator or coordinator.">
          <form className="stack-form" onSubmit={createStaff}>
            <label className="form-field">Full name
              <input required value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder="Priya Nair" />
            </label>
            <label className="form-field">Work email
              <input type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="priya@college.edu" />
            </label>
            <div className="form-row">
              <label className="form-field">Role
                <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
                  {STAFF_ROLE_OPTIONS.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
                </select>
              </label>
              <label className="form-field">College
                <select required value={form.collegeId} onChange={(event) => setForm({ ...form, collegeId: event.target.value, departmentId: "" })}>
                  <option value="">Select college</option>
                  {(colleges || []).map((college) => <option key={college.id} value={college.id}>{college.name}</option>)}
                </select>
              </label>
            </div>
            <label className="form-field">Department (optional)
              <select value={form.departmentId} onChange={(event) => setForm({ ...form, departmentId: event.target.value })} disabled={!selectedCollege}>
                <option value="">No department</option>
                {(selectedCollege?.departments || []).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
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

export function PlatformStudentsPage() {
  const { data, loading, error, reload } = useApi("/workspace/students");
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState(null);
  const [detailBusy, setDetailBusy] = useState(false);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (data || []).filter((student) => !term || `${student.fullName} ${student.studentId} ${student.branch || ""}`.toLowerCase().includes(term));
  }, [data, query]);

  async function openStudent(student) {
    setDetailBusy(true);
    try {
      setDetail(await api.get(`/workspace/students/${student.id}`));
    } catch (reason) {
      toast.error(reason.message || "Unable to load the student profile.");
    } finally {
      setDetailBusy(false);
    }
  }

  return (
    <div className="workspace-page-content">
      <PageHeader eyebrow="STUDENT DIRECTORY" title="Students across the platform" description="Monitor student profiles and their selected career targets." />
      <Panel title={loading ? "Students" : `${filtered.length} students`} actions={<input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search students" />}>
        {loading ? <LoadingBlock /> : error ? <ErrorBlock message={error} onRetry={reload} /> : (
          <StudentsTable students={filtered} onView={detailBusy ? undefined : openStudent} />
        )}
      </Panel>
      <StudentDetailDrawer student={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

export function PlatformActivityPage() {
  const { data, loading, error, reload } = useApi("/workspace/summary");
  const { data: meta } = useApi("/meta/version");
  if (loading) return <LoadingBlock />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  const stats = data?.stats || {};
  const colleges = data?.recentColleges || [];
  const activeShare = stats.colleges ? Math.round(((stats.activeColleges || 0) / stats.colleges) * 100) : 0;

  return (
    <div className="workspace-page-content">
      <PageHeader eyebrow="OPERATIONAL MONITORING" title="Platform operational information" description="Health, adoption, and workspace signals for platform operators." />

      <div className="stat-grid stat-grid-4">
        <StatCard label="Workspace activation" value={`${activeShare}%`} hint={`${stats.activeColleges || 0} of ${stats.colleges || 0} colleges active`} tone="positive" icon="activity" />
        <StatCard label="Staff accounts" value={(stats.collegeAdmins || 0) + (stats.tpos || 0) + (stats.hods || 0) + (stats.faculty || 0)} hint="Across all college roles" icon="shield" />
        <StatCard label="Students" value={stats.students ?? 0} hint="Registered profiles" icon="users" />
        <StatCard label="Onboarding" value={stats.onboardingColleges ?? 0} hint="Workspaces not yet activated" tone="warning" icon="building" />
      </div>

      <div className="two-column">
        <Panel title="Role distribution" description="Authorized staff by responsibility.">
          <div className="role-bars">
            {[
              ["College admins", stats.collegeAdmins || 0],
              ["TPOs", stats.tpos || 0],
              ["HODs", stats.hods || 0],
              ["Faculty", stats.faculty || 0],
            ].map(([label, count]) => {
              const max = Math.max(stats.collegeAdmins || 0, stats.tpos || 0, stats.hods || 0, stats.faculty || 0, 1);
              return (
                <div className="role-bar" key={label}>
                  <div><span>{label}</span><strong>{count}</strong></div>
                  <div className="meter"><span style={{ width: `${(count / max) * 100}%` }} /></div>
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel title="Service information" description="Signals available to platform operators.">
          <dl className="settings-list">
            <div><dt>Service</dt><dd>{meta?.service || "careeros-api"}</dd></div>
            <div><dt>Build version</dt><dd>{meta?.version || "0.1.0"}</dd></div>
            <div><dt>Role model</dt><dd>6 roles</dd></div>
            <div><dt>Audit trail</dt><dd><Badge tone="positive">Append-only admin audit</Badge></dd></div>
            <div><dt>Session security</dt><dd><Badge tone="positive">Refresh rotation enabled</Badge></dd></div>
          </dl>
        </Panel>
      </div>

      <Panel title="Newest workspaces" description="Most recent college tenants created on the platform.">
        <DataTable
          empty="No college workspaces yet"
          rows={colleges}
          getKey={(college) => college.id}
          columns={[
            { key: "name", label: "College", render: (college) => <strong>{college.name}</strong> },
            { key: "code", label: "Code", render: (college) => <Badge tone="muted">{college.code}</Badge> },
            { key: "created", label: "Created", render: (college) => formatDate(college.createdAt) },
            { key: "status", label: "Status", render: (college) => <Badge tone={statusTone(college.status)}>{college.status}</Badge> },
            { key: "action", label: "", render: (college) => <Link className="link-button" to={`/platform/colleges/${college.id}`}>Open</Link> },
          ]}
        />
      </Panel>
    </div>
  );
}

export function PlatformSettingsPage() {
  return <SettingsPage label="Platform Super Admin" />;
}
