import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { auth, homeForRole } from "../lib/auth.js";
import { GoogleSignInButton } from "../components/auth/GoogleSignInButton.jsx";
import { Logo } from "../components/Logo.jsx";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "../lib/roles.js";
import { Icon } from "../components/Icon.jsx";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

  function useDemo(account) {
    setEmail(account.email);
    setPassword(DEMO_PASSWORD);
    setError("");
  }

  return <main className="auth-layout"><section className="auth-art"><div className="auth-mark auth-mark-logo"><Logo size={38} /></div><p className="eyebrow">YOUR CAREER JOURNEY</p><h1>One platform. Every campus role.</h1><p>Platform administrators, college teams, placement officers, faculty, and students each get a focused workspace built around their responsibilities.</p></section><section className="auth-panel"><div className="auth-card"><p className="eyebrow">WELCOME BACK</p><h2>Sign in to CareerOS</h2><p className="muted">Continue in your role-based workspace.</p><form onSubmit={submit}>
    {error && <div className="error-banner" role="alert">{error}</div>}
    <label>Email<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@college.edu" /></label>
    <label>Password
      <div className="auth-password-field">
        <input type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" />
        <button type="button" className="auth-password-toggle" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
          <Icon name={showPassword ? "eye-off" : "eye"} size={18} />
        </button>
      </div>
    </label>
    <div className="login-forgot"><Link to="/forgot-password">Forgot password?</Link></div>
    <button className="primary-button" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    <GoogleSignInButton onError={setError} />
    </form>

    <div className="demo-access">
      <div className="demo-access-heading">
        <strong>Demo accounts</strong>
        <span>Password: <code>{DEMO_PASSWORD}</code></span>
      </div>
      <div className="demo-grid">
        {DEMO_ACCOUNTS.map((account) => (
          <button key={account.role} type="button" className="demo-account" onClick={() => useDemo(account)}>
            <span>{account.label}</span>
            <small>{account.email}</small>
          </button>
        ))}
      </div>
    </div>
    <p className="muted footnote">New to CareerOS? <Link to="/register">Create a student account</Link></p><p className="muted footnote">College staff? <Link to="/accept-invitation">Activate an invitation</Link></p></div></section></main>;
}
