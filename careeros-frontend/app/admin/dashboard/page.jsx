"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  TriangleAlert,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/stat-card";
import api from "@/lib/api";
import { cn } from "cn";

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function initialsOf(student) {
  const source = student?.fullName || student?.email || "?";
  return source
    .split(/[\s@._]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function AdminDashboard() {
  const [count, setCount] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchSnapshot = useCallback(async () => {
    const [countData, listData] = await Promise.all([
      api.get("/admin/students/count"),
      api.get("/admin/students", { params: { page: 0, size: 10 } }),
    ]);
    return { count: countData.count, students: listData?.content || [] };
  }, []);

  useEffect(() => {
    let ignore = false;
    fetchSnapshot()
      .then((snap) => {
        if (!ignore) {
          setCount(snap.count);
          setStudents(snap.students);
        }
      })
      .catch((err) => {
        if (!ignore) setError(err.message || "Failed to load student data.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [fetchSnapshot]);

  async function handleRefresh() {
    setLoading(true);
    setError("");
    try {
      const snap = await fetchSnapshot();
      setCount(snap.count);
      setStudents(snap.students);
    } catch (err) {
      setError(err.message || "Failed to load student data.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Admin Overview</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-chart-3/30 bg-chart-3/10 px-2.5 py-1 text-[11px] font-semibold text-chart-3">
              <span className="size-1.5 animate-pulse rounded-full bg-chart-3" aria-hidden="true" />
              Live snapshot
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Platform-wide student snapshot.</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
          <RefreshCw className={cn("size-3.5", loading && "animate-spin")} aria-hidden="true" />
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-center gap-2.5 py-4 text-sm text-destructive">
            <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
            {error}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        <StatCard
          icon={Users}
          label="Registered students"
          value={count === null ? "—" : count}
          sub="Student accounts in CareerOS"
          tone="primary"
          loading={loading}
        />
      </div>

      <div className="grid gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Latest Students</CardTitle>
              <CardDescription>Most recently registered student profiles.</CardDescription>
            </div>
            <Badge variant="secondary">{students.length} shown</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3 font-semibold">Student</th>
                    <th className="px-5 py-3 font-semibold">Email</th>
                    <th className="px-5 py-3 font-semibold">College</th>
                    <th className="px-5 py-3 font-semibold">Branch</th>
                    <th className="px-5 py-3 font-semibold">Year</th>
                    <th className="px-5 py-3 font-semibold">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {students.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">
                        {loading ? "Loading students…" : "No students registered yet."}
                      </td>
                    </tr>
                  )}
                  {students.map((student) => (
                    <tr
                      key={student.id}
                      className="border-b border-border/40 transition last:border-0 hover:bg-accent/40"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8">
                            <AvatarFallback className="bg-primary/10 text-[11px] font-bold text-primary">
                              {initialsOf(student)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 leading-tight">
                            <p className="truncate font-medium">{student.fullName || "—"}</p>
                            <p className="truncate text-xs text-muted-foreground">{student.studentId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-48 truncate px-5 py-3 text-muted-foreground">{student.email}</td>
                      <td className="px-5 py-3 text-muted-foreground">{student.college || "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">{student.branch || "—"}</td>
                      <td className="tnum px-5 py-3">{student.graduationYear ?? "—"}</td>
                      <td className="px-5 py-3 text-muted-foreground">{formatDate(student.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
