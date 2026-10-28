import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import api from "../lib/api.js";
import { auth, homeForRole } from "../lib/auth.js";

export default function InvitationPage() {
  const location = useLocation(); const navigate = useNavigate();
  const token = new URLSearchParams(location.search).get("token") || "";
  const [invitation, setInvitation] = useState(null); const [fullName, setFullName] = useState(""); const [password, setPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false); const [loading, setLoading] = useState(Boolean(token)); const [busy, setBusy] = useState(false); const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!token) { setLoading(false); setError("This invitation link is missing its token."); return () => { active = false; }; }
    api.get(`/invitations/${encodeURIComponent(token)}`, { skipAuth: true })
      .then((data) => { if (active) setInvitation(data); })
      .catch((requestError) => { if (active) setError(requestError.message || "This invitation could not be found."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  const accept = async (event) => {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const result = await api.post(`/invitations/${encodeURIComponent(token)}/accept`, { fullName: fullName.trim(), password, termsAccepted }, { skipAuth: true });
      auth.save(result); navigate(homeForRole(result.user?.role), { replace: true });
    } catch (requestError) { setError(requestError.message || "Could not accept this invitation."); }
    finally { setBusy(false); }
  };

  if (loading) return <main className="auth-layout"><section className="auth-card" role="status">Checking your invitation…</section></main>;
  const valid = invitation?.status === "VALID";
  return <main className="auth-layout"><section className="auth-card">
    <div className="brand auth-brand"><span className="brand-mark">C</span><span>CareerOS</span></div>
    <p className="eyebrow">STAFF INVITATION</p>
    <h1>{valid ? "Activate your staff account" : invitation ? "This invitation is unavailable" : "Invitation link unavailable"}</h1>
    {invitation && <div className="invitation-summary"><p>You’re invited to join <strong>{invitation.institutionName}</strong>.</p><dl><div><dt>Invited email</dt><dd>{invitation.maskedEmail}</dd></div><div><dt>Role</dt><dd>{invitation.designation?.toLowerCase().replaceAll("_", " ")}</dd></div><div><dt>Access scope</dt><dd>{invitation.scopeLabel}</dd></div><div><dt>Status</dt><dd>{invitation.status?.toLowerCase()}</dd></div></dl></div>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {valid ? <form className="form-stack" onSubmit={accept}>
      <label>Full name<input autoComplete="name" maxLength={120} required value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
      <label>Password<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /><small className="field-hint">At least 8 characters, including letters and numbers. Existing accounts must enter their current password.</small></label>
      <label className="checkbox-row"><input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} required /><span>I accept the <Link to="/legal/terms" target="_blank" rel="noreferrer">Terms of Service</Link> and <Link to="/legal/privacy" target="_blank" rel="noreferrer">Privacy Policy</Link>.</span></label>
      <button className="button button-primary" type="submit" disabled={busy || !termsAccepted}>{busy ? "Activating…" : "Activate account"}<ArrowRight size={16}/></button>
    </form> : <p className="muted">Ask your institution administrator for a new invitation if this one has expired, been revoked, or has already been used.</p>}
    <p className="auth-footnote">Already have an account? Use the email address this invitation was sent to and your existing password. <Link to="/login">Sign in</Link></p>
  </section></main>;
}
