"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { collegeNav } from "@/components/shell/nav-items";
import api from "@/lib/api";

const baseItems = collegeNav.filter((item) => !item.permission);

/**
 * Filters navigation using the same server-derived permission list that the
 * API enforces. The initial render only shows unconditional destinations so a
 * faculty member never briefly sees staff-only links.
 */
export function CollegeShell({ children }) {
  const [items, setItems] = useState(baseItems);

  useEffect(() => {
    let ignore = false;
    api
      .get("/college/me")
      .then((me) => {
        if (ignore) return;
        const permissions = new Set(me?.permissions || []);
        setItems(collegeNav.filter((item) => !item.permission || permissions.has(item.permission)));
      })
      .catch(() => {
        if (!ignore) setItems(baseItems);
      });
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <AppShell items={items} variant="college" title="College Console">
      {children}
    </AppShell>
  );
}
