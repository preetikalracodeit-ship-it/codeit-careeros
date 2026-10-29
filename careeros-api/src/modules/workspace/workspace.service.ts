import type { ClientSession } from "mongoose";
import { College, type CollegeDoc } from "../../models/College.js";
import { User, STAFF_ROLES, type Role, type UserDoc } from "../../models/User.js";
import { StudentProfile, type StudentProfileDoc } from "../../models/StudentProfile.js";
import { AssessmentAttempt, type AssessmentAttemptDoc } from "../../models/AssessmentAttempt.js";
import { SkillScore, type SkillScoreDoc } from "../../models/SkillScore.js";
import { Skill } from "../../models/Skill.js";
import { getNextSequence } from "../../models/Counter.js";
import { withTransaction } from "../../lib/db.js";
import { hashPassword } from "../../lib/password.js";
import { AppError } from "../../lib/errors.js";
import type {
  BatchCreateInput,
  CollegeCreateInput,
  CollegeUpdateInput,
  DepartmentCreateInput,
  StaffCreateInput,
  StaffUpdateInput,
} from "./workspace.schemas.js";

export interface WorkspaceActor {
  id: number;
  email: string;
  fullName: string;
  role: Role;
  collegeId?: number | null;
  departmentId?: number | null;
}

const ROLE_PERMISSIONS: Record<Role, string[]> = {
  SUPER_ADMIN: [
    "colleges:create",
    "colleges:read",
    "colleges:update",
    "staff:read",
    "staff:manage",
    "students:read",
    "reports:read",
    "platform:monitor",
  ],
  COLLEGE_ADMIN: [
    "college:read",
    "college:update",
    "departments:manage",
    "batches:manage",
    "staff:read",
    "staff:manage",
    "students:read",
    "reports:read",
  ],
  TPO: ["students:read", "readiness:read", "reports:read", "placement:manage"],
  HOD: ["students:read", "readiness:read", "reports:read"],
  FACULTY: ["mentees:read", "improvement-plans:read"],
  STUDENT: ["profile:self", "results:self", "improvement-plan:self"],
};

const STAFF_ORDER = { COLLEGE_ADMIN: 0, TPO: 1, HOD: 2, FACULTY: 3 } as const;

function levelForScore(score: number): string {
  if (score >= 80) return "STRONG";
  if (score >= 65) return "GOOD";
  if (score >= 50) return "DEVELOPING";
  if (score >= 35) return "NEEDS_IMPROVEMENT";
  return "PRIORITY_GAP";
}

function departmentResponse(department: CollegeDoc["departments"][number]) {
  return {
    id: department.id,
    name: department.name,
    code: department.code,
    hodName: department.hodName ?? null,
  };
}

function batchResponse(batch: CollegeDoc["batches"][number]) {
  return {
    id: batch.id,
    name: batch.name,
    departmentId: batch.departmentId,
    year: batch.year,
  };
}

export function collegeResponse(college: CollegeDoc) {
  return {
    id: college._id,
    name: college.name,
    code: college.code,
    city: college.city ?? null,
    state: college.state ?? null,
    website: college.website ?? null,
    contactEmail: college.contactEmail ?? null,
    status: college.status,
    departments: college.departments.map(departmentResponse),
    batches: college.batches.map(batchResponse),
    departmentCount: college.departments.length,
    batchCount: college.batches.length,
    createdAt: college.createdAt.toISOString(),
    updatedAt: college.updatedAt.toISOString(),
  };
}

function staffResponse(user: UserDoc, collegeName?: string | null) {
  return {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    status: user.status,
    collegeId: user.collegeId ?? null,
    collegeName: collegeName ?? null,
    departmentId: user.departmentId ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

function studentResponse(profile: StudentProfileDoc, collegeName?: string | null) {
  return {
    id: profile._id,
    userId: profile.userId,
    studentId: profile.studentId,
    fullName: profile.fullName,
    mobile: profile.mobile ?? null,
    college: profile.college ?? null,
    collegeId: profile.collegeId ?? null,
    collegeName: collegeName ?? null,
    departmentId: profile.departmentId ?? null,
    degree: profile.degree ?? null,
    branch: profile.branch ?? null,
    graduationYear: profile.graduationYear ?? null,
    semester: profile.semester ?? null,
    targetCareerId: profile.targetCareerId ?? null,
    targetCareerName: profile.targetCareerName ?? null,
    createdAt: profile.createdAt.toISOString(),
  };
}

async function resolveCollege(actor: WorkspaceActor): Promise<CollegeDoc | null> {
  if (!actor.collegeId) return null;
  return College.findById(actor.collegeId).lean<CollegeDoc>();
}

function requireCollege(actor: WorkspaceActor, college: CollegeDoc | null): CollegeDoc {
  if (!college) {
    throw AppError.badRequest("No college workspace is assigned to this account");
  }
  return college;
}

function scopedCollegeId(actor: WorkspaceActor): number | null {
  if (actor.role === "SUPER_ADMIN") return null;
  return actor.collegeId ?? null;
}

async function studentFilter(actor: WorkspaceActor): Promise<Record<string, unknown>> {
  const collegeId = scopedCollegeId(actor);
  if (actor.role === "SUPER_ADMIN") return {};
  if (!collegeId) return { _id: { $in: [] as number[] } };
  const filter: Record<string, unknown> = { collegeId };
  if ((actor.role === "HOD" || actor.role === "FACULTY") && actor.departmentId) {
    filter.departmentId = actor.departmentId;
  }
  return filter;
}

async function collegeNames(ids: number[]): Promise<Map<number, string>> {
  if (!ids.length) return new Map();
  const colleges = await College.find({ _id: { $in: ids } }).select("_id name").lean<CollegeDoc[]>();
  return new Map(colleges.map((college) => [college._id, college.name]));
}

export async function getWorkspaceMe(actor: WorkspaceActor) {
  const college = await resolveCollege(actor);
  return {
    user: {
      id: actor.id,
      email: actor.email,
      fullName: actor.fullName,
      role: actor.role,
      collegeId: actor.collegeId ?? null,
      departmentId: actor.departmentId ?? null,
    },
    college: college ? collegeResponse(college) : null,
    department:
      college && actor.departmentId
        ? college.departments.filter((department) => department.id === actor.departmentId).map(departmentResponse)[0] ?? null
        : null,
    permissions: ROLE_PERMISSIONS[actor.role],
  };
}

async function strengthDistribution(attempts: AssessmentAttemptDoc[]) {
  const distribution = {
    STRONG: 0,
    GOOD: 0,
    DEVELOPING: 0,
    NEEDS_IMPROVEMENT: 0,
    PRIORITY_GAP: 0,
  };
  for (const attempt of attempts) {
    const score = attempt.overallScore ?? 0;
    distribution[levelForScore(score) as keyof typeof distribution] += 1;
  }
  return distribution;
}

async function readinessSnapshot(actor: WorkspaceActor) {
  const filter = await studentFilter(actor);
  const students = await StudentProfile.find(filter).select("userId").lean<StudentProfileDoc[]>();
  const userIds = students.map((student) => student.userId);
  const attempts = userIds.length
    ? await AssessmentAttempt.find({ userId: { $in: userIds }, status: "SUBMITTED" }).lean<AssessmentAttemptDoc[]>()
    : [];

  const latestByUser = new Map<number, AssessmentAttemptDoc>();
  for (const attempt of attempts) {
    const current = latestByUser.get(attempt.userId);
    if (!current || new Date(attempt.startedAt) > new Date(current.startedAt)) {
      latestByUser.set(attempt.userId, attempt);
    }
  }
  const latest = [...latestByUser.values()];
  const scores = latest
    .map((attempt) => attempt.overallScore)
    .filter((score): score is number => typeof score === "number");
  const averageScore = scores.length
    ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length)
    : 0;

  const attemptIds = latest.map((attempt) => attempt._id);
  const skillScores = attemptIds.length
    ? await SkillScore.find({ attemptId: { $in: attemptIds } }).lean<SkillScoreDoc[]>()
    : [];
  const skillIds = [...new Set(skillScores.map((score) => score.skillId))];
  const skills = skillIds.length
    ? await Skill.find({ _id: { $in: skillIds } }).lean<{ _id: number; name: string; category: string }[]>()
    : [];
  const skillById = new Map(skills.map((skill) => [skill._id, skill]));

  const grouped = new Map<number, { total: number; count: number; target: number }>();
  for (const score of skillScores) {
    const current = grouped.get(score.skillId) ?? { total: 0, count: 0, target: score.targetPercent };
    current.total += score.scorePercent;
    current.count += 1;
    current.target = Math.max(current.target, score.targetPercent);
    grouped.set(score.skillId, current);
  }
  const skillGaps = [...grouped.entries()]
    .map(([skillId, value]) => {
      const skill = skillById.get(skillId);
      const average = Math.round(value.total / Math.max(value.count, 1));
      return {
        skillId,
        skillName: skill?.name ?? `Skill ${skillId}`,
        skillCategory: skill?.category ?? "General",
        averageScore: average,
        targetPercent: value.target,
        gapPercent: Math.max(0, value.target - average),
        level: levelForScore(average),
      };
    })
    .sort((left, right) => right.gapPercent - left.gapPercent)
    .slice(0, 8);

  return {
    studentCount: students.length,
    assessedStudentCount: latest.length,
    averageScore,
    distribution: await strengthDistribution(latest),
    skillGaps,
  };
}

export async function getSummary(actor: WorkspaceActor) {
  if (actor.role === "SUPER_ADMIN") {
    const [colleges, roleRows, studentCount] = await Promise.all([
      College.find().sort({ createdAt: -1 }).lean<CollegeDoc[]>(),
      User.aggregate<{ _id: string; count: number }>([{ $group: { _id: "$role", count: { $sum: 1 } } }]),
      StudentProfile.countDocuments(),
    ]);
    const roleCounts = Object.fromEntries(roleRows.map((row) => [row._id, row.count]));
    return {
      role: actor.role,
      stats: {
        colleges: colleges.length,
        activeColleges: colleges.filter((college) => college.status === "ACTIVE").length,
        onboardingColleges: colleges.filter((college) => college.status === "ONBOARDING").length,
        students: studentCount,
        collegeAdmins: roleCounts.COLLEGE_ADMIN ?? 0,
        tpos: roleCounts.TPO ?? 0,
        hods: roleCounts.HOD ?? 0,
        faculty: roleCounts.FACULTY ?? 0,
      },
      recentColleges: colleges.slice(0, 6).map(collegeResponse),
    };
  }

  const college = requireCollege(actor, await resolveCollege(actor));
  const collegeId = college._id;
  const [studentCount, staff, readiness] = await Promise.all([
    StudentProfile.countDocuments({ collegeId }),
    User.find({ collegeId, role: { $in: STAFF_ROLES } }).sort({ role: 1, fullName: 1 }).lean<UserDoc[]>(),
    readinessSnapshot(actor),
  ]);
  const staffByRole = Object.fromEntries(
    STAFF_ROLES.map((role) => [role, staff.filter((member) => member.role === role).length]),
  );
  const department =
    actor.departmentId
      ? college.departments.find((item) => item.id === actor.departmentId) ?? null
      : null;

  return {
    role: actor.role,
    college: collegeResponse(college),
    department: department ? departmentResponse(department) : null,
    stats: {
      students: studentCount,
      staff: staff.length,
      departments: college.departments.length,
      batches: college.batches.length,
      ...staffByRole,
      assessedStudents: readiness.assessedStudentCount,
      averageReadiness: readiness.averageScore,
    },
    readiness: {
      ...readiness,
      studentCount,
    },
    staff: staff.slice(0, 8).map((member) => staffResponse(member, college.name)),
  };
}

export async function listColleges() {
  const colleges = await College.find().sort({ createdAt: -1 }).lean<CollegeDoc[]>();
  const ids = colleges.map((college) => college._id);
  const [studentRows, staffRows] = await Promise.all([
    ids.length
      ? StudentProfile.aggregate<{ _id: number; count: number }>([
          { $match: { collegeId: { $in: ids } } },
          { $group: { _id: "$collegeId", count: { $sum: 1 } } },
        ])
      : Promise.resolve([]),
    ids.length
      ? User.aggregate<{ _id: number; count: number }>([
          { $match: { collegeId: { $in: ids }, role: { $in: STAFF_ROLES } } },
          { $group: { _id: "$collegeId", count: { $sum: 1 } } },
        ])
      : Promise.resolve([]),
  ]);
  const studentCounts = new Map(studentRows.map((row) => [row._id, row.count]));
  const staffCounts = new Map(staffRows.map((row) => [row._id, row.count]));
  return colleges.map((college) => ({
    ...collegeResponse(college),
    studentCount: studentCounts.get(college._id) ?? 0,
    staffCount: staffCounts.get(college._id) ?? 0,
  }));
}

export async function getCollege(collegeId: number) {
  const college = await College.findById(collegeId).lean<CollegeDoc>();
  if (!college) throw AppError.notFound("College workspace not found");
  const [studentCount, staff] = await Promise.all([
    StudentProfile.countDocuments({ collegeId }),
    User.find({ collegeId, role: { $in: STAFF_ROLES } }).lean<UserDoc[]>(),
  ]);
  return {
    ...collegeResponse(college),
    studentCount,
    staffCount: staff.length,
    staff: staff
      .sort((left, right) => STAFF_ORDER[left.role as keyof typeof STAFF_ORDER] - STAFF_ORDER[right.role as keyof typeof STAFF_ORDER])
      .map((member) => staffResponse(member, college.name)),
  };
}

export async function createCollege(input: CollegeCreateInput, _actor: WorkspaceActor) {
  const code = input.code.trim().toUpperCase();
  if (await College.exists({ code })) {
    throw AppError.conflict("A college with this code already exists");
  }
  return withTransaction(async (session) => {
    const collegeId = await getNextSequence("colleges", session);
    const [college] = await College.create(
      [
        {
          _id: collegeId,
          name: input.name.trim(),
          code,
          city: input.city?.trim() || null,
          state: input.state?.trim() || null,
          website: input.website?.trim() || null,
          contactEmail: input.contactEmail?.trim().toLowerCase() || null,
          status: input.status ?? "ONBOARDING",
          departments: [],
          batches: [],
        },
      ],
      { session },
    );
    return collegeResponse(college);
  });
}

export async function updateCollege(collegeId: number, input: CollegeUpdateInput) {
  const college = await College.findById(collegeId);
  if (!college) throw AppError.notFound("College workspace not found");
  if (input.code) {
    const code = input.code.trim().toUpperCase();
    const duplicate = await College.exists({ code, _id: { $ne: collegeId } });
    if (duplicate) throw AppError.conflict("A college with this code already exists");
    college.code = code;
  }
  if (input.name !== undefined) college.name = input.name.trim();
  if (input.city !== undefined) college.city = input.city?.trim() || null;
  if (input.state !== undefined) college.state = input.state?.trim() || null;
  if (input.website !== undefined) college.website = input.website?.trim() || null;
  if (input.contactEmail !== undefined) {
    college.contactEmail = input.contactEmail?.trim().toLowerCase() || null;
  }
  if (input.status !== undefined) college.status = input.status;
  await college.save();
  return collegeResponse(college);
}

export async function addDepartment(collegeId: number, input: DepartmentCreateInput) {
  const college = await College.findById(collegeId);
  if (!college) throw AppError.notFound("College workspace not found");
  const code = input.code.trim().toUpperCase();
  if (college.departments.some((department) => department.code.toUpperCase() === code)) {
    throw AppError.conflict("This department code already exists in the college");
  }
  const id = await getNextSequence("college_departments");
  college.departments.push({
    id,
    name: input.name.trim(),
    code,
    hodName: input.hodName?.trim() || null,
  });
  await college.save();
  return collegeResponse(college);
}

export async function addBatch(collegeId: number, input: BatchCreateInput) {
  const college = await College.findById(collegeId);
  if (!college) throw AppError.notFound("College workspace not found");
  if (!college.departments.some((department) => department.id === input.departmentId)) {
    throw AppError.badRequest("The selected department does not belong to this college");
  }
  const id = await getNextSequence("college_batches");
  college.batches.push({
    id,
    name: input.name.trim(),
    departmentId: input.departmentId,
    year: input.year,
  });
  await college.save();
  return collegeResponse(college);
}

export async function listStaff(actor: WorkspaceActor) {
  const collegeId = scopedCollegeId(actor);
  const filter: Record<string, unknown> = { role: { $in: STAFF_ROLES } };
  if (collegeId !== null) filter.collegeId = collegeId;
  const staff = await User.find(filter).sort({ role: 1, fullName: 1 }).lean<UserDoc[]>();
  const names = await collegeNames([
    ...new Set(staff.map((member) => member.collegeId).filter((id): id is number => typeof id === "number")),
  ]);
  return staff.map((member) =>
    staffResponse(member, member.collegeId ? names.get(member.collegeId) ?? null : null),
  );
}

export async function createStaff(actor: WorkspaceActor, input: StaffCreateInput) {
  const email = input.email.trim().toLowerCase();
  if (await User.exists({ emailLower: email })) {
    throw AppError.conflict("An account with this email already exists");
  }
  let collegeId: number | null;
  if (actor.role === "SUPER_ADMIN") {
    collegeId = input.collegeId ?? actor.collegeId ?? null;
    if (collegeId === null) {
      const firstCollege = await College.findOne().sort({ createdAt: 1 }).lean<CollegeDoc>();
      collegeId = firstCollege?._id ?? null;
    }
  } else {
    collegeId = actor.collegeId ?? null;
  }
  if (collegeId === null) {
    throw AppError.badRequest("Create a college workspace before adding staff");
  }
  const college = await College.findById(collegeId).lean<CollegeDoc>();
  if (!college) throw AppError.badRequest("The college workspace could not be found");
  if (input.departmentId && !college.departments.some((item) => item.id === input.departmentId)) {
    throw AppError.badRequest("The selected department does not belong to this college");
  }

  return withTransaction(async (session: ClientSession) => {
    const userId = await getNextSequence("users", session);
    const [user] = await User.create(
      [
        {
          _id: userId,
          email,
          emailLower: email,
          passwordHash: await hashPassword(input.password),
          fullName: input.fullName.trim(),
          role: input.role,
          status: "ACTIVE",
          collegeId,
          departmentId: input.departmentId ?? null,
        },
      ],
      { session },
    );
    return staffResponse(user, college.name);
  });
}

export async function updateStaff(actor: WorkspaceActor, staffId: number, input: StaffUpdateInput) {
  const staff = await User.findById(staffId);
  if (!staff || !STAFF_ROLES.includes(staff.role as (typeof STAFF_ROLES)[number])) {
    throw AppError.notFound("Staff member not found");
  }
  if (actor.role !== "SUPER_ADMIN" && staff.collegeId !== actor.collegeId) {
    throw AppError.forbidden("You cannot manage staff outside your college");
  }
  if (input.role !== undefined) staff.role = input.role;
  if (input.status !== undefined) staff.status = input.status;
  if (input.departmentId !== undefined) staff.departmentId = input.departmentId;
  await staff.save();
  return staffResponse(staff);
}

export async function listStudents(actor: WorkspaceActor) {
  const filter = await studentFilter(actor);
  const students = await StudentProfile.find(filter).sort({ fullName: 1 }).lean<StudentProfileDoc[]>();
  const names = await collegeNames([
    ...new Set(students.map((student) => student.collegeId).filter((id): id is number => typeof id === "number")),
  ]);
  return students.map((student) =>
    studentResponse(student, student.collegeId ? names.get(student.collegeId) ?? null : null),
  );
}

export async function getStudent(actor: WorkspaceActor, studentId: number) {
  const student = await StudentProfile.findById(studentId).lean<StudentProfileDoc>();
  if (!student) throw AppError.notFound("Student not found");
  if (actor.role !== "SUPER_ADMIN" && student.collegeId !== actor.collegeId) {
    throw AppError.forbidden("You cannot view students outside your college");
  }
  const college = student.collegeId ? await College.findById(student.collegeId).select("name").lean<CollegeDoc>() : null;
  const attempts = await AssessmentAttempt.find({ userId: student.userId, status: "SUBMITTED" })
    .sort({ startedAt: -1 })
    .limit(10)
    .lean<AssessmentAttemptDoc[]>();
  return {
    ...studentResponse(student, college?.name ?? null),
    attempts: attempts.map((attempt) => ({
      id: attempt._id,
      assessmentId: attempt.assessmentId,
      overallScore: attempt.overallScore ?? null,
      submittedAt: attempt.submittedAt ? attempt.submittedAt.toISOString() : null,
    })),
  };
}

export async function getReadinessOverview(actor: WorkspaceActor) {
  const readiness = await readinessSnapshot(actor);
  return readiness;
}

export async function listSkillGaps(actor: WorkspaceActor) {
  const readiness = await readinessSnapshot(actor);
  return readiness.skillGaps;
}

export async function listMentees(actor: WorkspaceActor) {
  if (actor.role === "FACULTY" || actor.role === "HOD") {
    return listStudents(actor);
  }
  return listStaff(actor);
}

export async function getDepartmentWorkspace(actor: WorkspaceActor) {
  const college = requireCollege(actor, await resolveCollege(actor));
  const department = actor.departmentId
    ? college.departments.find((item) => item.id === actor.departmentId) ?? null
    : null;
  const batches = department
    ? college.batches.filter((batch) => batch.departmentId === department.id)
    : college.batches;
  const staff = await User.find({
    collegeId: college._id,
    ...(department ? { departmentId: department.id } : {}),
    role: { $in: STAFF_ROLES },
  }).lean<UserDoc[]>();
  const studentFilterQuery: Record<string, unknown> = { collegeId: college._id };
  if (department) studentFilterQuery.departmentId = department.id;
  const studentCount = await StudentProfile.countDocuments(studentFilterQuery);
  return {
    college: collegeResponse(college),
    department: department ? departmentResponse(department) : null,
    batches: batches.map(batchResponse),
    departments: college.departments.map(departmentResponse),
    staff: staff.map((member) => staffResponse(member, college.name)),
    studentCount,
  };
}

export async function listPlacementDrives(_actor: WorkspaceActor) {
  return {
    drives: [],
    note: "Placement drives and application tracking arrive in a later phase.",
  };
}
