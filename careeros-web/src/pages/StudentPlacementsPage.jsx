import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../lib/api.js";
import { Badge, EmptyState, ErrorBlock, LoadingBlock, PageHeader, Panel, StatCard } from "../components/ui.jsx";
import { Icon } from "../components/Icon.jsx";

function formatDate(value) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not set" : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function pretty(value) {
  if (!value) return "Not set";
  return String(value).toLowerCase().split("_").map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join(" ");
}

function stageTone(stage) {
  if (stage === "JOINED") return "positive";
  if (stage === "REJECTED" || stage === "WITHDRAWN") return "danger";
  if (stage === "OFFERED") return "info";
  return "muted";
}

function money(value, currency) {
  if (value == null) return "Not disclosed";
  return `${currency || ""} ${Number(value).toLocaleString()}`.trim();
}

export function StudentPlacementsPage() {
  const [drives, setDrives] = useState(null);
  const [applications, setApplications] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [driveData, applicationData] = await Promise.all([
        api.get("/students/me/placement/drives"),
        api.get("/students/me/placement/applications"),
      ]);
      setDrives(driveData);
      setApplications(applicationData);
    } catch (reason) {
      setError(reason.message || "Unable to load placements.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function register(drive) {
    setBusy(`drive-${drive.id}`);
    try {
      await api.post(`/students/me/placement/drives/${drive.id}/register`);
      toast.success("You are registered for this drive.");
      await load();
    } catch (reason) {
      toast.error(reason.message || "Unable to register for this drive.");
    } finally {
      setBusy("");
    }
  }

  async function withdraw(application) {
    setBusy(`application-${application.id}`);
    try {
      await api.patch(`/students/me/placement/applications/${application.id}/withdraw`);
      toast.success("Application withdrawn.");
      await load();
    } catch (reason) {
      toast.error(reason.message || "Unable to withdraw this application.");
    } finally {
      setBusy("");
    }
  }

  async function respond(application, status) {
    setBusy(`offer-${application.offer.id}`);
    try {
      await api.patch(`/students/me/placement/offers/${application.offer.id}/respond?status=${status}`);
      toast.success(status === "ACCEPTED" ? "Offer accepted." : "Offer declined.");
      await load();
    } catch (reason) {
      toast.error(reason.message || "Unable to update the offer.");
    } finally {
      setBusy("");
    }
  }

  if (loading && !drives) return <main className="workspace-page"><LoadingBlock label="Loading placements..." /></main>;
  if (error && !drives) return <main className="workspace-page"><ErrorBlock message={error} onRetry={load} /></main>;

  const driveItems = drives?.items || [];
  const applicationItems = applications?.items || [];
  const openDrives = driveItems.filter((item) => item.drive.status === "REGISTRATION_OPEN").length;
  const offers = applicationItems.filter((item) => item.offer && item.offer.status === "PENDING").length;

  return <main className="workspace-page placements-page">
    <PageHeader eyebrow="CAREER OPPORTUNITIES" title="Placements" description="Open drives from your college and every application or offer recorded for you." actions={<button className="secondary-button" onClick={load} disabled={loading}><Icon name="activity" size={14} /> {loading ? "Refreshing..." : "Refresh"}</button>} />
    {error && <div className="success-banner roadmap-error" role="alert">{error}</div>}

    <div className="stat-grid stat-grid-3">
      <StatCard label="Visible drives" value={driveItems.length} hint={`${openDrives} open for registration`} icon="briefcase" />
      <StatCard label="My applications" value={applicationItems.length} hint="Across all drives" icon="clipboard" />
      <StatCard label="Pending offers" value={offers} hint="Waiting for your response" tone={offers > 0 ? "warning" : "default"} icon="target" />
    </div>

    <Panel title="Placement drives" description="Registration is available only while a drive window is open and you meet its eligibility rules.">
      {driveItems.length === 0 ? <EmptyState icon="briefcase" title="No drives available" description="Your college has not opened any placement drives for your batch yet." /> : <div className="placement-drive-grid">{driveItems.map((item) => {
        const drive = item.drive;
        const canRegister = item.eligible && !item.alreadyApplied && drive.status === "REGISTRATION_OPEN";
        return <article key={drive.id} className="placement-drive">
          <div className="placement-drive-top"><div><strong>{drive.name}</strong><span>{drive.companyName} - {drive.jobTitle}</span></div><Badge tone={drive.status === "REGISTRATION_OPEN" ? "positive" : "muted"}>{pretty(drive.status)}</Badge></div>
          <dl className="placement-meta">
            <div><dt>Location</dt><dd>{drive.location || "Not set"}</dd></div>
            <div><dt>Registration closes</dt><dd>{formatDate(drive.registrationEnd)}</dd></div>
            <div><dt>Drive date</dt><dd>{formatDate(drive.driveDate)}</dd></div>
            <div><dt>Readiness needed</dt><dd>{drive.minimumReadinessPercent != null ? `${drive.minimumReadinessPercent}%` : "Not set"}</dd></div>
          </dl>
          {drive.eligibilityCriteria && <p className="placement-note">{drive.eligibilityCriteria}</p>}
          <div className="button-row">
            {item.alreadyApplied ? <Badge tone="positive">Registered</Badge> : item.eligible ? <Badge tone="info">Eligible</Badge> : <Badge tone="danger">Not eligible</Badge>}
            {canRegister && <button className="primary-button" disabled={busy === `drive-${drive.id}`} onClick={() => register(drive)}>{busy === `drive-${drive.id}` ? "Registering..." : "Register"}</button>}
          </div>
          {!item.eligible && item.eligibilityReason && <p className="placement-note placement-note-warn">{item.eligibilityReason}</p>}
        </article>;
      })}</div>}
    </Panel>

    <Panel title="My applications" description="Stage history and offers are recorded by your placement team.">
      {applicationItems.length === 0 ? <EmptyState icon="briefcase" title="No applications yet" description="Register for an open drive to start an application." /> : <div className="placement-applications">{applicationItems.map((application) => <article key={application.id} className="placement-application">
        <div className="placement-drive-top"><div><strong>{application.companyName}</strong><span>{application.driveName} - {application.jobTitle}</span></div><Badge tone={stageTone(application.stage)}>{pretty(application.stage)}</Badge></div>
        <p className="placement-note">Applied {formatDate(application.appliedAt)}{application.eligibilityOverride ? " - registered with an eligibility override" : ""}</p>

        {application.offer && <div className="placement-offer">
          <div><strong>Offer {money(application.offer.packageAmount, application.offer.currency)}</strong><span>Status: {pretty(application.offer.status)}{application.offer.offerDate ? ` - offered ${formatDate(application.offer.offerDate)}` : ""}</span></div>
          {application.offer.status !== "JOINED" && application.offer.status !== "WITHDRAWN" && <div className="button-row">
            <button className="primary-button" disabled={busy === `offer-${application.offer.id}`} onClick={() => respond(application, "ACCEPTED")}><Icon name="check" size={14} /> Accept</button>
            <button className="secondary-button" disabled={busy === `offer-${application.offer.id}`} onClick={() => respond(application, "DECLINED")}>Decline</button>
          </div>}
        </div>}

        {application.stage !== "JOINED" && application.stage !== "WITHDRAWN" && <div className="button-row"><button className="secondary-button" disabled={busy === `application-${application.id}`} onClick={() => withdraw(application)}>{busy === `application-${application.id}` ? "Withdrawing..." : "Withdraw application"}</button></div>}

        {application.history?.length > 0 && <details className="placement-history"><summary>Stage history</summary><ul>{application.history.map((event) => <li key={event.id}><strong>{pretty(event.stage)}</strong>{event.note ? ` - ${event.note}` : ""} <span>{formatDate(event.recordedAt)}</span></li>)}</ul></details>}
      </article>)}</div>}
    </Panel>
  </main>;
}
