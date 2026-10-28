import type { ClientSession } from "mongoose";
import { getNextSequence } from "../models/Counter.js";
import { AuditEvent, type AuditOutcome } from "../models/AuditEvent.js";
import { logger } from "./logger.js";

interface AdminAuditInput {
  actorUserId?: number | null;
  actorRole?: string | null;
  action: string;
  targetPath: string;
  outcome: AuditOutcome;
  httpStatus: number;
  requestId?: string | null;
}

interface InstitutionAuditInput {
  actorUserId?: number | null;
  actorRole?: string | null;
  actorEmail?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  institutionId?: number | null;
  scopeDescription?: string | null;
  outcome?: AuditOutcome;
  details?: string | null;
  requestId?: string | null;
  session?: ClientSession;
}

function trim(value: string | null | undefined, max: number): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const cleaned = value.replace(/[\r\n\t]+/g, " ").trim();
  return cleaned.length <= max ? cleaned : cleaned.slice(0, max);
}

interface AuditInsert {
  actorUserId?: number | null;
  actorRole?: string | null;
  actorEmail?: string | null;
  action: string;
  targetPath: string;
  targetType?: string | null;
  targetId?: string | null;
  institutionId?: number | null;
  scopeDescription?: string | null;
  outcome: AuditOutcome;
  httpStatus?: number | null;
  requestId?: string | null;
  details?: string | null;
}

async function insertAudit(fields: AuditInsert, session?: ClientSession): Promise<void> {
  const id = await getNextSequence("audit_events", session);
  await AuditEvent.create([{ ...fields, _id: id, createdAt: new Date() }], session ? { session } : {});
}

export async function recordAdminRequest(input: AdminAuditInput): Promise<void> {
  try {
    await insertAudit({
      actorUserId: input.actorUserId ?? null,
      actorRole: trim(input.actorRole, 20),
      action: trim(input.action, 140) ?? "UNKNOWN",
      targetPath: trim(input.targetPath, 255) ?? "/api/v1/admin",
      outcome: input.outcome,
      httpStatus: input.httpStatus,
      requestId: trim(input.requestId, 64),
    });
  } catch (error) {
    logger.error(
      { err: error, action: input.action, outcome: input.outcome, requestId: input.requestId },
      "Failed to persist admin audit event",
    );
  }
}

export async function recordInstitutionEvent(input: InstitutionAuditInput): Promise<void> {
  const action = trim(input.action, 140) ?? "UNKNOWN";
  await insertAudit({
    actorUserId: input.actorUserId ?? null,
    actorRole: trim(input.actorRole, 20),
    actorEmail: trim(input.actorEmail, 190),
    action,
    targetPath: trim(`college:${action}`, 255) ?? `college:${action}`,
    targetType: trim(input.targetType, 60),
    targetId: trim(input.targetId, 80),
    institutionId: input.institutionId ?? null,
    scopeDescription: trim(input.scopeDescription, 200),
    outcome: input.outcome ?? "SUCCESS",
    requestId: trim(input.requestId, 64),
    details: trim(input.details, 1000),
  }, input.session);
}

export function actorFromUser(
  user: { id: number; role: string } | undefined,
  email?: string | null,
): { actorUserId: number | null; actorRole: string | null; actorEmail: string | null } {
  if (!user) {
    return { actorUserId: null, actorRole: null, actorEmail: null };
  }
  return {
    actorUserId: user.id,
    actorRole: user.role,
    actorEmail: email ?? null,
  };
}
