import mongoose, { Schema } from "mongoose";
export const STAFF_DESIGNATIONS = ["COLLEGE_ADMIN", "TPO", "HOD", "FACULTY"] as const;
export const SCOPE_TYPES = ["INSTITUTION", "DEPARTMENT", "PROGRAM", "BATCH", "SECTION"] as const;
export const MEMBERSHIP_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type StaffDesignation = (typeof STAFF_DESIGNATIONS)[number];
export type ScopeType = (typeof SCOPE_TYPES)[number];
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];
export interface InstitutionMembershipDoc { _id: number; userId: number; institutionId: number; designation: StaffDesignation; status: MembershipStatus; scopeType: ScopeType; scopeId?: number | null; acceptedAt?: Date | null; createdAt: Date; updatedAt: Date; }
const schema = new Schema<InstitutionMembershipDoc>({ _id: { type: Number, required: true }, userId: { type: Number, required: true }, institutionId: { type: Number, required: true }, designation: { type: String, enum: STAFF_DESIGNATIONS, required: true }, status: { type: String, enum: MEMBERSHIP_STATUSES, default: "ACTIVE", required: true }, scopeType: { type: String, enum: SCOPE_TYPES, required: true }, scopeId: { type: Number, default: null }, acceptedAt: { type: Date, default: null } }, { timestamps: true, versionKey: false, id: false, collection: "institution_memberships" });
schema.index({ userId: 1, institutionId: 1 }, { unique: true, name: "uk_memberships_user_institution" });
schema.index({ userId: 1, status: 1 }, { name: "idx_memberships_user_status" }); schema.index({ institutionId: 1, status: 1, designation: 1 }, { name: "idx_memberships_institution_status_designation" });
schema.index({ userId: 1 }, { unique: true, partialFilterExpression: { status: "ACTIVE" }, name: "uk_memberships_one_active_user" });
export const InstitutionMembership = (mongoose.models.InstitutionMembership as mongoose.Model<InstitutionMembershipDoc>) ?? mongoose.model<InstitutionMembershipDoc>("InstitutionMembership", schema);
