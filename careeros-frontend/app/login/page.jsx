"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AuthSplit } from "@/components/auth/auth-split";
import { Field } from "@/components/field";
import api from "@/lib/api";
import { auth } from "@/lib/auth";
import { homeForRole } from "@/lib/roles";
import { GoogleSignInButton } from "@/components/auth/google-signin";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (fieldErrors[e.target.name]) {
      setFieldErrors((prev) => ({ ...prev, [e.target.name]: undefined }));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setLoading(true);
    try {
      const data = await api.post("/auth/login", form);
      auth.save(data);
      router.replace(homeForRole(data.user?.role));
    } catch (err) {
      if (err.fieldErrors?.length) {
        const mapped = {};
        err.fieldErrors.forEach((fe) => {
          mapped[fe.field] = fe.message;
        });
        setFieldErrors(mapped);
        setError(err.message || "Please check the form and try again.");
      } else if (err.status === 401) {
        setError(
          "Invalid email or password. Check for typos (especially in your email), or create a student account below.",
        );
      } else {
        setError(err.message || "Login failed. Check your email and password.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthSplit
      title="Welcome back"
      description="Sign in to continue your career journey."
      footer={
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            New to CareerOS?{" "}
            <Link href="/register" className="font-semibold text-chart-1 hover:underline">
              Create a student account
            </Link>
          </p>
          <p className="text-xs leading-relaxed">
            College staff and administrators sign in here too. Staff accounts are activated from the one-time
            invitation link issued by a college administrator.{" "}
            <Link href="/accept-invitation" className="font-semibold text-foreground underline underline-offset-2">
              Activate an invitation
            </Link>
          </p>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Field id="email" label="Email" required error={fieldErrors.email}>
          {(inputId) => (
            <Input
              id={inputId}
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@college.edu"
              className="h-10 px-3"
              value={form.email}
              onChange={handleChange}
              aria-invalid={Boolean(fieldErrors.email)}
            />
          )}
        </Field>

        <Field id="password" label="Password" required error={fieldErrors.password}>
          {(inputId) => (
            <div className="relative">
              <Input
                id={inputId}
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                className="h-10 px-3 pr-10"
                value={form.password}
                onChange={handleChange}
                aria-invalid={Boolean(fieldErrors.password)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
              </button>
            </div>
          )}
        </Field>

        <Button type="submit" size="lg" className="w-full text-base" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </Button>

        <GoogleSignInButton mode="signin" onError={setError} />

        <p className="text-center text-xs text-muted-foreground sm:hidden">
          New to CareerOS?{" "}
          <Link href="/register" className="font-semibold text-chart-1 hover:underline">
            Create an account
          </Link>
        </p>
      </form>
    </AuthSplit>
  );
}