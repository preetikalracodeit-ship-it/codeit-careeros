"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Copy,
  MailPlus,
  Plus,
  Power,
  RefreshCw,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/field";
import { Input } from "@/components/ui/input";
import { Breadcrumb } from "@/components/breadcrumb";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import api from "@/lib/api";
import { labelOf } from "@/lib/college";
import { formatDateTime } from "@/lib/format";
import { cn } from "cn";

const emptyInstitution = {
  code: "",
  name: "",
  timezone: "Asia/Kolkata",
  contactEmail: "",
  status: "ACTIVE",
};

export default function AdminInstitutionsPage() {
  const [institutions, setInstitutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyInstitution);
  const [saving, setSaving] = useState(false);
  const [inviteFor, setInviteFor] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.get("/admin/institutions");
      setInstitutions(data || []);
    } catch (err) {
      setError(err.message || "Failed to load institutions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async institution loader; state updates happen in promise callbacks
    load();
  }, [load]);

  async function createInstitution(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.post("/admin/institutions", {
        ...form,
        contactEmail: form.contactEmail.trim() || null,
      });
      setCreateOpen(false);
      setForm(emptyInstitution);
      await load();
    } catch (err) {
      setError(err.message || "Could not create the institution.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(institution) {
    setError("");
    try {
      await api.patch(`/admin/institutions/${institution.id}/status`, null, {
        params: { status: institution.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" },
      });
      await load();
    } catch (err) {
      setError(err.message || "Could not update the institution status.");
    }
  }

  async function createBootstrap(event) {
    event.preventDefault();
    if (!inviteFor) return;
    setInviting(true);
    setError("");
    setCreated(null);
    try {
      const data = await api.post(`/admin/institutions/${inviteFor.id}/invitations`, {
        email: inviteEmail.trim(),
        designation: "COLLEGE_ADMIN",
        scopeType: "INSTITUTION",
        scopeId: null,
      });
      setCreated(data);
      setInviteEmail("");
      await load();
    } catch (err) {
      setError(err.message || "Could not create the bootstrap invitation.");
    } finally {
      setInviting(false);
    }
  }

  async function copyLink() {
    if (!created?.activationPath) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${created.activationPath}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Could not copy automatically. Select the link and copy it manually.");
    }
  }

  if (loading && institutions.length === 0) return <LoadingState label="Loading institutions…" />;

  if (error && institutions.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Institutions"
          description="Platform-level institution provisioning."
          breadcrumb={<Breadcrumb items={[{ label: "Institutions" }]} />}
        />
        <ErrorState title="Couldn't load institutions" description={error} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Institutions"
        description="Create institutions and bootstrap only their first college administrator. Platform admins do not gain access to college student data."
        breadcrumb={<Breadcrumb items={[{ label: "Institutions" }]} />}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={cn("size-3.5", loading && "animate-spin")} aria-hidden="true" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" aria-hidden="true" />
              New institution
            </Button>
          </>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {institutions.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No institutions yet"
          description="Create the first institution, then bootstrap its college administrator."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-3.5" aria-hidden="true" />
              New institution
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {institutions.map((institution) => (
            <Card key={institution.id}>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="size-4" aria-hidden="true" />
                    {institution.name}
                  </CardTitle>
                  <CardDescription>
                    {institution.code} · {institution.timezone || "Timezone not set"}
                  </CardDescription>
                </div>
                <Badge className={cn("border-0", institution.status === "ACTIVE" ? "bg-chart-3/15 text-chart-3" : "bg-muted text-muted-foreground")}>
                  {labelOf(institution.status)}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">Contact</dt>
                    <dd className="truncate">{institution.contactEmail || "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Created</dt>
                    <dd>{formatDateTime(institution.createdAt)}</dd>
                  </div>
                </dl>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setInviteFor(institution);
                      setCreated(null);
                      setInviteEmail("");
                    }}
                    disabled={institution.status !== "ACTIVE"}
                  >
                    <MailPlus className="size-3.5" aria-hidden="true" />
                    Bootstrap administrator
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => toggleStatus(institution)}>
                    <Power className="size-3.5" aria-hidden="true" />
                    {institution.status === "ACTIVE" ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create institution"
        description="The code is permanent and unique. The institution starts without staff or students."
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={createInstitution} disabled={saving}>
              {saving ? "Creating…" : "Create institution"}
            </Button>
          </>
        }
      >
        <form onSubmit={createInstitution} className="mt-4 space-y-3">
          <Field id="institution-code" label="Code" required hint="2–40 characters; letters, digits, dot, underscore or dash.">
            {(inputId) => (
              <Input
                id={inputId}
                value={form.code}
                onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                required
                maxLength={40}
              />
            )}
          </Field>
          <Field id="institution-name" label="Name" required>
            {(inputId) => (
              <Input
                id={inputId}
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                required
                maxLength={200}
              />
            )}
          </Field>
          <Field id="institution-timezone" label="Timezone">
            {(inputId) => (
              <Input
                id={inputId}
                value={form.timezone}
                onChange={(event) => setForm((prev) => ({ ...prev, timezone: event.target.value }))}
                placeholder="Asia/Kolkata"
              />
            )}
          </Field>
          <Field id="institution-contact" label="Contact email">
            {(inputId) => (
              <Input
                id={inputId}
                type="email"
                value={form.contactEmail}
                onChange={(event) => setForm((prev) => ({ ...prev, contactEmail: event.target.value }))}
              />
            )}
          </Field>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(inviteFor)}
        onOpenChange={(open) => {
          if (!open) {
            setInviteFor(null);
            setCreated(null);
          }
        }}
        title="Bootstrap college administrator"
        description={
          inviteFor
            ? `${inviteFor.name} · allowed only while the institution has no active college administrator.`
            : undefined
        }
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setInviteFor(null);
                setCreated(null);
              }}
              disabled={inviting}
            >
              Close
            </Button>
            {!created && (
              <Button onClick={createBootstrap} disabled={inviting || !inviteEmail.trim()}>
                {inviting ? "Creating…" : "Create invitation"}
              </Button>
            )}
          </>
        }
      >
        <div className="mt-4 space-y-4">
          {created ? (
            <>
              <div className="flex items-center gap-2 rounded-xl border border-chart-3/40 bg-chart-3/5 p-3 text-sm">
                <CheckCircle2 className="size-4 shrink-0 text-chart-3" aria-hidden="true" />
                <p>
                  {created.emailDelivered
                    ? "Invitation email sent."
                    : created.deliveryMessage || "Email delivery is not configured. Share this one-time link directly."}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  readOnly
                  aria-label="Bootstrap activation link"
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}${created.activationPath}`}
                />
                <Button type="button" variant="outline" onClick={copyLink}>
                  <Copy className="size-3.5" aria-hidden="true" />
                  {copied ? "Copied" : "Copy link"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Expires {formatDateTime(created.invitation?.expiresAt)}. The link is shown once; only its hash is stored.
              </p>
            </>
          ) : (
            <form onSubmit={createBootstrap} className="space-y-3">
              <Field id="bootstrap-email" label="Administrator email" required>
                {(inputId) => (
                  <Input
                    id={inputId}
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="principal@college.edu"
                    required
                  />
                )}
              </Field>
              <p className="text-xs text-muted-foreground">
                The bootstrap invitation is always an institution-wide college administrator. Later staff invitations
                must be issued by that administrator.
              </p>
            </form>
          )}
        </div>
      </Dialog>
    </div>
  );
}
