import { AppError } from "../../lib/errors.js";
import { Institution } from "../../models/Institution.js";
import { InstitutionMembership } from "../../models/InstitutionMembership.js";

export async function currentCollegeScope(userId: number) {
  const membership = await InstitutionMembership.findOne({ userId, status: "ACTIVE" }).lean();
  if (!membership) throw AppError.forbidden("No active institution membership");
  const institution = await Institution.findById(membership.institutionId).lean();
  if (!institution || institution.status !== "ACTIVE") throw AppError.forbidden("The institution is inactive");
  return { membership, institution };
}

export async function requireCollegeAdmin(userId: number) {
  const scope = await currentCollegeScope(userId);
  if (scope.membership.designation !== "COLLEGE_ADMIN") throw AppError.forbidden("Only a college administrator can manage staff");
  return scope;
}
