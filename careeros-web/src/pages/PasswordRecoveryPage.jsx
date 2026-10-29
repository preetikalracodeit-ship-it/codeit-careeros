import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../lib/api.js";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resetUrl, setResetUrl] = useState("");
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(""); setMessage(""); setResetUrl("");
    try {
      const result = await api.post("/auth/forgot-password", { email }, { skipAuth: true });
      setMessage(result.message);
      if (result.resetToken) setResetUrl(`${window.location.origin}/reset-password?token=${encodeURIComponent(result.resetToken)}`);
    } catch (reason) { setError(reason.message || "Unable to start password recovery."); }
    finally { setBusy(false); }
  }
  return <main className="auth-layout"><section className="auth-art"><div className="auth-mark">C</div><p className="eyebrow">ACCOUNT RECOVERY</p><h1>A fresh start is one link away.</h1><p>Enter your account email and we’ll help you reset your password.</p></section><section className="auth-panel"><div className="auth-card"><p className="eyebrow">FORGOT PASSWORD</p><h2>Reset your password</h2><p className="muted">We’ll prepare a secure, one-time reset link for your account.</p><form onSubmit={submit}>{error && <div className="error-banner" role="alert">{error}</div>}{message && <div className="success-banner" role="status">{message}{resetUrl && <p><Link to={resetUrl.replace(window.location.origin, "")}>Open your reset link</Link></p>}</div>}<label>Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@college.edu" /></label><button className="primary-button" disabled={busy}>{busy ? "Preparing link…" : "Send reset link"}</button></form><p className="muted footnote"><Link to="/login">Back to sign in</Link></p></div></section></main>;
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  async function submit(event) {
    event.preventDefault(); setError("");
    if (password !== confirmation) { setError("The passwords do not match."); return; }
    setBusy(true);
    try { await api.post("/auth/reset-password", { token, newPassword: password }, { skipAuth: true }); setDone(true); }
    catch (reason) { setError(reason.message || "This reset link is invalid or expired."); }
    finally { setBusy(false); }
  }
  return <main className="auth-layout"><section className="auth-art"><div className="auth-mark">C</div><p className="eyebrow">SECURE YOUR ACCOUNT</p><h1>Choose a new password.</h1><p>Your password must be at least eight characters and include letters and numbers.</p></section><section className="auth-panel"><div className="auth-card"><p className="eyebrow">NEW PASSWORD</p><h2>{done ? "Password updated" : "Create a new password"}</h2>{done ? <><p className="success-banner" role="status">Your password has been updated. Sign in with your new password.</p><Link className="primary-button login-cta" to="/login">Go to sign in</Link></> : <form onSubmit={submit}>{error && <div className="error-banner" role="alert">{error}</div>}{!token && <div className="error-banner" role="alert">This reset link is missing its token. Request a new link.</div>}<label>New password<input type="password" autoComplete="new-password" minLength="8" required value={password} onChange={(event) => setPassword(event.target.value)} /></label><label>Confirm password<input type="password" autoComplete="new-password" minLength="8" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label><button className="primary-button" disabled={busy || !token}>{busy ? "Updating…" : "Update password"}</button></form>}<p className="muted footnote"><Link to="/login">Back to sign in</Link></p></div></section></main>;
}
