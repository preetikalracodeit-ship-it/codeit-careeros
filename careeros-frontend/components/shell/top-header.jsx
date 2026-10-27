"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, ChevronRight, Menu, Search } from "lucide-react";
import { StudentAvatar } from "@/components/student-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { usePathname } from "next/navigation";
import { cn } from "cn";

function CommandSearch({ items }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);
  const boxRef = useRef(null);

  // Close the results panel when the route changes (state adjusted during
  // render — the React-recommended alternative to an effect).
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setOpen(false);
  }

  useEffect(() => {
    function onClickOutside(event) {
      if (boxRef.current && !boxRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const matches = query.trim()
    ? items.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()))
    : items;

  return (
    <div ref={boxRef} className="relative hidden w-full max-w-xs md:block">
      <Search
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        role="combobox"
        aria-expanded={open}
        aria-controls="command-search-results"
        aria-label="Search pages"
        className="h-9 rounded-full pr-4 pl-9.5"
        placeholder="Search pages…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <div
          id="command-search-results"
          className="absolute top-12 right-0 left-0 z-40 max-h-80 overflow-y-auto rounded-2xl border border-border bg-card p-1.5 shadow-popover"
          role="listbox"
        >
          {matches.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              No pages match “{query}”.
            </p>
          ) : (
            matches.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  role="option"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
                >
                  <span className="flex size-7 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="size-3.5" aria-hidden="true" />
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {item.soon && (
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground/60">soon</span>
                  )}
                </Link>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const [unread] = useState(0);
  const boxRef = useRef(null);

  useEffect(() => {
    function onClickOutside(event) {
      if (boxRef.current && !boxRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={boxRef} className="relative">
      <Button
        variant="ghost"
        size="icon"
        aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
        aria-haspopup="true"
        aria-expanded={open}
        className="relative rounded-full text-muted-foreground hover:text-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="size-5" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 flex size-2 rounded-full bg-chart-1 ring-2 ring-background" aria-hidden="true" />
        )}
      </Button>
      {open && (
        <div className="absolute top-12 right-0 z-40 w-80 rounded-2xl border border-border bg-card p-2 shadow-popover">
          <div className="rounded-xl">
            <EmptyState
              compact
              icon={Bell}
              title="You're all caught up"
              description="Notifications will appear here as your roadmap, assessments and reports progress."
            />
          </div>
        </div>
      )}
    </div>
  );
}

function TopHeader({ items, title, user, initials, photoKey = null, photoVersion = 0, onMenuClick, variant = "student" }) {
  const isStaff = variant === "admin" || variant === "college";
  const staffLabel = variant === "admin" ? "Administrator" : "College staff";

  return (
    <header className="glass-bar sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border/60 px-4 md:px-6">
      <Button
        variant="outline"
        size="icon"
        className="rounded-full md:hidden"
        onClick={onMenuClick}
        aria-label="Open navigation menu"
      >
        <Menu className="size-5" aria-hidden="true" />
      </Button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{title || "Dashboard"}</p>
      </div>

      <CommandSearch items={items} />

      <div className="flex items-center gap-1.5">
        <NotificationsMenu />

        {isStaff ? (
          <div className="hidden items-center gap-2.5 rounded-full py-1 pr-2.5 pl-1.5 transition hover:bg-accent sm:flex">
            <StudentAvatar
              photoKey={null}
              fullName={user?.fullName}
              email={user?.email}
              initials={initials}
              className="size-8"
              fallbackClassName={cn("bg-brand-600 text-white")}
            />
            <div className="hidden leading-tight lg:block">
              <p className="max-w-36 truncate text-sm font-medium">{user?.fullName || user?.email || "User"}</p>
              <p className="text-xs text-muted-foreground">{staffLabel}</p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </div>
        ) : (
          <Link
            href="/student/profile"
            title="View my profile photo"
            className="hidden items-center gap-2.5 rounded-full py-1 pr-2.5 pl-1.5 transition outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 sm:flex"
          >
            <StudentAvatar
              photoKey={photoKey}
              refreshKey={photoVersion}
              fullName={user?.fullName}
              email={user?.email}
              initials={initials}
              className="size-8"
              fallbackClassName={cn("bg-primary/15 text-primary")}
            />
            <div className="hidden leading-tight lg:block">
              <p className="max-w-36 truncate text-sm font-medium">{user?.fullName || user?.email || "User"}</p>
              <p className="text-xs text-muted-foreground">Student</p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </Link>
        )}
      </div>
    </header>
  );
}

export { TopHeader };