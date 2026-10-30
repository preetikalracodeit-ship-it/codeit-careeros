import { AppError } from "../../lib/errors.js";
import type { InstitutionDoc } from "../../models/Institution.js";
import type { InstitutionMembershipDoc, ScopeType, StaffDesignation } from "../../models/InstitutionMembership.js";
import { User } from "../../models/User.js";
import { currentCollegeScope } from "./collegeAccess.service.js";

export interface CollegeScope {
  membership: InstitutionMembershipDoc;
  institution: InstitutionDoc;
  user: { _id: number; email: string; fullName: string };
  userId: number;
  institutionId: number;
  institutionName: string;
  designation: StaffDesignation;
  scopeType: ScopeType;
  scopeId: number | null;
  timezone: string;
}

export async function requireCollegeScope(userId: number): Promise<CollegeScope> {
  const { membership, institution } = await currentCollegeScope(userId);
  const user = await User.findById(userId).select("email fullName").lean();
  if (!user) throw AppError.unauthorized("Authentication is required");
  return {
    membership: membership as InstitutionMembershipDoc,
    institution: institution as InstitutionDoc,
    user,
    userId,
    institutionId: institution._id,
    institutionName: institution.name,
    designation: membership.designation,
    scopeType: membership.scopeType,
    scopeId: membership.scopeId ?? null,
    timezone: institution.timezone || "UTC",
  };
}

export function permissionsFor(designation: StaffDesignation): string[] {
  const canExport = designation !== "FACULTY";
  const canManageStructure = designation === "COLLEGE_ADMIN";
  const canImport = ["COLLEGE_ADMIN", "TPO", "HOD"].includes(designation);
  const canManageStudents = designation !== "FACULTY";
  const canManageImprovementPlans = designation !== "FACULTY";
  const canViewPlacement = designation !== "FACULTY";
  const canManageCompaniesAndJobs = ["COLLEGE_ADMIN", "TPO"].includes(designation);
  const permissions = ["VIEW_STUDENTS", "VIEW_DASHBOARD", "VIEW_IMPROVEMENT_PLANS"];
  if (canExport) permissions.push("EXPORT_STUDENTS", "GENERATE_REPORTS", "VIEW_REPORTS");
  if (canImport) permissions.push("IMPORT_STUDENTS");
  if (canManageStructure) permissions.push("MANAGE_STRUCTURE");
  if (canManageStructure) permissions.push("MANAGE_STAFF");
  if (canManageStudents) permissions.push("MANAGE_STUDENTS");
  if (canManageImprovementPlans) permissions.push("MANAGE_IMPROVEMENT_PLANS");
  if (canViewPlacement) permissions.push("VIEW_PLACEMENT");
  if (canManageCompaniesAndJobs) {
    permissions.push("MANAGE_COMPANIES", "MANAGE_JOBS", "VIEW_COMPANY_CONTACTS");
  }
  if (canManageCompaniesAndJobs) permissions.push("MANAGE_DRIVES", "MANAGE_APPLICATIONS");
  if (canExport) permissions.push("VIEW_PLACEMENT_REPORTS");
  return [...new Set(permissions)];
}

export const collegeCapabilities = {
  canManageStructure: (scope: CollegeScope) => scope.designation === "COLLEGE_ADMIN",
  canManageStaff: (scope: CollegeScope) => scope.designation === "COLLEGE_ADMIN",
  canExport: (scope: CollegeScope) => scope.designation !== "FACULTY",
  canGenerateReports: (scope: CollegeScope) => scope.designation !== "FACULTY",
  canImport: (scope: CollegeScope) =>
    ["COLLEGE_ADMIN", "TPO", "HOD"].includes(scope.designation),
  canManageStudents: (scope: CollegeScope) => scope.designation !== "FACULTY",
  canManageImprovementPlans: (scope: CollegeScope) => scope.designation !== "FACULTY",
  canViewPlacement: (scope: CollegeScope) => scope.designation !== "FACULTY",
  canManageCompaniesAndJobs: (scope: CollegeScope) =>
    ["COLLEGE_ADMIN", "TPO"].includes(scope.designation),
  canViewCompanyContacts: (scope: CollegeScope) =>
    ["COLLEGE_ADMIN", "TPO"].includes(scope.designation),
  canViewPlacementReports: (scope: CollegeScope) => scope.designation !== "FACULTY",
};

export function requireCapability(
  allowed: boolean,
  message: string,
): void {
  if (!allowed) throw AppError.forbidden(message);
}

export function requireManageStructure(scope: CollegeScope): void {
  requireCapability(collegeCapabilities.canManageStructure(scope), "Only a college administrator can manage the academic structure");
}

export function requireManageStaff(scope: CollegeScope): void {
  requireCapability(collegeCapabilities.canManageStaff(scope), "Only a college administrator can manage staff");
}

export function requireManageStudents(scope: CollegeScope): void {
  requireCapability(collegeCapabilities.canManageStudents(scope), "Your role cannot change student enrollment status");
}

export function requireImport(scope: CollegeScope): void {
  requireCapability(collegeCapabilities.canImport(scope), "Your role cannot import students");
}

export function requireExport(scope: CollegeScope): void {
  requireCapability(collegeCapabilities.canExport(scope), "Your role cannot export student data");
}

export function requireReports(scope: CollegeScope): void {
  requireCapability(collegeCapabilities.canGenerateReports(scope), "Your role cannot generate college reports");
}

export function requireManageImprovementPlans(scope: CollegeScope): void {
  requireCapability(collegeCapabilities.canManageImprovementPlans(scope), "Your role cannot create or edit improvement plans");
}

export function requirePlacementAccess(scope: CollegeScope): void {
  requireCapability(collegeCapabilities.canViewPlacement(scope), "Your role cannot view placement data");
}

export function requireManageCompaniesAndJobs(scope: CollegeScope): void {
  requireCapability(
    collegeCapabilities.canManageCompaniesAndJobs(scope),
    "Only a college administrator or TPO can manage companies and jobs",
  );
}

export function requireManageDrives(scope: CollegeScope): void {
  requireCapability(
    collegeCapabilities.canManageCompaniesAndJobs(scope),
    "Only a college administrator or TPO can manage placement drives",
  );
}

export function requireManageApplications(scope: CollegeScope): void {
  requireCapability(
    collegeCapabilities.canManageCompaniesAndJobs(scope),
    "Only a college administrator or TPO can manage applications",
  );
}

export function requirePlacementReports(scope: CollegeScope): void {
  requireCapability(
    collegeCapabilities.canViewPlacementReports(scope),
    "Your role cannot generate placement reports",
  );
}
