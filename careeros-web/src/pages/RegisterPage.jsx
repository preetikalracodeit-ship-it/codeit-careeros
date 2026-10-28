import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import GoogleSignInButton from "../components/GoogleSignInButton.jsx";
import api from "../lib/api.js";
import { auth } from "../lib/auth.js";

const MOBILE_PATTERN = /^[6-9][0-9]{9}$/;

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: "", email: "", mobile: "", password: "" });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (event) => {
    const { name } = event.target;
    const value = name === "mobile" ? event.target.value.replace(/\D/g, "").slice(0, 10) : event.target.value;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!form.fullName.trim()) nextErrors.fullName = "Enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) nextErrors.email = "Enter a valid email address.";
    if (!MOBILE_PATTERN.test(form.mobile)) nextErrors.mobile = "Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9.";
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password)) nextErrors.password = "Use at least 8 characters with letters and numbers.";
    if (!termsAccepted) nextErrors.termsAccepted = "Accept the Terms and Privacy Policy to create your account.";
    setErrors(nextErrors);
    setError("");
    if (Object.keys(nextErrors).length) return;

    setBusy(true);
    try {
      const result = await api.post("/auth/register", {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        mobile: form.mobile,
        password: form.password,
        termsAccepted,
      }, { skipAuth: true });
      auth.save(result);
      navigate("/student/dashboard", { replace: true });
    } catch (requestError) {
      const fieldErrors = Object.fromEntries((requestError.fieldErrors || []).map(({ field, message }) => [field, message]));
      setErrors(fieldErrors);
      setError(requestError.errorCode === "CONFLICT"
        ? "An account with this email already exists. Sign in instead."
        : requestError.message || "Registration failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return <main className="auth-layout"><section className="auth-card register-card">
    <div className="brand auth-brand"><span className="brand-mark">C</span><span>CareerOS</span></div>
    <p className="eyebrow">FREE STUDENT ACCOUNT</p><h1>Create your account</h1>
    <p className="muted">College staff accounts are activated by invitation. This form creates a student account.</p>
    {error && <p className="form-error" role="alert">{error} {error.includes("already exists") && <Link to="/login">Sign in</Link>}</p>}
    <form className="form-stack" onSubmit={submit} noValidate>
      <label>Full name<input name="fullName" autoComplete="name" maxLength={120} required value={form.fullName} onChange={update} aria-invalid={Boolean(errors.fullName)} />{errors.fullName && <span className="form-error">{errors.fullName}</span>}</label>
      <div className="form-grid">
        <label>Email<input name="email" type="email" autoComplete="email" maxLength={190} required value={form.email} onChange={update} aria-invalid={Boolean(errors.email)} />{errors.email && <span className="form-error">{errors.email}</span>}</label>
        <label>Mobile<input name="mobile" type="tel" inputMode="numeric" autoComplete="tel" maxLength={10} required value={form.mobile} onChange={update} aria-invalid={Boolean(errors.mobile)} />{errors.mobile && <span className="form-error">{errors.mobile}</span>}</label>
      </div>
      <label>Password<input name="password" type="password" autoComplete="new-password" required value={form.password} onChange={update} aria-invalid={Boolean(errors.password)} />{errors.password && <span className="form-error">{errors.password}</span>}</label>
      <label className="checkbox-row"><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} /><span>I agree to the <Link to="/legal/terms" target="_blank" rel="noreferrer">Terms</Link> and <Link to="/legal/privacy" target="_blank" rel="noreferrer">Privacy Policy</Link>.</span></label>
      {errors.termsAccepted && <p className="form-error" role="alert">{errors.termsAccepted}</p>}
      <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Creating account…" : "Create free account"}<ArrowRight size={16}/></button>
    </form>
    <GoogleSignInButton mode="signup" />
    <p className="auth-footnote">Already have an account? <Link to="/login">Sign in</Link></p>
  </section></main>;
}
