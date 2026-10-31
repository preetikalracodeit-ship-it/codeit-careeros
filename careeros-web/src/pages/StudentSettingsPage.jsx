import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../lib/api.js";
import { auth } from "../lib/auth.js";

function dateLabel(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export function StudentSettingsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [revokingSessions, setRevokingSessions] = useState(false);
  const [clearingAi, setClearingAi] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setSettings(await api.get("/settings/me"));
    } catch (reason) {
      setError(reason.message || "Unable to load your settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function changePassword(event) {
    event.preventDefault();
    if (newPassword !== confirmPassword) return toast.error("New passwords do not match.");
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) return toast.error("Use at least 8 characters, including a letter and a number.");
    if (newPassword === currentPassword) return toast.error("Choose a new password different from the current one.");
    setChangingPassword(true);
    try {
      await api.put("/users/me/password", { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed. Other sessions have been revoked.");
      await load();
    } catch (reason) {
      toast.error(reason.message || "Unable to change your password.");
    } finally {
      setChangingPassword(false);
    }
  }

  async function revokeSessions() {
    setRevokingSessions(true);
    try {
      const result = await api.post("/users/me/sessions/revoke-all", {});
      toast.success(`Revoked ${result?.revokedSessions ?? 0} active session(s).`);
      await load();
    } catch (reason) {
      toast.error(reason.message || "Unable to revoke sessions.");
    } finally {
      setRevokingSessions(false);
    }
  }

  async function clearAiHistory() {
    setClearingAi(true);
    try {
      const result = await api.delete("/settings/me/ai-history");
      toast.success(`Cleared ${result?.deletedSessions ?? 0} AI conversation(s).`);
      await load();
    } catch (reason) {
      toast.error(reason.message || "Unable to clear your AI history.");
    } finally {
      setClearingAi(false);
    }
  }

  async function logout() {
    setLoggingOut(true);
    try {
      const refreshToken = auth.getRefreshToken();
      await api.post("/auth/logout", refreshToken ? { refreshToken } : {}).catch(() => null);
    } finally {
      auth.clear();
      navigate("/login", { replace: true });
    }
  }

  if (loading) return <main className="workspace-page"><div className="notice-card" role="status">Loading account settings…</div></main>;
  if (error || !settings) return <main className="workspace-page"><header className="workspace-heading"><div><span className="eyebrow">ACCOUNT SETTINGS</span><h1>Couldn’t load your settings.</h1><p className="muted">{error || "No account settings were returned."}</p></div></header><button className="secondary-button" onClick={load}>Try again</button></main>;

  const account = settings.account || {};
  const profile = settings.profile || {};
  return <main className="workspace-page settings-page">
    <header className="workspace-heading"><div><span className="eyebrow">ACCOUNT SETTINGS</span><h1>Settings</h1><p className="muted">Manage your account, career preference, password, and active sessions.</p></div><Link className="secondary-button" to="/student/dashboard">Dashboard</Link></header>

    <section className="settings-card"><div className="settings-section-heading"><span className="settings-icon" aria-hidden="true">◎</span><div><h2>Account</h2><p>Your sign-in identity. Email and role can’t be changed here.</p></div></div><dl className="settings-account-grid"><div><dt>Email</dt><dd>{account.email || "—"}</dd></div><div><dt>Role</dt><dd>{account.role || "STUDENT"}</dd></div><div><dt>Full name</dt><dd>{account.fullName || profile.fullName || "—"}</dd></div><div><dt>Member since</dt><dd>{dateLabel(account.createdAt)}</dd></div></dl></section>

    <section className="settings-card"><div className="settings-section-heading"><span className="settings-icon" aria-hidden="true">◉</span><div><h2>Profile</h2><p>Personal, education, and career links.</p></div></div><div className="settings-summary-row"><div className="settings-avatar">{(profile.fullName || account.fullName || account.email || "U").split(/[\s@._]+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase()}</div><div><strong>{profile.fullName || "Your profile"}</strong><p>{[profile.college, profile.degree, profile.location].filter(Boolean).join(" · ") || "Complete your profile to personalize CareerOS."}</p></div><Link className="secondary-button" to="/student/profile">Edit profile</Link></div></section>

    <section className="settings-card"><div className="settings-section-heading"><span className="settings-icon" aria-hidden="true">⌖</span><div><h2>Career preference</h2><p>Your target career guides your assessments and skill progress.</p></div></div><div className="settings-summary-row career-preference-row"><div><strong>{profile.targetCareerName || "No target career selected"}</strong><p>Changing your target keeps your previous assessment history.</p></div><Link className="secondary-button" to="/student/careers">{profile.targetCareerName ? "Change career" : "Choose career"}</Link></div></section>

    <section className="settings-card"><div className="settings-section-heading"><span className="settings-icon" aria-hidden="true">▣</span><div><h2>Security</h2><p>Change your password or revoke sessions from other devices.</p></div></div><form className="settings-password-form" onSubmit={changePassword}><label className="profile-field">Current password<input type="password" autoComplete="current-password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label><label className="profile-field">New password<input type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><small>At least 8 characters, with a letter and a number.</small></label><label className="profile-field">Confirm new password<input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label><div className="settings-password-submit"><button className="primary-button" type="submit" disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}>{changingPassword ? "Updating…" : "Change password"}</button><p>A successful password change revokes all refresh-token sessions.</p></div></form><div className="settings-session-row"><div><strong>{settings.activeSessions ?? 0} active session(s)</strong><p>Revoking sessions signs out every device when its access token expires.</p></div><button className="secondary-button" disabled={revokingSessions} onClick={revokeSessions}>{revokingSessions ? "Revoking…" : "Log out all sessions"}</button><button className="text-button" disabled={loggingOut} onClick={logout}>{loggingOut ? "Signing out…" : "Log out"}</button></div></section>

    <section className="settings-card"><div className="settings-section-heading"><span className="settings-icon" aria-hidden="true">✦</span><div><h2>AI assistant history</h2><p>Conversations with the career assistant are private to your account.</p></div></div><div className="settings-session-row"><div><strong>{settings.aiConversations ?? 0} saved AI conversation(s)</strong><p>{settings.aiStatus?.mode === "offline-smart" ? "The assistant is running in offline-smart mode using your saved CareerOS data." : "The assistant uses your saved profile, assessments and career data."} Clearing history cannot be undone.</p></div><button className="secondary-button" disabled={clearingAi || !(settings.aiConversations > 0)} onClick={clearAiHistory}>{clearingAi ? "Clearing…" : "Clear AI history"}</button></div></section>

    <section className="settings-data-note"><h2>Data and privacy</h2><p>Your profile and assessment history are associated with your account. Review the <Link to="/legal/privacy">Privacy Policy</Link> for information about data handling.</p></section>
  </main>;
}
