"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  MailPlus,
  Pencil,
  RefreshCw,
  ShieldCheck,
  UserCog,
  XCircle,
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
import { designationLabel, DESIGNATIONS, labelOf, SCOPES } from "@/lib/college";
import { formatDateTime, prettifyEnum } from "@/lib/format";
import { cn } from "cn";

const emptyInvite = { email: "", designation: "FACULTY", scopeType: "SECTION", scopeId: "" };

function scopeOptionsFor(structure, type) {
  if (type === "DEPARTMENT") {
    return (structure?.departments || []).map((item) => ({ value: String(item.id), label: `${item.code} · ${item.name}` }));
  }
  if (type === "PROGRAM") {
    return (structure?.programs || []).map((item) => ({ value: String(item.id), label: `${item.code} · ${item.name}` }));
  }
  if (type === "BATCH") {
    return (structure?.batches || []).map((item) => ({ value: String(item.id), label: `${item.label} · ${item.programName}` }));
  }
  if (type === "SECTION") {
    return (structure?.sections || []).map((item) => ({ value: String(item.id), label: `${item.name} · ${item.batchLabel}` }));
  }
  return [];
}

function statusTone(status) {
  if (status === "ACTIVE" || status === "VALID" || status === "ACCEPTED") return "bg-chart-3/15 text-chart-3";
  if (status === "REVOKED" || status === "INACTIVE") return "bg-destructive/10 text-destructive";
  return "bg-muted text-muted-foreground";
}

export default function CollegeStaffPage() {
  const [me, setMe] = useState(null);
  const [structure, setStructure] = useState(null);
  const [members, setMembers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [invite, setInvite] = useState(emptyInvite);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(null);
  const [savingMember, setSavingMember] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [meData, structureData, memberData, invitationData] = await Promise.all([
        api.get("/college/me"),
        api.get("/college/structure"),
        api.get("/college/staff/members"),
        api.get("/college/staff/invitations"),
      ]);
      setMe(meData);
      setStructure(structureData);
      setMembers(memberData || []);
      setInvitations(invitationData || []);
    } catch (err) {
      setError(err.message || "Failed to load staff.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async staff loader; state updates happen in promise callbacks
    load();
  }, [load]);

  const canManage = me?.permissions?.includes("MANAGE_STAFF");

  const inviteScopeOptions = useMemo(() => scopeOptionsFor(structure, invite.scopeType), [invite.scopeType, structure]);
  const editScopeOptions = useMemo(
    () => (editing ? scopeOptionsFor(structure, editing.scopeType) : []),
    [editing, structure],
  );

  function changeDesignation(value) {
    setInvite((prev) => {
      if (value === "COLLEGE_ADMIN" || value === "TPO") {
        return { ...prev, designation: value, scopeType: "INSTITUTION", scopeId: "" };
      }
      if (value === "HOD") {
        return { ...prev, designation: value, scopeType: "DEPARTMENT", scopeId: "" };
      }
      return {
        ...prev,
        designation: value,
        scopeType: "SECTION",
        scopeId: "",
      };
    });
  }

  async function submitInvite(event) {
    event.preventDefault();
    setCreating(true);
    setError("");
    setCreated(null);
    try {
      const data = await api.post("/college/staff/invitations", {
        email: invite.email.trim(),
        designation: invite.designation,
        scopeType: invite.scopeType,
        scopeId: invite.scopeType === "INSTITUTION" ? null : Number(invite.scopeId),
      });
      setCreated(data);
      setInvite(emptyInvite);
      await load();
    } catch (err) {
      setError(err.message || "Could not create the invitation.");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(invitation) {
    setError("");
    try {
      await api.post(`/college/staff/invitations/${invitation.id}/revoke`);
      await load();
    } catch (err) {
      setError(err.message || "Could not revoke the invitation.");
    }
  }

  async function copyLink() {
    if (!created?.activationPath) return;
    const url = `${window.location.origin}${created.activationPath}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Could not copy automatically. Select the link and copy it manually.");
    }
  }

  function openEdit(member) {
    setEditing({
      ...member,
      scopeType: member.scopeType,
      scopeId: member.scopeId ? String(member.scopeId) : "",
      status: member.status,
    });
  }

  async function saveMember(event) {
    event.preventDefault();
    if (!editing) return;
    setSavingMember(true);
    setError("");
    try {
      await api.patch(`/college/staff/members/${editing.id}`, {
        designation: editing.designation,
        scopeType: editing.scopeType,
        scopeId: editing.scopeType === "INSTITUTION" ? null : Number(editing.scopeId),
        status: editing.status,
      });
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message || "Could not update this membership.");
    } finally {
      setSavingMember(false);
    }
  }

  if (loading && !me) return <LoadingState label="Loading staff…" />;

  if (!canManage) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Staff"
          description="Invite and manage institution staff."
          breadcrumb={<Breadcrumb items={[{ label: "Staff" }]} />}
        />
        <ErrorState
          title="Staff management is not available for your role"
          description={error || "Only a college administrator can invite or manage staff."}
        />
      </div>
    );
  }

  const pendingInvitations = invitations.filter((item) => item.status === "VALID");
  const pastInvitations = invitations.filter((item) => item.status !== "VALID");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff"
        description="Invite TPOs, HODs and faculty, and control their institution scope."
        breadcrumb={<Breadcrumb items={[{ label: "Staff" }]} />}
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

      {created && (
        <Card className="border-chart-3/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-4 text-chart-3" aria-hidden="true" />
              Invitation created
            </CardTitle>
            <CardDescription>
              {created.emailDelivered
                ? "The invitation email was sent."
                : created.deliveryMessage || "Email delivery is not configured. Share this one-time link directly."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input readOnly value={`${typeof window !== "undefined" ? window.location.origin : ""}${created.activationPath}`} aria-label="Invitation activation link" />
              <Button type="button" variant="outline" onClick={copyLink}>
                <Copy className="size-3.5" aria-hidden="true" />
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Expires {formatDateTime(created.invitation?.expiresAt)}. The link is shown once; only a hash is stored.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MailPlus className="size-4" aria-hidden="true" />
            Invite staff
          </CardTitle>
          <CardDescription>
            The invited person activates the account from the one-time link. Existing accounts must also prove their
            password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitInvite} className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr_auto] lg:items-end">
            <Field id="invite-email" label="Email" required>
              {(inputId) => (
                <Input
                  id={inputId}
                  type="email"
                  value={invite.email}
                  onChange={(event) => setInvite((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="name@college.edu"
                  required
                />
              )}
            </Field>
            <Select
              label="Designation"
              value={invite.designation}
              onChange={(event) => changeDesignation(event.target.value)}
              options={DESIGNATIONS.map((value) => ({ value, label: designationLabel(value) }))}
            />
            <Select
              label="Scope"
              value={invite.scopeType}
              onChange={(event) => setInvite((prev) => ({ ...prev, scopeType: event.target.value, scopeId: "" }))}
              options={SCOPES.filter((scope) => {
                if (invite.designation === "COLLEGE_ADMIN" || invite.designation === "TPO") return scope === "INSTITUTION";
                if (invite.designation === "HOD") return scope === "DEPARTMENT";
                return scope === "SECTION";
              }).map((value) => ({ value, label: labelOf(value) }))}
            />
            {invite.scopeType === "INSTITUTION" ? (
              <div className="rounded-lg border border-border/60 px-3 py-2 text-xs text-muted-foreground">
                Institution-wide access
              </div>
            ) : (
              <Select
                label="Scope target"
                value={invite.scopeId}
                onChange={(event) => setInvite((prev) => ({ ...prev, scopeId: event.target.value }))}
                options={[{ value: "", label: "Select…" }, ...inviteScopeOptions]}
              />
            )}
            <Button
              type="submit"
              disabled={creating || !invite.email.trim() || (invite.scopeType !== "INSTITUTION" && !invite.scopeId)}
            >
              {creating ? "Creating…" : "Invite"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Members</CardTitle>
            <CardDescription>{members.length} active and inactive memberships.</CardDescription>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <EmptyState compact icon={UserCog} title="No staff yet" description="Invite the first TPO, HOD or faculty member." />
            ) : (
              <ul className="space-y-2">
                {members.map((member) => (
                  <li key={member.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{member.fullName || member.email}</p>
                      <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {designationLabel(member.designation)} · {member.scopeLabel}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={cn("border-0", statusTone(member.status))}>{labelOf(member.status)}</Badge>
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(member)} aria-label={`Edit ${member.email}`}>
                        <Pencil className="size-3.5" aria-hidden="true" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invitations</CardTitle>
            <CardDescription>{pendingInvitations.length} pending · {pastInvitations.length} past</CardDescription>
          </CardHeader>
          <CardContent>
            {invitations.length === 0 ? (
              <EmptyState compact icon={MailPlus} title="No invitations yet" description="Invite a colleague to get started." />
            ) : (
              <ul className="space-y-2">
                {invitations.map((invitation) => (
                  <li key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{invitation.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {designationLabel(invitation.designation)} · {invitation.scopeLabel}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {invitation.status === "VALID" ? `Expires ${formatDateTime(invitation.expiresAt)}` : `Created ${formatDateTime(invitation.createdAt)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={cn("border-0", statusTone(invitation.status))}>{labelOf(invitation.status)}</Badge>
                      {invitation.status === "VALID" && (
                        <Button variant="ghost" size="icon-sm" onClick={() => revoke(invitation)} aria-label={`Revoke ${invitation.email}`}>
                          <XCircle className="size-3.5 text-destructive" aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        title="Edit membership"
        description={editing ? `${editing.fullName || editing.email} · ${editing.email}` : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={savingMember}>
              Cancel
            </Button>
            <Button onClick={saveMember} disabled={savingMember}>
              {savingMember ? "Saving…" : "Save changes"}
            </Button>
          </>
        }
      >
        {editing && (
          <form onSubmit={saveMember} className="mt-4 space-y-3">
            <Select
              label="Designation"
              value={editing.designation}
              onChange={(event) => setEditing((prev) => ({ ...prev, designation: event.target.value }))}
              options={DESIGNATIONS.map((value) => ({ value, label: designationLabel(value) }))}
            />
            <Select
              label="Scope"
              value={editing.scopeType}
              onChange={(event) => setEditing((prev) => ({ ...prev, scopeType: event.target.value, scopeId: "" }))}
              options={SCOPES.filter((scope) => {
                if (editing.designation === "COLLEGE_ADMIN" || editing.designation === "TPO") return scope === "INSTITUTION";
                if (editing.designation === "HOD") return scope === "DEPARTMENT";
                return scope !== "INSTITUTION";
              }).map((value) => ({ value, label: labelOf(value) }))}
            />
            {editing.scopeType !== "INSTITUTION" && (
              <Select
                label="Scope target"
                value={editing.scopeId}
                onChange={(event) => setEditing((prev) => ({ ...prev, scopeId: event.target.value }))}
                options={[{ value: "", label: "Select…" }, ...editScopeOptions]}
              />
            )}
            <Select
              label="Membership status"
              value={editing.status}
              onChange={(event) => setEditing((prev) => ({ ...prev, status: event.target.value }))}
              options={[
                { value: "ACTIVE", label: "Active" },
                { value: "INACTIVE", label: "Inactive" },
              ]}
            />
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              The server keeps at least one active college administrator and audits every membership change.
            </p>
          </form>
        )}
      </Dialog>
    </div>
  );
}
