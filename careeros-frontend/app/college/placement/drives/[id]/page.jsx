"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, ClipboardList, RefreshCw, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { formatDate, formatDateTime } from "@/lib/format";

const STAGES = [
  "REGISTERED",
  "APPLIED",
  "ASSESSMENT",
  "TECHNICAL_INTERVIEW",
  "HR_INTERVIEW",
  "OFFERED",
  "JOINED",
  "REJECTED",
  "WITHDRAWN",
];
const OFFER_STATUSES = ["PENDING", "ACCEPTED", "DECLINED", "JOINED", "WITHDRAWN"];

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

function stageTone(stage) {
  if (stage === "JOINED") return "bg-chart-3/15 text-chart-3";
  if (stage === "REJECTED" || stage === "WITHDRAWN") return "bg-destructive/10 text-destructive";
  if (stage === "OFFERED") return "bg-primary/10 text-primary";
  return "bg-muted text-muted-foreground";
}

export default function CollegePlacementDrivePage() {
  const params = useParams();
  const driveId = params?.id;
  const [me, setMe] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [registerOpen, setRegisterOpen] = useState(false);
  const [registerForm, setRegisterForm] = useState({ enrollmentId: "", override: false, overrideReason: "" });
  const [stageOpen, setStageOpen] = useState(false);
  const [stageTarget, setStageTarget] = useState(null);
  const [stageForm, setStageForm] = useState({ stage: "APPLIED", note: "" });
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerTarget, setOfferTarget] = useState(null);
  const [offerForm, setOfferForm] = useState({
    packageAmount: "",
    currency: "INR",
    offerDate: "",
    joinedAt: "",
    status: "PENDING",
    notes: "",
  });
  const [offerUpdates, setOfferUpdates] = useState({});

  const canManage = new Set(me?.permissions || []).has("MANAGE_APPLICATIONS");

  const load = useCallback(async () => {
    if (!driveId) return;
    setLoading(true);
    setError("");
    try {
      setDetail(await api.get(`/college/placement/drives/${driveId}`));
    } catch (err) {
      setError(err.message || "Could not load this placement drive.");
    } finally {
      setLoading(false);
    }
  }, [driveId]);

  useEffect(() => {
    let ignore = false;
    api
      .get("/college/me")
      .then((data) => {
        if (!ignore) setMe(data);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async drive loader; state updates happen in promise callbacks
    load();
  }, [load]);

  const eligibleOptions = useMemo(() => {
    const students = detail?.eligibleStudents || [];
    return [
      { value: "", label: "Select a student" },
      ...students.map((student) => ({
        value: String(student.enrollmentId),
        label: `${student.fullName} · ${student.rollNumber}${student.alreadyApplied ? " (already registered)" : ""}`,
        disabled: student.alreadyApplied,
      })),
    ];
  }, [detail]);

  const selectedStudent = useMemo(() => {
    return (detail?.eligibleStudents || []).find(
      (student) => String(student.enrollmentId) === String(registerForm.enrollmentId),
    );
  }, [detail, registerForm.enrollmentId]);

  function openRegister(student = null) {
    setRegisterForm({
      enrollmentId: student ? String(student.enrollmentId) : "",
      override: student ? !student.eligible : false,
      overrideReason: "",
    });
    setRegisterOpen(true);
  }

  function openStage(application) {
    setStageTarget(application);
    setStageForm({ stage: application.stage || "APPLIED", note: "" });
    setStageOpen(true);
  }

  function openOffer(application) {
    setOfferTarget(application);
    setOfferForm({
      packageAmount: application.offer?.packageAmount ?? "",
      currency: application.offer?.currency || "INR",
      offerDate: application.offer?.offerDate || "",
      joinedAt: application.offer?.joinedAt || "",
      status: application.offer?.status || "PENDING",
      notes: application.offer?.notes || "",
    });
    setOfferOpen(true);
  }

  async function registerStudent(event) {
    event.preventDefault();
    if (!registerForm.enrollmentId) {
      toast.error("Select a student.");
      return;
    }
    if (selectedStudent && !selectedStudent.eligible && !registerForm.overrideReason.trim()) {
      toast.error("Enter a reason for the eligibility override.");
      return;
    }
    setSaving(true);
    try {
      await api.post(`/college/placement/drives/${driveId}/applications`, {
        enrollmentId: Number(registerForm.enrollmentId),
        override: Boolean(registerForm.override || (selectedStudent && !selectedStudent.eligible)),
        overrideReason: registerForm.overrideReason.trim() || null,
      });
      toast.success("Student registered for the drive.");
      setRegisterOpen(false);
      await load();
    } catch (err) {
      toast.error(err.message || "Could not register the student.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStage(event) {
    event.preventDefault();
    if (!stageTarget) return;
    setSaving(true);
    try {
      await api.patch(`/college/placement/applications/${stageTarget.id}`, {
        stage: stageForm.stage,
        note: stageForm.note.trim() || null,
      });
      toast.success("Application stage updated.");
      setStageOpen(false);
      await load();
    } catch (err) {
      toast.error(err.message || "Could not update the application.");
    } finally {
      setSaving(false);
    }
  }

  async function saveOffer(event) {
    event.preventDefault();
    if (!offerTarget) return;
    setSaving(true);
    try {
      const payload = {
        packageAmount: offerForm.packageAmount === "" ? null : Number(offerForm.packageAmount),
        currency: offerForm.currency.trim() || null,
        offerDate: offerForm.offerDate || null,
        joinedAt: offerForm.status === "JOINED" ? offerForm.joinedAt || null : null,
        status: offerForm.status,
        notes: offerForm.notes.trim(),
      };
      if (offerTarget.offer) {
        await api.patch(`/college/placement/offers/${offerTarget.offer.id}`, payload);
        toast.success("Offer updated.");
      } else {
        await api.post(`/college/placement/applications/${offerTarget.id}/offer`, payload);
        toast.success("Offer recorded.");
      }
      setOfferOpen(false);
      await load();
    } catch (err) {
      toast.error(err.message || "Could not save the offer.");
    } finally {
      setSaving(false);
    }
  }

  function offerEdit(application) {
    return (
      offerUpdates[application.id] || {
        status: application.offer?.status || "PENDING",
        joinedAt: application.offer?.joinedAt || "",
      }
    );
  }

  function setOfferEdit(applicationId, patch) {
    setOfferUpdates((prev) => ({
      ...prev,
      [applicationId]: { ...(prev[applicationId] || {}), ...patch },
    }));
  }

  async function updateOfferInline(application) {
    const values = offerEdit(application);
    setSaving(true);
    try {
      await api.patch(`/college/placement/offers/${application.offer.id}`, {
        status: values.status,
        joinedAt: values.status === "JOINED" ? values.joinedAt || null : null,
      });
      toast.success("Offer updated.");
      setOfferUpdates((prev) => {
        const next = { ...prev };
        delete next[application.id];
        return next;
      });
      await load();
    } catch (err) {
      toast.error(err.message || "Could not update the offer.");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !detail) return <LoadingState label="Loading placement drive..." />;

  if (error && !detail) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Placement Drive"
          breadcrumb={<Breadcrumb items={[{ label: "Placement", href: "/college/placement" }, { label: "Drive" }]} />}
        />
        <ErrorState title="Couldn't load this drive" description={error} onRetry={load} />
      </div>
    );
  }

  if (!detail) {
    return (
      <EmptyState
        icon={ClipboardList}
        title="Drive not found"
        description="This drive may be outside your academic scope or no longer available."
        action={<Button render={<Link href="/college/placement" />}>Back to placement</Button>}
      />
    );
  }

  const drive = detail.drive;
  const applications = detail.applications || [];
  const eligibleStudents = detail.eligibleStudents || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={drive.name}
        description={`${drive.companyName} · ${drive.jobTitle} · ${drive.eligibleDepartmentName || "All departments"}`}
        breadcrumb={
          <Breadcrumb
            items={[
              { label: "Placement", href: "/college/placement" },
              { label: drive.name || "Drive" },
            ]}
          />
        }
        actions={
          <>
            <Button variant="outline" size="sm" render={<Link href="/college/placement" />}>
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Placement
            </Button>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={loading ? "size-3.5 animate-spin" : "size-3.5"} aria-hidden="true" />
              Refresh
            </Button>
            {canManage && (
              <Button size="sm" onClick={() => openRegister()}>
                <UserPlus className="size-3.5" aria-hidden="true" />
                Register student
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
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
            <Badge className="mt-1 border-0 bg-primary/10 text-primary">{label(drive.status)}</Badge>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Registration</p>
            <p className="mt-1 text-sm font-medium">
              {drive.registrationStart ? formatDate(drive.registrationStart) : "Open"} -{" "}
              {drive.registrationEnd ? formatDate(drive.registrationEnd) : "No deadline"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Drive date</p>
            <p className="mt-1 text-sm font-medium">{drive.driveDate ? formatDate(drive.driveDate) : "Not set"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Applications</p>
            <p className="mt-1 text-sm font-medium">{drive.applicationCount}</p>
          </div>
          <div className="sm:col-span-2 xl:col-span-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Eligibility</p>
            <p className="mt-1 text-sm">
              {drive.eligibilityCriteria || "No additional criteria recorded."}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {[
                drive.eligibleDepartmentName,
                drive.eligibleProgramName,
                drive.eligibleBatchLabel,
                drive.eligibleGraduationYear ? `Class of ${drive.eligibleGraduationYear}` : null,
                drive.minimumReadinessPercent != null ? `${drive.minimumReadinessPercent}% readiness` : null,
              ]
                .filter(Boolean)
                .join(" · ") || "All students in scope"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="size-4" aria-hidden="true" />
            Eligible students
          </CardTitle>
          <CardDescription>
            Eligibility is computed from the student&apos;s enrollment, batch and current readiness. Overrides require a reason and are audited.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {eligibleStudents.length === 0 ? (
            <EmptyState
              compact
              icon={UserPlus}
              title="No students in scope"
              description="Enroll active students in this drive's academic scope first."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-2.5 pr-3 font-semibold">Student</th>
                    <th className="py-2.5 pr-3 font-semibold">Roll number</th>
                    <th className="py-2.5 pr-3 font-semibold">Department / Program</th>
                    <th className="py-2.5 pr-3 font-semibold">Batch</th>
                    <th className="py-2.5 pr-3 font-semibold">Readiness</th>
                    <th className="py-2.5 pr-3 font-semibold">Eligibility</th>
                    <th className="py-2.5 font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {eligibleStudents.map((student) => (
                    <tr key={student.enrollmentId} className="border-b border-border/40 last:border-0">
                      <td className="py-3 pr-3">
                        <p className="font-medium">{student.fullName}</p>
                        <p className="text-xs text-muted-foreground">{student.studentId}</p>
                      </td>
                      <td className="py-3 pr-3">{student.rollNumber}</td>
                      <td className="py-3 pr-3">
                        <p>{student.departmentName}</p>
                        <p className="text-xs text-muted-foreground">{student.programName}</p>
                      </td>
                      <td className="py-3 pr-3">{student.batchLabel}</td>
                      <td className="py-3 pr-3">
                        {student.readinessPercent == null ? "Unavailable" : `${student.readinessPercent}%`}
                      </td>
                      <td className="py-3 pr-3">
                        <Badge variant={student.eligible ? "secondary" : "outline"}>
                          {student.eligible ? "Eligible" : "Not eligible"}
                        </Badge>
                        {!student.eligible && student.reason && (
                          <p className="mt-1 max-w-56 text-xs text-muted-foreground">{student.reason}</p>
                        )}
                        {student.alreadyApplied && (
                          <p className="mt-1 text-xs font-medium text-primary">Already registered</p>
                        )}
                      </td>
                      <td className="py-3">
                        {canManage && !student.alreadyApplied && (
                          <Button variant="outline" size="sm" onClick={() => openRegister(student)}>
                            {student.eligible ? "Register" : "Override"}
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
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="size-4" aria-hidden="true" />
            Applications
          </CardTitle>
          <CardDescription>Stages, stage history, offers and joining outcomes.</CardDescription>
        </CardHeader>
        <CardContent>
          {applications.length === 0 ? (
            <EmptyState
              compact
              icon={ClipboardList}
              title="No applications yet"
              description={canManage ? "Register a student or wait for students to register during the open window." : "Applications will appear here as students register."}
            />
          ) : (
            <div className="space-y-3">
              {applications.map((application) => {
                const offerValues = offerEdit(application);
                return (
                  <div key={application.id} className="rounded-xl border border-border/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">{application.studentName}</p>
                        <p className="text-xs text-muted-foreground">
                          {application.rollNumber} · {application.departmentName} / {application.programName} · {application.batchLabel}
                        </p>
                        {application.eligibilityOverride && (
                          <p className="mt-1 text-xs text-destructive">
                            Eligibility override: {application.overrideReason || "No reason recorded"}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={`border-0 ${stageTone(application.stage)}`}>{label(application.stage)}</Badge>
                        {application.offer && (
                          <Badge variant="outline">Offer: {label(application.offer.status)}</Badge>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                      <p>
                        <span className="text-muted-foreground">Applied:</span> {formatDateTime(application.appliedAt)}
                      </p>
                      <p>
                        <span className="text-muted-foreground">Updated:</span> {formatDateTime(application.updatedAt)}
                      </p>
                      {application.offer && (
                        <p>
                          <span className="text-muted-foreground">Package:</span>{" "}
                          {money(application.offer.packageAmount, application.offer.currency)}
                          {application.offer.joinedAt ? ` · Joined ${formatDate(application.offer.joinedAt)}` : ""}
                        </p>
                      )}
                    </div>

                    {application.history?.length > 0 && (
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer font-medium text-primary">Stage history</summary>
                        <ul className="mt-1.5 space-y-1 text-muted-foreground">
                          {application.history.map((event) => (
                            <li key={event.id}>
                              {label(event.stage)}
                              {event.note ? ` — ${event.note}` : ""}
                              {event.recordedByName ? ` · ${event.recordedByName}` : ""}
                              {event.recordedAt ? ` · ${formatDateTime(event.recordedAt)}` : ""}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}

                    {canManage && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" onClick={() => openStage(application)}>
                          Update stage
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openOffer(application)}>
                          {application.offer ? "Edit offer" : "Record offer"}
                        </Button>
                      </div>
                    )}

                    {canManage && application.offer && (
                      <div className="mt-3 grid gap-2 rounded-lg bg-muted/30 p-2 sm:grid-cols-[1fr_1fr_auto]">
                        <Select
                          aria-label={`Offer status for ${application.studentName}`}
                          value={offerValues.status}
                          onChange={(event) => setOfferEdit(application.id, { status: event.target.value })}
                          options={OFFER_STATUSES.map((value) => ({ value, label: label(value) }))}
                        />
                        <Input
                          type="date"
                          aria-label={`Joining date for ${application.studentName}`}
                          value={offerValues.joinedAt}
                          onChange={(event) => setOfferEdit(application.id, { joinedAt: event.target.value })}
                          disabled={offerValues.status !== "JOINED"}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => updateOfferInline(application)}
                          disabled={saving}
                        >
                          <CheckCircle2 className="size-3.5" aria-hidden="true" />
                          Update offer
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        title="Register a student"
        description="An ineligible student can only be registered with an explicit, audited override reason."
        className="max-w-xl"
      >
        <form onSubmit={registerStudent} className="mt-4 space-y-4">
          <Field label="Student" required htmlFor="register-student">
            {(id) => (
              <Select
                id={id}
                value={registerForm.enrollmentId}
                onChange={(event) => {
                  const value = event.target.value;
                  const student = (detail.eligibleStudents || []).find(
                    (item) => String(item.enrollmentId) === value,
                  );
                  setRegisterForm((prev) => ({
                    ...prev,
                    enrollmentId: value,
                    override: student ? !student.eligible : false,
                  }));
                }}
                options={eligibleOptions}
              />
            )}
          </Field>
          {selectedStudent && !selectedStudent.eligible && (
            <Alert>
              <AlertDescription>
                This student is not eligible: {selectedStudent.reason || "eligibility requirements are not met"}.
              </AlertDescription>
            </Alert>
          )}
          <Field
            label="Override reason"
            htmlFor="register-override-reason"
            hint="Required for ineligible students. Never include sensitive personal data."
          >
            {(id) => (
              <Textarea
                id={id}
                value={registerForm.overrideReason}
                onChange={(event) => setRegisterForm((prev) => ({ ...prev, overrideReason: event.target.value }))}
                maxLength={500}
                disabled={!selectedStudent || selectedStudent.eligible}
              />
            )}
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setRegisterOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Registering..." : "Register student"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={stageOpen}
        onOpenChange={setStageOpen}
        title="Update application stage"
        description="Every change is appended to the application's stage history."
        className="max-w-lg"
      >
        <form onSubmit={updateStage} className="mt-4 space-y-4">
          <Field label="Stage" required htmlFor="stage-value">
            {(id) => (
              <Select
                id={id}
                value={stageForm.stage}
                onChange={(event) => setStageForm((prev) => ({ ...prev, stage: event.target.value }))}
                options={STAGES.map((value) => ({ value, label: label(value) }))}
              />
            )}
          </Field>
          <Field label="Note" htmlFor="stage-note">
            {(id) => (
              <Textarea
                id={id}
                value={stageForm.note}
                onChange={(event) => setStageForm((prev) => ({ ...prev, note: event.target.value }))}
                maxLength={500}
              />
            )}
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setStageOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Update stage"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={offerOpen}
        onOpenChange={setOfferOpen}
        title={offerTarget?.offer ? "Edit offer" : "Record an offer"}
        description="Offers and joining outcomes are tracked separately from the application stage."
        className="max-w-xl"
      >
        <form onSubmit={saveOffer} className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Package amount" htmlFor="offer-amount">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min="0"
                  step="0.01"
                  value={offerForm.packageAmount}
                  onChange={(event) => setOfferForm((prev) => ({ ...prev, packageAmount: event.target.value }))}
                />
              )}
            </Field>
            <Field label="Currency" htmlFor="offer-currency">
              {(id) => (
                <Input
                  id={id}
                  value={offerForm.currency}
                  onChange={(event) => setOfferForm((prev) => ({ ...prev, currency: event.target.value }))}
                  maxLength={10}
                />
              )}
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Offer date" htmlFor="offer-date">
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  value={offerForm.offerDate}
                  onChange={(event) => setOfferForm((prev) => ({ ...prev, offerDate: event.target.value }))}
                />
              )}
            </Field>
            <Field label="Status" htmlFor="offer-status">
              {(id) => (
                <Select
                  id={id}
                  value={offerForm.status}
                  onChange={(event) => setOfferForm((prev) => ({ ...prev, status: event.target.value }))}
                  options={OFFER_STATUSES.map((value) => ({ value, label: label(value) }))}
                />
              )}
            </Field>
            <Field label="Joining date" htmlFor="offer-joined" hint="Used when the status is Joined.">
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  value={offerForm.joinedAt}
                  onChange={(event) => setOfferForm((prev) => ({ ...prev, joinedAt: event.target.value }))}
                  disabled={offerForm.status !== "JOINED"}
                />
              )}
            </Field>
          </div>
          <Field label="Notes" htmlFor="offer-notes">
            {(id) => (
              <Textarea
                id={id}
                value={offerForm.notes}
                onChange={(event) => setOfferForm((prev) => ({ ...prev, notes: event.target.value }))}
                maxLength={500}
              />
            )}
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOfferOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : offerTarget?.offer ? "Save offer" : "Record offer"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
