"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SidebarContent } from "@/components/shell/sidebar";
import { TopHeader } from "@/components/shell/top-header";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import api from "@/lib/api";
import { cn } from "cn";

function initialsOf(user) {
  const source = user?.fullName || user?.email || "U";
  return source
    .split(/[\s@._]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function AppShell({ items, variant = "student", title, children }) {
  const router = useRouter();
  const [user, setUser] = useState({});
  const [photoKey, setPhotoKey] = useState(null);
  const [photoVersion, setPhotoVersion] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const isStaff = variant === "admin" || variant === "college";

  useEffect(() => {
    const id = setTimeout(() => setUser(auth.getUser() || {}), 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    if (isStaff) return undefined;
    let ignore = false;
    api
      .get("/students/me")
      .then((data) => {
        if (!ignore) {
          setPhotoKey(data?.profilePhotoUrl || null);
          if (data?.fullName) {
            setUser((prev) => ({ ...prev, fullName: data.fullName }));
          }
        }
      })
      .catch(() => null);
    function onPhotoUpdated() {
      setPhotoVersion((v) => v + 1);
      api
        .get("/students/me")
        .then((data) => {
          if (!ignore) setPhotoKey(data?.profilePhotoUrl || null);
        })
        .catch(() => null);
    }
    window.addEventListener("careeros:photo-updated", onPhotoUpdated);
    return () => {
      ignore = true;
      window.removeEventListener("careeros:photo-updated", onPhotoUpdated);
    };
  }, [isStaff]);

  async function confirmLogout() {
    setSigningOut(true);
    try {
      const refreshToken = auth.getRefreshToken();
      if (refreshToken) {
        await api.post("/auth/logout", { refreshToken });
      }
    } catch {
      // local cleanup proceeds even if the server call fails
    } finally {
      auth.clear();
      setSigningOut(false);
      setConfirmOpen(false);
      toast.success("Signed out successfully");
      router.replace("/login");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-30 hidden w-64 border-r md:block",
          isStaff ? "border-pine-800 bg-pine-950" : "border-border/60 bg-card",
        )}
      >
        <SidebarContent
          items={items}
          variant={variant}
          user={user}
          initials={initialsOf(user)}
          photoKey={isStaff ? null : photoKey}
          photoVersion={photoVersion}
          onLogout={() => setConfirmOpen(true)}
        />
      </aside>

      <div
        className={cn(
          "fixed inset-0 z-40 bg-pine-950/60 transition-opacity md:hidden",
          drawerOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />
      <aside
        className={cn(
          "fixed top-0 bottom-0 left-0 z-50 w-72 md:hidden",
          isStaff ? "bg-pine-950 text-white" : "bg-card",
          "transition-transform duration-250 ease-out",
          drawerOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-label="Mobile navigation"
        aria-modal="true"
        role="dialog"
      >
        <SidebarContent
          items={items}
          variant={variant}
          user={user}
          initials={initialsOf(user)}
          photoKey={isStaff ? null : photoKey}
          photoVersion={photoVersion}
          onClose={() => setDrawerOpen(false)}
          onLogout={() => {
            setDrawerOpen(false);
            setConfirmOpen(true);
          }}
        />
      </aside>

      <div className="flex min-h-screen flex-col md:pl-64">
        <TopHeader
          items={items}
          title={title}
          user={user}
          initials={initialsOf(user)}
          photoKey={isStaff ? null : photoKey}
          photoVersion={photoVersion}
          variant={variant}
          onMenuClick={() => setDrawerOpen(true)}
        />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-7xl animate-fade-up">{children}</div>
        </main>
      </div>

      <Dialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={
          variant === "admin"
            ? "Sign out of Admin Console?"
            : variant === "college"
              ? "Sign out of College Console?"
              : "Sign out?"
        }
        description="You'll need to sign in again to continue using CareerOS."
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={signingOut}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmLogout} disabled={signingOut}>
              {signingOut ? "Signing out…" : "Sign out"}
            </Button>
          </>
        }
      />
    </div>
  );
}

export { AppShell };