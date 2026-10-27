"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, X } from "lucide-react";
import { LogoWordmark } from "@/components/logo";
import { StudentAvatar } from "@/components/student-avatar";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

function SidebarContent({ items, variant, user, initials, photoKey = null, photoVersion = 0, onClose, onLogout }) {
  const pathname = usePathname();
  const isAdmin = variant === "admin";
  const isCollege = variant === "college";
  const isDark = isAdmin || isCollege;
  const home = isAdmin ? "/admin/dashboard" : isCollege ? "/college/dashboard" : "/student/dashboard";
  const areaLabel = isAdmin ? "Admin Console" : isCollege ? "College Console" : "Student Portal";
  const roleLabel = user?.role === "ADMIN" ? "Administrator" : user?.role === "PROFESSOR" ? "College staff" : "Student";

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between gap-2 px-5">
        <Link
          href={home}
          onClick={onClose}
          className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <LogoWordmark tone={isDark ? "light" : "dark"} size="text-sm" />
        </Link>
        {onClose && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close navigation menu"
            className={cn(isDark && "text-pine-200 hover:bg-pine-800 hover:text-white")}
          >
            <X className="size-4" aria-hidden="true" />
          </Button>
        )}
      </div>

      <p
        className={cn(
          "px-6 pb-3 text-[10px] font-bold uppercase tracking-widest",
          isDark ? "text-pine-400" : "text-muted-foreground/70",
        )}
      >
        {areaLabel}
      </p>

      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 pb-4">
        <ul className="space-y-0.5">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-full px-3.5 py-2.5 text-sm font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : isDark
                        ? "text-pine-200 hover:bg-white/5 hover:text-white"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="size-4.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.soon && (
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                        active
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : isDark
                            ? "bg-white/10 text-pine-200"
                            : "bg-primary/10 text-primary/80",
                      )}
                    >
                      soon
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className={cn("shrink-0 border-t px-4 py-4", isDark ? "border-pine-800" : "border-border/60")}>
        <div className="flex items-center gap-3 rounded-xl p-2">
          <StudentAvatar
            photoKey={isDark ? null : photoKey}
            refreshKey={photoVersion}
            fullName={user?.fullName}
            email={user?.email}
            initials={initials}
            className="size-9"
            fallbackClassName={cn(isDark ? "bg-brand-600 text-white" : "bg-primary/15 text-primary")}
          />
          <div className="min-w-0 flex-1 leading-tight">
            <p className={cn("truncate text-sm font-semibold", isDark && "text-white")}>
              {user?.fullName || user?.email || "User"}
            </p>
            <p className={cn("truncate text-xs", isDark ? "text-pine-300" : "text-muted-foreground")}>
              {roleLabel}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onLogout}
            aria-label="Sign out"
            title="Sign out"
            className={cn(isDark && "text-pine-200 hover:bg-pine-800 hover:text-white")}
          >
            <LogOut className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export { SidebarContent };
