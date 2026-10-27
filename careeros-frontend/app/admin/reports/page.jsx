"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  Download,
  FileBarChart,
  FileText,
  Route,
  Target,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumb } from "@/components/breadcrumb";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import api from "@/lib/api";

const REPORT_TYPES = [
  {
    icon: TrendingUp,
    title: "Readiness report",
    desc: "Overall career-readiness score with skill coverage for the student's target career.",
  },
  {
    icon: ClipboardList,
    title: "Assessment report",
    desc: "Attempt history, scores per skill, and what each result means.",
  },
  {
    icon: Target,
    title: "Gap analysis",
    desc: "Matched vs missing skills with weights against the career framework.",
  },
  {
    icon: Route,
    title: "Roadmap report",
    desc: "Phase-wise progress through the student's 30/60/90-day plan.",
  },
  {
    icon: FileText,
    title: "Overall report + PDF",
    desc: "Everything combined, downloadable as PDF from the student Reports page.",
  },
];

export default function AdminReportsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setStats(await api.get("/admin/stats"));
    } catch (err) {
      setLoadError(err?.message || "Failed to load report statistics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data loader; state updates happen in promise callbacks
    load();
  }, [load]);

  if (loading) return <LoadingState label="Loading reports overview…" />;

  if (loadError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Reports"
          description="What readiness reports exist and how much data feeds them."
          breadcrumb={<Breadcrumb items={[{ label: "Reports" }]} />}
        />
        <ErrorState title="Couldn't load reports overview" description={loadError} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Students generate these from their Reports page. This console shows what feeds them — reports themselves stay private to each student."
        breadcrumb={<Breadcrumb items={[{ label: "Reports" }]} />}
        actions={
          <Button size="sm" variant="outline" render={<Link href="/admin/students" />}>
            <Download className="size-3.5" aria-hidden="true" />
            Find a student
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={ClipboardList} label="Attempts" value={stats?.attempts ?? "—"} sub="Assessment attempts submitted" tone="primary" />
        <StatCard icon={TrendingUp} label="Completed" value={stats?.assessmentsCompleted ?? "—"} sub="Finished assessments" tone="green" />
        <StatCard icon={FileBarChart} label="Questions" value={stats?.questions ?? "—"} sub="Across all assessments" tone="gold" />
        <StatCard icon={FileText} label="Students" value={stats?.students ?? "—"} sub="Potential report owners" tone="muted" />
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-base">Report types students can generate</CardTitle>
          <CardDescription>Each is computed live from verified CareerOS data — never stored guesses.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3 sm:grid-cols-2">
            {REPORT_TYPES.map((r) => {
              const Icon = r.icon;
              return (
                <li
                  key={r.title}
                  className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/40 p-4 transition hover:border-primary/40 hover:shadow-card-hover"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold">{r.title}</span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{r.desc}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
