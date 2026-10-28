"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, BadgeCheck, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthSplit } from "@/components/auth/auth-split";
import { Field } from "@/components/field";
import { LoadingState } from "@/components/loading-state";
import api from "@/lib/api";
import { auth } from "@/lib/auth";
import { designationLabel } from "@/lib/college";
import { formatDateTime } from "@/lib/format";
import { homeForRole } from "@/lib/roles";

function InvitationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState({ fullName: "", password: "", confirm: "", termsAccepted: false });
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return undefined;
    let ignore = false;
    api
      .get(`/invitations/${encodeURIComponent(token)}`, { skipAuth: true })
      .then((data) => {
        if (!ignore) setMetadata(data);
      })
      .catch((err) => {
        if (!ignore) {
          setLoadError(
            err.status === 404
              ? "This invitation link is invalid. Ask your college administrator for a new one."
              : err.message || "Could not validate this invitation.",
          );
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [token]);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validate() {
    const errors = {};
    if (form.password.length < 8) errors.password = "Use at least 8 characters.";
    else if (!/[A-Z]/.test(form.password) || !/[a-z]/.test(form.password) || !/\d/.test(form.password)) {
      errors.password = "Include upper-case, lower-case and a number.";
    }
    if (form.password !== form.confirm) errors.confirm = "Passwords do not match.";
    if (!form.termsAccepted) errors.termsAccepted = "Accept the Terms and Privacy Policy to continue.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!validate()) return;
    setSubmitting(true);
    try {
      const data = await api.post(
        `/invitations/${encodeURIComponent(token)}/accept`,
        {
          fullName: form.fullName.trim() || null,
          password: form.password,
          termsAccepted: form.termsAccepted,
        },
        { skipAuth: true },
      );
      auth.save(data);
      router.replace(homeForRole(data.user?.role));
    } catch (err) {
      setError(err.message || "Could not activate this invitation.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <AuthSplit
        eyebrow="Staff invitation"
        title="Activate your staff account"
        description="College administrator, TPO, HOD and faculty accounts are created by invitation."
        footer={
          <Link href="/login" className="text-sm font-semibold text-primary hover:underline">
            Already activated? Sign in
          </Link>
        }
      >
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Open the complete one-time link issued by your college administrator. The link is single-use and expires
            after 48 hours.
          </p>
          <p>
            Students can create an account directly. Platform administrator accounts are provisioned by CODEIT and do
            not use this page.
          </p>
          <p className="rounded-xl border border-border/60 bg-muted/40 p-3 text-xs">
            If your link is incomplete or expired, ask the college administrator who invited you to issue a new one.
          </p>
        </div>
      </AuthSplit>
    );
  }

  if (loading) return <LoadingState label="Validating your invitation…" />;

  if (loadError || !metadata) {
    return (
      <AuthSplit
        eyebrow="Staff invitation"
        title="This invitation cannot be used"
        description={loadError || "The link is invalid or has expired."}
        footer={
          <Link href="/login" className="text-sm font-semibold text-primary hover:underline">
            Back to sign in
          </Link>
        }
      >
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <p className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Invitation links are single-use and expire after 48 hours. Contact the college administrator who invited
            you to issue a new link.
          </p>
        </div>
      </AuthSplit>
    );
  }

  if (metadata.status !== "VALID") {
    const messages = {
      EXPIRED: "This invitation has expired. Ask your college administrator for a new link.",
      ACCEPTED: "This invitation has already been used. Sign in with the account you activated.",
      REVOKED: "This invitation was revoked by the college administrator.",
    };
    return (
      <AuthSplit
        eyebrow="Staff invitation"
        title="This invitation is no longer valid"
        description={`${metadata.institutionName} · ${metadata.maskedEmail}`}
        footer={
          <Link href="/login" className="text-sm font-semibold text-primary hover:underline">
            Back to sign in
          </Link>
        }
      >
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <p className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {messages[metadata.status] || "This invitation cannot be used."}
          </p>
        </div>
      </AuthSplit>
    );
  }

  return (
    <AuthSplit
      eyebrow="Staff invitation"
      title={`Join ${metadata.institutionName}`}
      description={`${designationLabel(metadata.designation)} · ${metadata.scopeLabel}`}
      footer={
        <Link href="/login" className="text-sm font-semibold text-primary hover:underline">
          Already activated? Sign in
        </Link>
      }
    >
      <div className="mb-5 rounded-xl border border-border/60 bg-muted/40 p-3 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
          {metadata.maskedEmail}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Expires {formatDateTime(metadata.expiresAt)}. The invitation email is partially hidden so this page never
          reveals whether an account already exists.
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={submit} className="space-y-3.5">
        <Field id="invite-full-name" label="Full name" hint="Required only when activating a new account.">
          {(inputId) => (
            <Input
              id={inputId}
              value={form.fullName}
              onChange={(event) => update("fullName", event.target.value)}
              autoComplete="name"
              maxLength={120}
            />
          )}
        </Field>

        <Field id="invite-password" label="Password" required error={fieldErrors.password}>
          {(inputId) => (
            <div className="relative">
              <Input
                id={inputId}
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(event) => update("password", event.target.value)}
                autoComplete="new-password"
                className="pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          )}
        </Field>

        <Field id="invite-confirm" label="Confirm password" required error={fieldErrors.confirm}>
          {(inputId) => (
            <Input
              id={inputId}
              type={showPassword ? "text" : "password"}
              value={form.confirm}
              onChange={(event) => update("confirm", event.target.value)}
              autoComplete="new-password"
              required
            />
          )}
        </Field>

        <div>
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={form.termsAccepted}
              onChange={(event) => update("termsAccepted", event.target.checked)}
              className="mt-0.5 size-4 accent-green-700"
            />
            <span>
              I accept the{" "}
              <Link href="/legal/terms" className="font-medium text-primary hover:underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/legal/privacy" className="font-medium text-primary hover:underline">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
          {fieldErrors.termsAccepted && (
            <p className="mt-1 text-xs text-destructive" role="alert">
              {fieldErrors.termsAccepted}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <BadgeCheck className="size-4" aria-hidden="true" />}
          {submitting ? "Activating…" : "Activate staff account"}
        </Button>
      </form>

      <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground">
        If an account already exists for the invited email, the password you enter must match it. Possession of this
        link alone cannot take over an existing account.
      </p>
    </AuthSplit>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading invitation…" />}>
      <InvitationContent />
    </Suspense>
  );
}
