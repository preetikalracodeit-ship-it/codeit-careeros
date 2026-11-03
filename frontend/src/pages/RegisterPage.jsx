import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GoogleSignInButton } from "../components/auth/GoogleSignInButton.jsx";
import { Logo } from "../components/Logo.jsx";
import api from "../lib/api.js";
import { auth } from "../lib/auth.js";
import { Icon } from "../components/Icon.jsx";

const MOBILE_PATTERN = /^[6-9][0-9]{9}$/;

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: "", email: "", mobile: "", password: "", collegeId: "" });
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [colleges, setColleges] = useState([]);

  useEffect(() => {
    let cancelled = false;
    api.get("/auth/colleges")
      .then((data) => { if (!cancelled) setColleges(data || []); })
      .catch(() => {})
      .finally(() => { if (!cancelled) cancelled = true; });
    return () => { cancelled = true; };
  }, []);

  const update = (event) => {
    const { name, value } = event.target;
    const normalized = name === "mobile"
      ? value.replace(/\D/g, "").slice(0, 10)
      : name === "collegeId"
        ? value ? Number(value) : ""
        : value;
    setForm((current) => ({ ...current, [name]: normalized }));
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
    if (!form.collegeId) nextErrors.collegeId = "Please select your college.";
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
        collegeId: form.collegeId,
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

  return <main className="auth-layout">
    <section className="auth-art">
      <div className="auth-mark auth-mark-logo"><Logo size={38} /></div>
      <p className="eyebrow">FREE STUDENT ACCOUNT</p>
      <h1>Start your career journey.</h1>
      <p>Create a free account to assess your skills, close the gaps that matter and prove you&apos;re ready for your target role.</p>
    </section>
    <section className="auth-panel">
      <div className="auth-card">
        <p className="eyebrow">CREATE YOUR ACCOUNT</p>
        <h2>Create your account</h2>
        <p className="muted">College staff accounts are activated by invitation. This form creates a student account.</p>
        <form onSubmit={submit} noValidate>
          {error && <div className="error-banner" role="alert">{error} {error.includes("already exists") && <Link to="/login">Sign in</Link>}</div>}
          <label>Full name<input name="fullName" autoComplete="name" maxLength={120} required placeholder="Rahul Sharma" value={form.fullName} onChange={update} aria-invalid={Boolean(errors.fullName)} />{errors.fullName && <span className="form-error">{errors.fullName}</span>}</label>
          <label>Email<input name="email" type="email" autoComplete="email" maxLength={190} required placeholder="you@college.edu" value={form.email} onChange={update} aria-invalid={Boolean(errors.email)} />{errors.email && <span className="form-error">{errors.email}</span>}</label>
          <label>Mobile<input name="mobile" type="tel" inputMode="numeric" autoComplete="tel" maxLength={10} required placeholder="9876543210" value={form.mobile} onChange={update} aria-invalid={Boolean(errors.mobile)} />{errors.mobile && <span className="form-error">{errors.mobile}</span>}</label>
          <label>Password
            <div className="auth-password-field">
              <input name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" required placeholder="8+ characters, letters & numbers" value={form.password} onChange={update} aria-invalid={Boolean(errors.password)} />
              <button type="button" className="auth-password-toggle" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
                <Icon name={showPassword ? "eye-off" : "eye"} size={18} />
              </button>
            </div>
            {errors.password && <span className="form-error">{errors.password}</span>}
          </label>
          <label className="checkbox-row"><input type="checkbox" checked={termsAccepted} onChange={(event) => { setTermsAccepted(event.target.checked); if (errors.termsAccepted) setErrors((current) => ({ ...current, termsAccepted: undefined })); }} /><span>I agree to the <Link to="/legal/terms" target="_blank" rel="noreferrer">Terms</Link> and <Link to="/legal/privacy" target="_blank" rel="noreferrer">Privacy Policy</Link>.</span></label>
          {errors.termsAccepted && <p className="form-error" role="alert">{errors.termsAccepted}</p>}
          <label className="form-field">
            <span className="form-label">College</span>
            <select name="collegeId" value={form.collegeId ?? ""} onChange={update} aria-invalid={Boolean(errors.collegeId)}>
              <option value="">Select your college</option>
              {colleges.map((college) => <option key={college.id} value={college.id}>{college.name}</option>)}
            </select>
            {errors.collegeId && <span className="form-error">{errors.collegeId}</span>}
          </label>
          <button className="primary-button" disabled={busy}>{busy ? "Creating account…" : "Create free account"}</button>
          <GoogleSignInButton mode="signup" termsAccepted={termsAccepted} disabled={!termsAccepted} onError={setError} collegeId={form.collegeId ?? undefined} />
        </form>

        <p className="muted footnote">Already have an account? <Link to="/login">Sign in</Link></p>
      </div>
    </section>
  </main>;
}
