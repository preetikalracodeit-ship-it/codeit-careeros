"use client";

import { useCallback, useEffect, useState } from "react";
import { Briefcase, CalendarDays, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumb } from "@/components/breadcrumb";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import api from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/format";

function label(value) {
  if (!value) return "Not set";
  return String(value)
    .toLowerCase()
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

function stageTone(stage) {
  if (stage === "JOINED") return "bg-chart-3/15 text-chart-3";
  if (stage === "REJECTED" || stage === "WITHDRAWN") return "bg-destructive/10 text-destructive";
  if (stage === "OFFERED") return "bg-primary/10 text-primary";
  return "bg-muted text-muted-foreground";
}

export default function StudentPlacementsPage() {
  const [drives, setDrives] = useState(null);
  const [applications, setApplications] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);

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
    } catch (err) {
      setError(err.message || "Could not load placement opportunities.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async placement loader; state updates happen in promise callbacks
    load();
  }, [load]);

  async function register(drive) {
    setBusy(`drive-${drive.id}`);
    try {
      await api.post(`/students/me/placement/drives/${drive.id}/register`);
      toast.success("You are registered for this drive.");
      await load();
    } catch (err) {
      toast.error(err.message || "Could not register for this drive.");
    } finally {
      setBusy(null);
    }
  }

  async function withdraw(application) {
    setBusy(`application-${application.id}`);
    try {
      await api.patch(`/students/me/placement/applications/${application.id}/withdraw`);
      toast.success("Application withdrawn.");
      await load();
    } catch (err) {
      toast.error(err.message || "Could not withdraw this application.");
    } finally {
      setBusy(null);
    }
  }

  async function respond(application, status) {
    setBusy(`offer-${application.offer.id}`);
    try {
      await api.patch(`/students/me/placement/offers/${application.offer.id}/respond?status=${status}`);
      toast.success(status === "ACCEPTED" ? "Offer accepted." : "Offer declined.");
      await load();
    } catch (err) {
      toast.error(err.message || "Could not update the offer.");
    } finally {
      setBusy(null);
    }
  }

  if (loading && !drives) return <LoadingState label="Loading placement opportunities..." />;
  if (error && !drives) return <ErrorState title="Couldn't load placements" description={error} onRetry={load} />;

  const driveItems = drives?.items || [];
  const applicationItems = applications?.items || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Placements"
        description="Open drives from your college and every application or offer recorded for you."
        breadcrumb={<Breadcrumb items={[{ label: "Placements" }]} />}
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={loading ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="size-4" aria-hidden="true" />
            Placement drives
          </CardTitle>
          <CardDescription>Registration is available only while a drive window is open and you meet its eligibility rules.</CardDescription>
        </CardHeader>
        <CardContent>
          {driveItems.length === 0 ? (
            <EmptyState
              compact
              icon={Briefcase}
              title="No drives available"
              description="Your college has not opened any placement drives for your batch yet."
            />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {driveItems.map((item) => {
                const drive = item.drive;
                const canRegister = item.eligible && !item.alreadyApplied && drive.status === "REGISTRATION_OPEN";
                return (
                  <div key={drive.id} className="rounded-xl border border-border/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold">{drive.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {drive.companyName} · {drive.jobTitle}
                        </p>
                      </div>
                      <Badge variant={drive.status === "REGISTRATION_OPEN" ? "default" : "secondary"}>
                        {label(drive.status)}
                      </Badge>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt className="text-muted-foreground">Registration closes</dt>
                        <dd className="font-medium">{drive.registrationEnd ? formatDate(drive.registrationEnd) : "No deadline"}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Drive date</dt>
                        <dd className="font-medium">{drive.driveDate ? formatDate(drive.driveDate) : "Not set"}</dd>
                      </div>
                    </dl>
                    {drive.eligibilityCriteria && (
                      <p className="mt-2 text-xs text-muted-foreground">{drive.eligibilityCriteria}</p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {item.alreadyApplied ? (
                        <Badge variant="secondary">
                          <CheckCircle2 className="size-3" aria-hidden="true" />
                          Already registered
                        </Badge>
                      ) : item.eligible ? (
                        <Badge variant="outline">Eligible</Badge>
                      ) : (
                        <div>
                          <Badge variant="outline">Not eligible</Badge>
                          {item.eligibilityReason && (
                            <p className="mt-1 text-xs text-muted-foreground">{item.eligibilityReason}</p>
                          )}
                        </div>
                      )}
                      {canRegister && (
                        <Button size="sm" onClick={() => register(drive)} disabled={busy === `drive-${drive.id}`}>
                          {busy === `drive-${drive.id}` ? "Registering..." : "Register"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Briefcase className="size-4" aria-hidden="true" />
            My applications
          </CardTitle>
          <CardDescription>Stage history and offers are recorded by your placement team.</CardDescription>
        </CardHeader>
        <CardContent>
          {applicationItems.length === 0 ? (
            <EmptyState
              compact
              icon={Briefcase}
              title="No applications yet"
              description="Register for an open drive to start an application."
            />
          ) : (
            <div className="space-y-3">
              {applicationItems.map((application) => (
                <div key={application.id} className="rounded-xl border border-border/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold">{application.companyName}</p>
                      <p className="text-xs text-muted-foreground">
                        {application.driveName} · {application.jobTitle}
                      </p>
                    </div>
                    <Badge className={`border-0 ${stageTone(application.stage)}`}>{label(application.stage)}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Applied {formatDateTime(application.appliedAt)}
                    {application.eligibilityOverride ? " · Registered with an eligibility override" : ""}
                  </p>

                  {application.offer && (
                    <div className="mt-3 rounded-lg bg-muted/30 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">
                            Offer {application.offer.packageAmount != null
                              ? `${application.offer.currency || ""} ${application.offer.packageAmount}`
                              : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Status: {label(application.offer.status)}
                            {application.offer.offerDate ? ` · Offered ${formatDate(application.offer.offerDate)}` : ""}
                            {application.offer.joinedAt ? ` · Joined ${formatDate(application.offer.joinedAt)}` : ""}
                          </p>
                        </div>
                        {application.offer.status !== "JOINED" && application.offer.status !== "WITHDRAWN" && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => respond(application, "ACCEPTED")}
                              disabled={busy === `offer-${application.offer.id}`}
                            >
                              <CheckCircle2 className="size-3.5" aria-hidden="true" />
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => respond(application, "DECLINED")}
                              disabled={busy === `offer-${application.offer.id}`}
                            >
                              <XCircle className="size-3.5" aria-hidden="true" />
                              Decline
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {application.stage !== "JOINED" && application.stage !== "WITHDRAWN" && (
                    <div className="mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => withdraw(application)}
                        disabled={busy === `application-${application.id}`}
                      >
                        {busy === `application-${application.id}` ? "Withdrawing..." : "Withdraw application"}
                      </Button>
                    </div>
                  )}

                  {application.history?.length > 0 && (
                    <details className="mt-3 text-xs">
                      <summary className="cursor-pointer font-medium text-primary">Stage history</summary>
                      <ul className="mt-1.5 space-y-1 text-muted-foreground">
                        {application.history.map((event) => (
                          <li key={event.id}>
                            {label(event.stage)}
                            {event.note ? ` — ${event.note}` : ""}
                            {event.recordedAt ? ` · ${formatDateTime(event.recordedAt)}` : ""}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
