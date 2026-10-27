"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Bot, Loader2, Lock, ShieldCheck, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/field";
import { Breadcrumb } from "@/components/breadcrumb";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import api from "@/lib/api";
import { auth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { StudentAvatar } from "@/components/student-avatar";

export default function StudentSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changing, setChanging] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [clearingAi, setClearingAi] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await api.get("/settings/me");
      setSettings(res || null);
    } catch (err) {
      setLoadError(err.message || "Failed to load settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async settings loader; state updates happen in promise callbacks
    load();
  }, [load]);

  async function handlePasswordChange(e) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    setChanging(true);
    try {
      await api.put("/users/me/password", { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed. Other devices were logged out.");
      load();
    } catch (err) {
      toast.error(err.message || "Could not change password.");
    } finally {
      setChanging(false);
    }
  }

  async function handleRevokeSessions() {
    setRevoking(true);
    try {
      const res = await api.post("/users/me/sessions/revoke-all", {});
      toast.success(`Revoked ${res?.revokedSessions ?? 0} session(s). You may need to log in again.`);
      load();
    } catch (err) {
      toast.error(err.message || "Could not revoke sessions.");
    } finally {
      setRevoking(false);
    }
  }

  async function handleClearAi() {
    setClearingAi(true);
    try {
      const res = await api.delete("/settings/me/ai-history");
      toast.success(`Cleared ${res?.deletedSessions ?? 0} AI conversation(s).`);
      load();
    } catch (err) {
      toast.error(err.message || "Could not clear AI history.");
    } finally {
      setClearingAi(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      const refreshToken = auth.getRefreshToken();
      await api.post("/auth/logout", refreshToken ? { refreshToken } : {}).catch(() => null);
    } finally {
      auth.clear();
      router.replace("/login");
    }
  }

  if (loading) return <LoadingState title="Loading settings" description="Fetching your account, profile and security status." />;
  if (loadError) return <ErrorState title="Couldn't load settings" description={loadError} onRetry={load} />;
  if (!settings) return <ErrorState title="No settings found" description="Please try again." onRetry={load} />;

  const account = settings.account || {};
  const profile = settings.profile || {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your account, career preferences, security and data."
        breadcrumb={<Breadcrumb items={[{ label: "Settings" }]} />}
        actions={<Badge variant="secondary">{account.role || "Student"}</Badge>}
      />

      {/* Account */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><UserRound className="size-4 text-primary" aria-hidden="true" /> Account</CardTitle>
          <CardDescription>Your sign-in identity. Email and role cannot be changed here.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <div><p className="text-xs text-muted-foreground">Email</p><p className="font-semibold">{account.email}</p></div>
          <div><p className="text-xs text-muted-foreground">Role</p><p className="font-semibold">{account.role}</p></div>
          <div><p className="text-xs text-muted-foreground">Full name</p><p className="font-semibold">{account.fullName || profile.fullName || "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Member since</p><p className="font-semibold">{formatDateTime(account.createdAt)}</p></div>
        </CardContent>
      </Card>

      {/* Profile */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Personal, education and career links — edited on the Profile page.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <Link href="/student/profile" title="Edit profile photo" className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
            <StudentAvatar
              photoKey={profile.profilePhotoUrl || null}
              fullName={profile.fullName || account.fullName}
              email={account.email}
              className="size-12 border border-border/60"
              fallbackClassName="bg-primary/15 text-primary"
            />
          </Link>
          <div className="min-w-52 flex-1 text-sm">
            <p className="font-semibold">{profile.fullName || "Your profile"}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {[profile.college, profile.degree, profile.location].filter(Boolean).join(" · ") || "Complete your profile to power every analysis."}
            </p>
          </div>
          <Button variant="outline" size="sm" render={<Link href="/student/profile" />}>
            Edit profile <ArrowRight className="size-3.5" aria-hidden="true" />
          </Button>
        </CardContent>
      </Card>

      {/* Career preferences */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Career Preferences</CardTitle>
          <CardDescription>Your target career drives assessments, gaps, roadmap and reports.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <div className="min-w-52 flex-1 text-sm">
            <p className="font-semibold text-primary">{profile.targetCareerName || "No target career selected"}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Change it any time — your history is kept.</p>
          </div>
          <Button variant="outline" size="sm" render={<Link href="/student/careers" />}>
            Change career <ArrowRight className="size-3.5" aria-hidden="true" />
          </Button>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="size-4 text-primary" aria-hidden="true" /> Security</CardTitle>
          <CardDescription>Password, sessions and sign-out. Current password is always required to change it.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <form onSubmit={handlePasswordChange} className="grid gap-4 sm:grid-cols-3">
            <Field id="currentPassword" label="Current password" required>
              {(inputId) => <Input id={inputId} type="password" autoComplete="current-password" className="h-10 px-3" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />}
            </Field>
            <Field id="newPassword" label="New password" required>
              {(inputId) => <Input id={inputId} type="password" autoComplete="new-password" className="h-10 px-3" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />}
            </Field>
            <Field id="confirmPassword" label="Confirm new password" required>
              {(inputId) => <Input id={inputId} type="password" autoComplete="new-password" className="h-10 px-3" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />}
            </Field>
            <div className="sm:col-span-3">
              <Button type="submit" size="sm" disabled={changing || !currentPassword || !newPassword || !confirmPassword}>
                {changing && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
                <Lock className="size-3.5" aria-hidden="true" /> Change password
              </Button>
            </div>
          </form>
          <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-4 text-sm">
            <p className="min-w-52 flex-1 text-xs text-muted-foreground">{settings.activeSessions ?? 0} active session(s). Revoking logs out every device including this one.</p>
            <Button variant="outline" size="sm" disabled={revoking} onClick={handleRevokeSessions}>
              {revoking && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />} Log out all sessions
            </Button>
            <Button variant="outline" size="sm" disabled={loggingOut} onClick={handleLogout}>Log out</Button>
          </div>
        </CardContent>
      </Card>

      {/* AI preferences */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Bot className="size-4 text-primary" aria-hidden="true" /> AI Preferences</CardTitle>
          <CardDescription>Your AI Career Assistant — grounded in your real data. API keys never leave the backend.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4 text-sm">
          <div className="min-w-52 flex-1">
            <p>
              Status: <Badge variant="secondary" className={settings.aiStatus?.configured || settings.aiStatus?.mode === "offline-smart" ? "bg-chart-3/15 text-chart-3" : ""}>
                {settings.aiStatus?.configured
                  ? `LLM-enhanced (${settings.aiStatus.model || settings.aiStatus.provider || "ready"})`
                  : settings.aiStatus?.mode === "offline-smart" || settings.aiStatus?.offlineFallback
                    ? "Smart Guidance active (no key needed)"
                    : "Not configured"}
              </Badge>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{settings.aiConversations ?? 0} saved conversation(s). Clearing deletes every session and its messages.</p>
          </div>
          <Button variant="outline" size="sm" render={<Link href="/student/ai" />}>Open AI Assistant</Button>
          <Button variant="outline" size="sm" disabled={clearingAi || !(settings.aiConversations > 0)} onClick={handleClearAi}>
            {clearingAi && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />} Clear chat history
          </Button>
        </CardContent>
      </Card>

      {/* Data / privacy */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Data & Privacy</CardTitle>
          <CardDescription>What CareerOS holds about you. Destructive deletion is not offered casually.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <div><p className="text-xs text-muted-foreground">CV / documents</p><p className="font-semibold">{settings.hasCv ? "CV on file" : "No CV uploaded"}</p></div>
          <div><p className="text-xs text-muted-foreground">LinkedIn</p><p className="font-semibold">{settings.hasLinkedIn ? "Profile connected" : "Not connected"}</p></div>
          <div><p className="text-xs text-muted-foreground">AI conversations</p><p className="font-semibold">{settings.aiConversations ?? 0} saved</p></div>
          <div><p className="text-xs text-muted-foreground">Active sessions</p><p className="font-semibold">{settings.activeSessions ?? 0}</p></div>
        </CardContent>
      </Card>
    </div>
  );
}
