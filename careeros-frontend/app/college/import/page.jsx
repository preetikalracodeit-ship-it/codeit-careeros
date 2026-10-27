"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload,
  Users,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Breadcrumb } from "@/components/breadcrumb";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import api from "@/lib/api";
import { labelOf } from "@/lib/college";
import { cn } from "cn";

const TEMPLATE_HEADERS = [
  "full_name",
  "email",
  "mobile",
  "roll_number",
  "department_code",
  "program_code",
  "batch_label",
  "section_name",
  "academic_year_label",
];

const TEMPLATE_ROW = [
  "Aarav Sharma",
  "aarav.sharma@example.edu",
  "9876543210",
  "CS2026001",
  "CSE",
  "BTECH-CSE",
  "2026-2030",
  "A",
  "2026-27",
];

function downloadText(filename, text, type = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function statusTone(status) {
  if (status === "READY" || status === "CREATED" || status === "LINKED") return "bg-chart-3/15 text-chart-3";
  if (status === "SKIPPED") return "bg-muted text-muted-foreground";
  return "bg-destructive/10 text-destructive";
}

export default function CollegeImportPage() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    let ignore = false;
    api
      .get("/college/me")
      .then((data) => {
        if (!ignore) setMe(data);
      })
      .catch((err) => {
        if (!ignore) setError(err.message || "Failed to load your college membership.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const canImport = me?.permissions?.includes("IMPORT_STUDENTS");

  function reset() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function upload(event) {
    event.preventDefault();
    if (!file) {
      setError("Choose a CSV file first.");
      return;
    }
    setUploading(true);
    setError("");
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const data = await api.post("/college/students/import/preview", form);
      setPreview(data);
    } catch (err) {
      setError(err.message || "The CSV preview failed.");
    } finally {
      setUploading(false);
    }
  }

  async function commit() {
    if (!preview?.jobId) return;
    setCommitting(true);
    setError("");
    try {
      const data = await api.post(`/college/students/import/${preview.jobId}/commit`);
      setResult(data);
      setPreview(null);
    } catch (err) {
      setError(err.message || "The import commit failed.");
    } finally {
      setCommitting(false);
    }
  }

  if (loading) return <LoadingState label="Checking your import permission…" />;

  if (!canImport) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="CSV Import"
          description="Bulk student enrollment."
          breadcrumb={<Breadcrumb items={[{ label: "CSV Import" }]} />}
        />
        <ErrorState
          title="Import is not available for your role"
          description={error || "Only college administrators, TPOs and HODs can import students."}
        />
      </div>
    );
  }

  const rows = result?.rows || preview?.rows || [];
  const errorCsv = result?.errorCsv || preview?.errorCsv;

  return (
    <div className="space-y-6">
      <PageHeader
        title="CSV Import"
        description="Preview every row before committing. Nothing is created during preview."
        breadcrumb={<Breadcrumb items={[{ label: "CSV Import" }]} />}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadText(
                  "careeros-student-import-template.csv",
                  `${TEMPLATE_HEADERS.join(",")}\r\n${TEMPLATE_ROW.join(",")}\r\n`,
                )
              }
            >
              <Download className="size-3.5" aria-hidden="true" />
              Template
            </Button>
            {(preview || result) && (
              <Button variant="outline" size="sm" onClick={reset}>
                Start over
              </Button>
            )}
          </>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!preview && !result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload a CSV</CardTitle>
            <CardDescription>
              Maximum 2 MB and 1,000 data rows. Required columns: {TEMPLATE_HEADERS.slice(0, 6).join(", ")}.
              Optional: mobile, section_name, academic_year_label.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={upload} className="space-y-4">
              <label
                htmlFor="csv-file"
                className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background/40 px-6 py-10 text-center transition hover:border-primary/40"
              >
                <FileSpreadsheet className="size-8 text-primary" aria-hidden="true" />
                <span className="mt-2 text-sm font-semibold">
                  {file ? file.name : "Choose a CSV file"}
                </span>
                <span className="mt-1 text-xs text-muted-foreground">
                  {file ? `${Math.ceil(file.size / 1024)} KB` : "UTF-8 CSV, up to 2 MB"}
                </span>
                <input
                  ref={inputRef}
                  id="csv-file"
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                />
              </label>
              <div className="flex justify-end">
                <Button type="submit" disabled={uploading || !file}>
                  <Upload className="size-3.5" aria-hidden="true" />
                  {uploading ? "Validating…" : "Preview import"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {preview && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Preview results</CardTitle>
              <CardDescription>
                {preview.totalRows} rows · {preview.readyRows} ready · {preview.skippedRows} skipped ·{" "}
                {preview.rejectedRows} rejected
              </CardDescription>
            </div>
            <Button onClick={commit} disabled={committing || preview.readyRows === 0}>
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
              {committing ? "Committing…" : `Commit ${preview.readyRows} ready row${preview.readyRows === 1 ? "" : "s"}`}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Preview expires {preview.expiresAt ? new Date(preview.expiresAt).toLocaleString() : "in 30 minutes"}.
              Rejected rows are not created.
            </p>
            <OutcomeTable rows={rows} />
            {errorCsv && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadText("careeros-import-errors.csv", errorCsv)}
              >
                <Download className="size-3.5" aria-hidden="true" />
                Download error rows
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="size-4 text-chart-3" aria-hidden="true" />
              Import committed
            </CardTitle>
            <CardDescription>
              {result.createdRows} created · {result.linkedRows} linked · {result.skippedRows} skipped ·{" "}
              {result.rejectedRows} rejected
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <OutcomeTable rows={result.rows} />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" render={<Link href="/college/students" />}>
                <Users className="size-3.5" aria-hidden="true" />
                View students
              </Button>
              {errorCsv && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadText("careeros-import-errors.csv", errorCsv)}
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  Download rejected rows
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Imported accounts receive a random unusable password. Credential delivery is not configured yet, so the
              institution must activate accounts through its own process.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function OutcomeTable({ rows }) {
  if (!rows?.length) {
    return <p className="text-sm text-muted-foreground">No row outcomes to show.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px] text-sm">
        <thead>
          <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th className="py-2 pr-3 font-semibold">Row</th>
            <th className="py-2 pr-3 font-semibold">Status</th>
            <th className="py-2 pr-3 font-semibold">Roll number</th>
            <th className="py-2 pr-3 font-semibold">Email</th>
            <th className="py-2 font-semibold">Message</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.rowNumber}-${row.email}`} className="border-b border-border/40 last:border-0">
              <td className="tnum py-2.5 pr-3">{row.rowNumber}</td>
              <td className="py-2.5 pr-3">
                <Badge className={cn("border-0", statusTone(row.status))}>{labelOf(row.status)}</Badge>
              </td>
              <td className="tnum py-2.5 pr-3">{row.rollNumber || "—"}</td>
              <td className="py-2.5 pr-3 text-muted-foreground">{row.email || "—"}</td>
              <td className="py-2.5 text-xs text-muted-foreground">{row.message || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
