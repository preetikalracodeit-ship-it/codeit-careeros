"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, BadgeCheck, Check, Eye, EyeOff, Loader2, LockKeyhole, Mail, Phone, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthSplit } from "@/components/auth/auth-split";
import { Field } from "@/components/field";
import api from "@/lib/api";
import { auth } from "@/lib/auth";
import { GoogleSignInButton } from "@/components/auth/google-signin";
import { cn } from "cn";

function passwordScore(password) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

const strengthLabels = ["", "Weak", "Fair", "Strong", "Excellent"];
const strengthBar = ["bg-transparent", "bg-destructive/70", "bg-chart-2", "bg-chart-3", "bg-brand-500"];
const strengthText = ["text-muted-foreground", "text-destructive", "text-chart-2", "text-chart-3", "text-brand-700 dark:text-brand-300"];

const inputShell = (hasError) =>
  cn(
    "h-11 rounded-xl border bg-background pl-10 text-[15px] shadow-sm transition-all duration-200",
    "placeholder:text-muted-foreground/55 hover:border-foreground/25",
    "focus-visible:border-brand-500 focus-visible:ring-4 focus-visible:ring-brand-500/15 focus-visible:outline-none",
    hasError && "border-destructive/60 bg-destructive/[0.03] focus-visible:border-destructive focus-visible:ring-destructive/15",
  );

// Indian mobile numbers: exactly 10 digits, starting with 6, 7, 8 or 9.
const MOBILE_PATTERN = /^[6-9][0-9]{9}$/;
const MOBILE_ERROR = "Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ fullName: "", email: "", mobile: "", password: "" });
  const [agreed, setAgreed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const score = passwordScore(form.password);

  function validate() {
    const errors = {};
    if (!form.fullName.trim()) errors.fullName = "Please enter your full name";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = "Enter a valid email address";
    if (!form.mobile.trim()) errors.mobile = "Mobile number is required";
    else if (!MOBILE_PATTERN.test(form.mobile.trim())) errors.mobile = MOBILE_ERROR;
    if (!form.password) errors.password = "Create a password to continue";
    else if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password))
      errors.password = "Use 8+ characters with both letters and digits";
    if (!agreed) errors.agreed = "Please accept the Terms to create your account";
    return errors;
  }

  function handleChange(e) {
    const { name } = e.target;
    let value = e.target.value;
    if (name === "mobile") {
      // Numeric-friendly: strip non-digits and cap at 10 digits (enforced
      // here, not just via maxLength, so pastes are sanitized too).
      value = value.replace(/\D/g, "").slice(0, 10);
    }
    setForm({ ...form, [name]: value });
    if (fieldErrors[name]) {
      // Re-validate while typing; an emptied field shows no error until submit.
      if (name === "mobile") {
        if (!value.trim() || MOBILE_PATTERN.test(value.trim())) {
          setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
        } else {
          setFieldErrors((prev) => ({ ...prev, [name]: MOBILE_ERROR }));
        }
      } else {
        setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const errors = validate();
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setLoading(true);
    try {
      const data = await api.post("/auth/register", {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        mobile: form.mobile.trim(),
        password: form.password,
        termsAccepted: true,
      });
      auth.save(data);
      router.replace("/student/dashboard");
    } catch (err) {
      if (err.errorCode === "CONFLICT") {
        setError(
          "An account with this email already exists. Double-check the spelling, or sign in instead.",
        );
      } else if (err.fieldErrors?.length) {
        const mapped = {};
        err.fieldErrors.forEach((fe) => {
          mapped[fe.field] = fe.message;
        });
        setFieldErrors(mapped);
        setError(err.message || "Please check the form and try again.");
      } else {
        setError(err.message || "Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthSplit
      eyebrow="Free student account"
      title="Create your account"
      footer={
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-brand-700 underline-offset-4 hover:underline dark:text-brand-300">
              Sign in
            </Link>
          </p>
          <p className="text-xs leading-relaxed">
            This form creates a student account. College staff accounts are created only by invitation from a college
            administrator; platform administrator accounts are provisioned by CODEIT.
          </p>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {error && (
          <Alert variant="destructive" className="anim-hero-rise rounded-xl border-destructive/30 bg-destructive/[0.06] px-3.5 py-3" style={{ "--d": "0.05s" }}>
            <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
            <AlertDescription className="text-[13px] leading-relaxed text-destructive">
              {error}{" "}
              {error.includes("already exists") && (
                <Link href="/login" className="font-semibold underline underline-offset-2">
                  Sign in
                </Link>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="anim-hero-rise space-y-4" style={{ "--d": "0.08s" }}>
          <Field id="fullName" label="Full name" required error={fieldErrors.fullName}>
            {(inputId) => (
              <div className="relative">
                <User className={cn("pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2", fieldErrors.fullName ? "text-destructive/70" : "text-muted-foreground")} aria-hidden="true" />
                <Input id={inputId} name="fullName" autoComplete="name" placeholder="Rahul Sharma" className={inputShell(fieldErrors.fullName)} value={form.fullName} onChange={handleChange} aria-invalid={Boolean(fieldErrors.fullName)} />
                {form.fullName.trim().length > 1 && !fieldErrors.fullName && (
                  <BadgeCheck className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-brand-600" aria-hidden="true" />
                )}
              </div>
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="email" label="Email" required error={fieldErrors.email}>
              {(inputId) => (
                <div className="relative">
                  <Mail className={cn("pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2", fieldErrors.email ? "text-destructive/70" : "text-muted-foreground")} aria-hidden="true" />
                  <Input id={inputId} name="email" type="email" autoComplete="email" placeholder="you@college.edu" className={inputShell(fieldErrors.email)} value={form.email} onChange={handleChange} aria-invalid={Boolean(fieldErrors.email)} />
                </div>
              )}
            </Field>

            <Field id="mobile" label="Mobile" required error={fieldErrors.mobile}>
              {(inputId) => (
                <div className="relative">
                  <Phone className={cn("pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2", fieldErrors.mobile ? "text-destructive/70" : "text-muted-foreground")} aria-hidden="true" />
                  <Input id={inputId} name="mobile" type="tel" autoComplete="tel" inputMode="numeric" pattern="[6-9][0-9]{9}" maxLength={10} placeholder="9876543210" className={inputShell(fieldErrors.mobile)} value={form.mobile} onChange={handleChange} aria-invalid={Boolean(fieldErrors.mobile)} />
                </div>
              )}
            </Field>
          </div>

          <Field id="password" label="Password" required error={fieldErrors.password}>
            {(inputId) => (
              <div className="relative">
                <LockKeyhole className={cn("pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2", fieldErrors.password ? "text-destructive/70" : "text-muted-foreground")} aria-hidden="true" />
                <Input id={inputId} name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="8+ characters, letters & numbers" className={cn(inputShell(fieldErrors.password), "pr-10")} value={form.password} onChange={handleChange} aria-invalid={Boolean(fieldErrors.password)} />
                <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground">
                  {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                </button>
              </div>
            )}
          </Field>
          {/* slim inline strength hint */}
          <div className="-mt-2 flex items-center gap-2" role="status" aria-label={form.password ? `Password strength: ${strengthLabels[score]}` : "Password hint"}>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-border/60" aria-hidden="true">
              <div
                className={cn("h-full rounded-full transition-all duration-300", form.password ? strengthBar[score] : "bg-transparent")}
                style={{ width: form.password ? `${Math.max(12, (score / 4) * 100)}%` : "0%" }}
              />
            </div>
            <span className={cn("inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold", form.password ? strengthText[score] : "text-muted-foreground")}>
              {form.password && score >= 3 && <Check className="size-3" strokeWidth={3.5} aria-hidden="true" />}
              {form.password ? strengthLabels[score] : "8+ characters, letters & numbers"}
            </span>
          </div>
        </div>

        <div className="anim-hero-rise" style={{ "--d": "0.12s" }}>
          <label className={cn("flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left transition-colors", fieldErrors.agreed ? "border-destructive/50 bg-destructive/[0.04]" : "border-border/60 hover:border-foreground/20")}>
            <input type="checkbox" checked={agreed} onChange={(e) => { setAgreed(e.target.checked); if (fieldErrors.agreed) setFieldErrors((p) => ({ ...p, agreed: undefined })); }} className="size-4 shrink-0 cursor-pointer accent-green-700" aria-invalid={Boolean(fieldErrors.agreed)} />
            <span className="text-[13px] leading-snug text-muted-foreground">
              I agree to the{" "}
              <Link href="/legal/terms" target="_blank" className="font-semibold text-foreground underline underline-offset-2 hover:text-brand-700">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/legal/privacy" target="_blank" className="font-semibold text-foreground underline underline-offset-2 hover:text-brand-700">
                Privacy Policy
              </Link>
            </span>
          </label>
          {fieldErrors.agreed && <p className="mt-1.5 text-xs text-destructive" role="alert">{fieldErrors.agreed}</p>}
        </div>

        <div className="anim-hero-rise" style={{ "--d": "0.16s" }}>
          <Button type="submit" size="lg" disabled={loading} className="btn-polish h-12 w-full rounded-xl bg-gradient-to-r from-brand-800 via-brand-700 to-brand-600 text-[15px] font-semibold text-white shadow-lg shadow-brand-900/20 hover:from-brand-700 hover:via-brand-600 hover:to-brand-500 hover:shadow-xl hover:shadow-brand-900/25 disabled:opacity-70 disabled:shadow-none">
            {loading ? (<><Loader2 className="size-4 animate-spin" aria-hidden="true" />Creating your account…</>) : (<>Create free account<ArrowRight className="size-4 transition-transform group-hover/button:translate-x-0.5" aria-hidden="true" /></>)}
          </Button>
        </div>

        <GoogleSignInButton
          mode="signup"
          onError={setError}
        />

        <p className="text-center text-xs text-muted-foreground sm:hidden">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">
            Sign in
          </Link>
        </p>
      </form>
    </AuthSplit>
  );
}
