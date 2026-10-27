import { prettifyEnum } from "@/lib/format";

export const DESIGNATIONS = ["COLLEGE_ADMIN", "TPO", "HOD", "FACULTY"];
export const SCOPES = ["INSTITUTION", "DEPARTMENT", "PROGRAM", "BATCH", "SECTION"];
export const ENROLLMENT_STATUSES = ["ACTIVE", "INACTIVE", "GRADUATED", "WITHDRAWN"];

export function labelOf(value) {
  return value ? prettifyEnum(value) : "—";
}

export function designationLabel(value) {
  if (value === "COLLEGE_ADMIN") return "College administrator";
  if (value === "TPO") return "TPO";
  return labelOf(value);
}

export function scopeLabel(scopeType, scopeName) {
  if (!scopeType) return "—";
  if (scopeType === "INSTITUTION") return "Institution-wide";
  return `${labelOf(scopeType)}${scopeName ? ` · ${scopeName}` : ""}`;
}

export function enrollmentTone(status) {
  if (status === "ACTIVE") return "bg-chart-3/15 text-chart-3";
  if (status === "GRADUATED") return "bg-primary/10 text-primary";
  if (status === "WITHDRAWN") return "bg-destructive/10 text-destructive";
  return "bg-muted text-muted-foreground";
}

export function readinessTone(value) {
  if (value == null) return "muted";
  if (value >= 70) return "green";
  if (value >= 40) return "gold";
  return "primary";
}
