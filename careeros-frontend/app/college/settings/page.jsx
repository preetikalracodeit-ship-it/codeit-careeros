"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, KeyRound, MailWarning, ShieldCheck, UserCog } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumb } from "@/components/breadcrumb";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import api from "@/lib/api";
import { designationLabel, labelOf } from "@/lib/college";

export default function CollegeSettingsPage() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    api
      .get("/college/me")
      .then((data) => {
        if (!ignore) setMe(data);
      })
      .catch((err) => {
        if (!ignore) setError(err.message || "Failed to load your membership.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  if (loading) return <LoadingState label="Loading your membership…" />;

  if (error || !me) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Settings"
          description="Your institution membership and server-derived permissions."
          breadcrumb={<Breadcrumb items={[{ label: "Settings" }]} />}
        />
        <ErrorState title="Couldn't load your membership" description={error || "Membership unavailable."} />
      </div>
    );
  }

  const canManageStructure = me.permissions?.includes("MANAGE_STRUCTURE");
  const canManageStaff = me.permissions?.includes("MANAGE_STAFF");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Your college account, scope and effective permissions."
        breadcrumb={<Breadcrumb items={[{ label: "Settings" }]} />}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="size-4" aria-hidden="true" />
              Institution membership
            </CardTitle>
            <CardDescription>Authority is derived from the server-side membership, not from a browser selector.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <Row label="Institution" value={me.institutionName} />
              <Row label="Your name" value={me.fullName} />
              <Row label="Email" value={me.email} />
              <Row label="Designation" value={designationLabel(me.designation)} />
              <Row label="Scope" value={me.scopeLabel || labelOf(me.scopeType)} />
              <Row label="Institution ID" value={me.institutionId} />
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              {canManageStaff && (
                <Button variant="outline" size="sm" render={<Link href="/college/staff" />}>
                  <UserCog className="size-3.5" aria-hidden="true" />
                  Manage staff
                </Button>
              )}
              {canManageStructure && (
                <Button variant="outline" size="sm" render={<Link href="/college/structure" />}>
                  <Building2 className="size-3.5" aria-hidden="true" />
                  Academic structure
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4" aria-hidden="true" />
              Effective permissions
            </CardTitle>
            <CardDescription>The API enforces these permissions on every request.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {(me.permissions || []).map((permission) => (
                <Badge key={permission} variant="secondary">
                  {labelOf(permission)}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="size-4" aria-hidden="true" />
            Security notes
          </CardTitle>
          <CardDescription>What this console deliberately does not do.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Platform administrators create institutions but cannot read college student data through this console.</li>
            <li>Every list, search, count, dashboard, report, export and student detail request is scoped server-side.</li>
            <li>Foreign institution or department IDs are rejected even when they are valid elsewhere.</li>
            <li>Invitation links expire after 48 hours, are single-use, and store only a SHA-256 hash.</li>
            <li>Audit events are append-only and never contain passwords, tokens, invitation secrets or CV contents.</li>
          </ul>
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300/40 bg-amber-50/50 p-3 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
            <MailWarning className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Email delivery is not configured in this environment. Invitation links must be shared directly by an
            administrator. Imported student accounts receive a random unusable password until a credential-delivery
            process is approved.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/40 py-2 last:border-0">
      <dt className="shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right">{value || "—"}</dd>
    </div>
  );
}
