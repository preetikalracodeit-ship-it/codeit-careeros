"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Mail,
  Search,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Breadcrumb } from "@/components/breadcrumb";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import api from "@/lib/api";
import { formatDateTime } from "@/lib/format";

const PAGE_SIZE = 12;

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

function DetailRow({ label, value, href }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-border/50 bg-background/40 px-3 py-2 text-sm">
      <dt className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium">
        {href ? (
          <a href={href} target="_blank" rel="noreferrer" className="text-primary hover:underline">
            {value}
          </a>
        ) : (
          <span className="break-words">{value}</span>
        )}
      </dd>
    </div>
  );
}

export default function AdminStudentsPage() {
  const [students, setStudents] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const requestId = useRef(0);

  const load = useCallback(async (pageToLoad = 0) => {
    const currentRequestId = ++requestId.current;
    setLoading(true);
    setLoadError("");
    try {
      const listData = await api.get("/admin/students", {
        params: { page: pageToLoad, size: PAGE_SIZE, ...(search ? { search } : {}) },
      });
      if (currentRequestId !== requestId.current) return;
      setStudents(Array.isArray(listData?.content) ? listData.content : []);
      setPage(listData?.page ?? pageToLoad);
      setTotalPages(listData?.totalPages ?? 0);
      setTotalElements(listData?.totalElements ?? 0);
    } catch (err) {
      if (currentRequestId !== requestId.current) return;
      setLoadError(err?.message || "Failed to load students.");
    } finally {
      if (currentRequestId === requestId.current) setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data loader; state updates happen in promise callbacks
    load(page);
  }, [load, page]);

  function gotoPage(next) {
    const clamped = Math.max(0, Math.min(totalPages - 1, next));
    setPage(clamped);
  }

  function applySearch(event) {
    event.preventDefault();
    setPage(0);
    setSearch(searchInput.trim());
  }

  if (loading && students.length === 0) return <LoadingState label="Loading students…" />;

  if (loadError && students.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Students"
          description="Search and inspect student accounts on the platform."
          breadcrumb={<Breadcrumb items={[{ label: "Students" }]} />}
        />
        <ErrorState title="Couldn't load students" description={loadError} onRetry={() => load(page)} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        description={
          totalElements > 0
            ? `${totalElements} registered student${totalElements === 1 ? "" : "s"} on the platform.`
            : "Search and inspect student accounts on the platform."
        }
        breadcrumb={<Breadcrumb items={[{ label: "Students" }]} />}
      />

      <Card className="shadow-card">
        <CardContent className="space-y-4 p-4">
          <form onSubmit={applySearch} className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search students by name, email, ID, college, branch or career"
                aria-label="Search all students"
                className="pl-9"
              />
            </div>
            <Button type="submit" disabled={loading}>
              <Search className="size-3.5" aria-hidden="true" /> Search
            </Button>
          </form>

          {students.length === 0 ? (
            <EmptyState
              icon={Users}
              title={search ? "No students match this search" : "No students yet"}
              description={
                search
                  ? "Try a different search term. Search applies across all student pages."
                  : "Student accounts appear here once someone registers."
              }
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {students.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(s)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-background/40 p-3.5 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card-hover"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-sm font-bold text-primary">
                      {initialsOf(s)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{s.fullName || "Unnamed student"}</span>
                      <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <Mail className="size-3 shrink-0" aria-hidden="true" />
                        {s.email}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className="tnum">
                          {s.studentId || `#${s.id}`}
                        </Badge>
                        {s.targetCareerName ? (
                          <Badge variant="secondary" className="bg-primary/10 text-primary">
                            {s.targetCareerName}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">No career yet</Badge>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 pt-1">
              <p className="tnum text-xs text-muted-foreground">
                Page {page + 1} of {totalPages} · {totalElements} total
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 0 || loading} onClick={() => gotoPage(page - 1)}>
                  <ArrowLeft className="size-3.5" aria-hidden="true" />
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1 || loading}
                  onClick={() => gotoPage(page + 1)}
                >
                  Next
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={selected?.fullName || "Student details"}
        description={selected ? `${selected.studentId || ""} · joined ${formatDateTime(selected.createdAt)}` : undefined}
        className="max-w-lg"
        footer={
          <Button variant="outline" size="sm" onClick={() => setSelected(null)}>
            Close
          </Button>
        }
      >
        {selected && (
          <dl className="mt-4 grid gap-2">
            <DetailRow label="Email" value={selected.email} />
            <DetailRow label="Mobile" value={selected.mobile} />
            <DetailRow label="College" value={selected.college} />
            <DetailRow label="Degree" value={selected.degree} />
            <DetailRow label="Branch" value={selected.branch} />
            <DetailRow
              label="Graduation"
              value={
                [selected.graduationYear ? `Class of ${selected.graduationYear}` : null, selected.semester ? `Sem ${selected.semester}` : null]
                  .filter(Boolean)
                  .join(" · ") || null
              }
            />
            <DetailRow label="Location" value={selected.location} />
            <DetailRow label="Target career" value={selected.targetCareerName} />
            <DetailRow label="GitHub" value={selected.githubUrl ? "Open profile" : null} href={selected.githubUrl} />
            <DetailRow label="LinkedIn" value={selected.linkedinUrl ? "Open profile" : null} href={selected.linkedinUrl} />
            <DetailRow label="Portfolio" value={selected.portfolioUrl ? "Open site" : null} href={selected.portfolioUrl} />
          </dl>
        )}
      </Dialog>

      {loadError && students.length > 0 && (
        <p role="alert" className="text-xs font-semibold text-destructive">
          Refresh failed: {loadError}{" "}
          <button type="button" className="underline" onClick={() => load(page)}>
            Retry
          </button>
        </p>
      )}
    </div>
  );
}
