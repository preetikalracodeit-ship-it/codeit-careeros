import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { auth, homeForRole } from "../lib/auth.js";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const session = await api.post("/auth/login", { email, password }, { skipAuth: true });
      auth.save(session);
      navigate(location.state?.from?.pathname || homeForRole(session.user?.role), { replace: true });
    } catch (reason) {
      setError(reason.message || "Unable to sign in. Check your email and password.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-layout"><section className="auth-art"><div className="auth-mark">C</div><p className="eyebrow">YOUR CAREER JOURNEY</p><h1>Turn your potential into a plan.</h1><p>Build skills, track progress, and move toward the career you want.</p></section><section className="auth-panel"><div className="auth-card"><p className="eyebrow">WELCOME BACK</p><h2>Sign in to CareerOS</h2><p className="muted">Continue your career journey.</p><form onSubmit={submit}>
    {error && <div className="error-banner" role="alert">{error}</div>}
    <label>Email<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@college.edu" /></label>
    <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" /></label>
    <div className="login-forgot"><Link to="/forgot-password">Forgot password?</Link></div>
    <button className="primary-button" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form><p className="muted footnote">New to CareerOS? <Link to="/register">Create a student account</Link></p><p className="muted footnote">College staff? <Link to="/accept-invitation">Activate an invitation</Link></p></div></section></main>;
}
