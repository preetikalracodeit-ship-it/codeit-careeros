import { env } from "../config/env.js";
import { connectDatabase, disconnectDatabase, ensureIndexes } from "../lib/db.js";
import { hashPassword } from "../lib/password.js";
import { logger } from "../lib/logger.js";
import { getNextSequence } from "../models/Counter.js";
import { College, type CollegeDoc } from "../models/College.js";
import { User, type Role, type UserDoc } from "../models/User.js";
import { StudentProfile } from "../models/StudentProfile.js";
import { Skill } from "../models/Skill.js";
import { Career } from "../models/Career.js";
import { CareerSkill } from "../models/CareerSkill.js";
import { AssessmentTest } from "../models/AssessmentTest.js";
import { AssessmentAttempt } from "../models/AssessmentAttempt.js";
import { SkillScore } from "../models/SkillScore.js";
import { CvDocument } from "../models/CvDocument.js";
import { ImprovementPlan } from "../models/ImprovementPlan.js";
import { ImprovementTask, type TaskPriority, type TaskStatus } from "../models/ImprovementTask.js";
import { PlacementDrive } from "../models/PlacementDrive.js";
import { PlacementApplication } from "../models/PlacementApplication.js";
import { AiChatSession } from "../models/AiChatSession.js";
import { AiChatMessage } from "../models/AiChatMessage.js";
import { buildPdf } from "../lib/pdf.js";
import { extractPdfText } from "../lib/cv-text.js";

const DEMO_PASSWORD = "DemoPass123";
const COLLEGE_CODE = "NIT-DEMO";

interface DemoUser {
  email: string;
  fullName: string;
  role: Role;
  departmentCode?: string;
  studentScore?: number;
}

const staffUsers: DemoUser[] = [
  { email: "superadmin@careeros.dev", fullName: "Platform Super Admin", role: "SUPER_ADMIN" },
  { email: "collegeadmin@careeros.dev", fullName: "Priya Nair", role: "COLLEGE_ADMIN", departmentCode: "CSE" },
  { email: "tpo@careeros.dev", fullName: "Rahul Verma", role: "TPO" },
  { email: "hod@careeros.dev", fullName: "Dr. Anjali Rao", role: "HOD", departmentCode: "CSE" },
  { email: "faculty@careeros.dev", fullName: "Prof. Vikram Shah", role: "FACULTY", departmentCode: "CSE" },
];

const students: DemoUser[] = [
  { email: "student@careeros.dev", fullName: "Aarav Mehta", role: "STUDENT", studentScore: 82 },
  { email: "diya.patel@careeros.dev", fullName: "Diya Patel", role: "STUDENT", studentScore: 68 },
  { email: "kabir.singh@careeros.dev", fullName: "Kabir Singh", role: "STUDENT", studentScore: 54 },
  { email: "meera.iyer@careeros.dev", fullName: "Meera Iyer", role: "STUDENT", studentScore: 41 },
  { email: "rohan.das@careeros.dev", fullName: "Rohan Das", role: "STUDENT", studentScore: 76 },
  { email: "sara.khan@careeros.dev", fullName: "Sara Khan", role: "STUDENT", studentScore: 33 },
];

const skills = [
  { name: "Problem Solving", category: "Aptitude" },
  { name: "Communication", category: "Soft Skills" },
  { name: "JavaScript", category: "Programming" },
  { name: "Data Structures", category: "Computer Science" },
  { name: "SQL", category: "Data" },
  { name: "System Design", category: "Engineering" },
];

const careers = [
  {
    name: "Software Engineer",
    category: "Technology",
    difficultyLevel: "INTERMEDIATE",
    description: "Builds and maintains software products across the stack.",
    weights: [
      { name: "Problem Solving", weightPercent: 25, targetPercent: 75 },
      { name: "JavaScript", weightPercent: 25, targetPercent: 80 },
      { name: "Data Structures", weightPercent: 20, targetPercent: 70 },
      { name: "Communication", weightPercent: 15, targetPercent: 65 },
      { name: "System Design", weightPercent: 15, targetPercent: 60 },
    ],
  },
  {
    name: "Data Analyst",
    category: "Data",
    difficultyLevel: "BEGINNER",
    description: "Turns data into decisions using SQL, statistics, and storytelling.",
    weights: [
      { name: "SQL", weightPercent: 35, targetPercent: 80 },
      { name: "Problem Solving", weightPercent: 25, targetPercent: 70 },
      { name: "Communication", weightPercent: 25, targetPercent: 75 },
      { name: "Data Structures", weightPercent: 15, targetPercent: 55 },
    ],
  },
];

async function ensureCollege(): Promise<CollegeDoc> {
  let college = await College.findOne({ code: COLLEGE_CODE });
  if (!college) {
    const id = await getNextSequence("colleges");
    college = await College.create({
      _id: id,
      name: "Northfield Institute of Technology",
      code: COLLEGE_CODE,
      city: "Bengaluru",
      state: "Karnataka",
      website: "https://northfield.example.edu",
      contactEmail: "admin@northfield.example.edu",
      status: "ACTIVE",
      departments: [],
      batches: [],
    });
  }

  const ensureDepartment = async (name: string, code: string, hodName: string) => {
    let department = college!.departments.find((item) => item.code === code);
    if (!department) {
      const id = await getNextSequence("college_departments");
      college!.departments.push({ id, name, code, hodName });
      await college!.save();
      department = college!.departments.find((item) => item.code === code)!;
    }
    return department;
  };

  const cse = await ensureDepartment("Computer Science", "CSE", "Dr. Anjali Rao");
  const ece = await ensureDepartment("Electronics", "ECE", "Dr. Sanjay Kulkarni");

  const ensureBatch = async (name: string, departmentId: number, year: number) => {
    if (!college!.batches.some((batch) => batch.name === name)) {
      const id = await getNextSequence("college_batches");
      college!.batches.push({ id, name, departmentId, year });
      await college!.save();
    }
  };

  await ensureBatch("CSE 2022-2026", cse.id, 2022);
  await ensureBatch("CSE 2023-2027", cse.id, 2023);
  await ensureBatch("ECE 2022-2026", ece.id, 2022);

  return college.toObject() as CollegeDoc;
}

async function ensureUser(
  demo: DemoUser,
  college: CollegeDoc | null,
  departmentId: number | null,
): Promise<UserDoc> {
  const email = demo.email.toLowerCase();
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const existing = await User.findOne({ emailLower: email });
  if (existing) {
    existing.fullName = demo.fullName;
    existing.role = demo.role;
    existing.status = "ACTIVE";
    existing.collegeId = college?._id ?? null;
    existing.departmentId = departmentId;
    existing.passwordHash = passwordHash;
    await existing.save();
    return existing.toObject() as UserDoc;
  }
  const id = await getNextSequence("users");
  const user = await User.create({
    _id: id,
    email,
    emailLower: email,
    passwordHash,
    fullName: demo.fullName,
    role: demo.role,
    status: "ACTIVE",
    collegeId: college?._id ?? null,
    departmentId,
  });
  return user.toObject() as UserDoc;
}

async function ensureSkills() {
  const byName = new Map<string, number>();
  for (const skill of skills) {
    let record = await Skill.findOne({ name: skill.name });
    if (!record) {
      const id = await getNextSequence("skills");
      record = await Skill.create({
        _id: id,
        name: skill.name,
        category: skill.category,
        description: `${skill.name} proficiency`,
        active: true,
      });
    }
    byName.set(skill.name, record._id);
  }
  return byName;
}

async function ensureCareers(skillIds: Map<string, number>) {
  const byName = new Map<string, { id: number; assessmentId: number }>();
  for (const career of careers) {
    let record = await Career.findOne({ name: career.name });
    if (!record) {
      const id = await getNextSequence("careers");
      record = await Career.create({
        _id: id,
        name: career.name,
        description: career.description,
        category: career.category,
        difficultyLevel: career.difficultyLevel,
        published: true,
      });
    }
    for (const mapping of career.weights) {
      const skillId = skillIds.get(mapping.name);
      if (!skillId) continue;
      await CareerSkill.updateOne(
        { careerId: record._id, skillId },
        {
          $setOnInsert: {
            _id: await getNextSequence("career_skills"),
            careerId: record._id,
            skillId,
            weightPercent: mapping.weightPercent,
            requiredLevel: "INTERMEDIATE",
            targetPercent: mapping.targetPercent,
          },
        },
        { upsert: true },
      );
    }
    let assessment = await AssessmentTest.findOne({ careerId: record._id });
    if (!assessment) {
      const id = await getNextSequence("assessment_tests");
      assessment = await AssessmentTest.create({
        _id: id,
        careerId: record._id,
        title: `${career.name} Readiness Assessment`,
        description: `Baseline readiness assessment for ${career.name}.`,
        durationMinutes: 30,
        published: true,
      });
    }
    byName.set(career.name, { id: record._id, assessmentId: assessment._id });
  }
  return byName;
}

async function ensureStudentProfile(
  user: UserDoc,
  college: CollegeDoc,
  departmentId: number,
  batchId: number,
  targetCareerId: number,
  targetCareerName: string,
) {
  const department = college.departments.find((item) => item.id === departmentId);
  const existing = await StudentProfile.findOne({ userId: user._id });
  const payload = {
    fullName: user.fullName,
    mobile: "9876543210",
    college: college.name,
    collegeId: college._id,
    departmentId,
    batchId,
    degree: "B.Tech",
    branch: department?.name ?? "Computer Science",
    graduationYear: 2026,
    semester: 6,
    location: "Bengaluru",
    targetCareerId,
    targetCareerName,
  };
  if (existing) {
    await StudentProfile.updateOne({ _id: existing._id }, { $set: payload });
    return existing._id;
  }
  const id = await getNextSequence("student_profiles");
  await StudentProfile.create({
    _id: id,
    userId: user._id,
    studentId: `STU${String(user._id).padStart(6, "0")}`,
    ...payload,
  });
  return id;
}

async function seedAssessmentResult(
  user: UserDoc,
  assessmentId: number,
  skillIds: Map<string, number>,
  overallScore: number,
) {
  const existing = await AssessmentAttempt.findOne({
    userId: user._id,
    assessmentId,
    status: "SUBMITTED",
  });
  if (existing) return;
  const attemptId = await getNextSequence("assessment_attempts");
  const startedAt = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const submittedAt = new Date(startedAt.getTime() + 25 * 60 * 1000);
  await AssessmentAttempt.create({
    _id: attemptId,
    attemptCode: `DEMO-${String(user._id).padStart(4, "0")}-${attemptId}`,
    userId: user._id,
    assessmentId,
    status: "SUBMITTED",
    startedAt,
    expiresAt: new Date(startedAt.getTime() + 30 * 60 * 1000),
    submittedAt,
    totalQuestions: 20,
    answeredCount: 20,
    overallScore,
  });
  const skillEntries = [...skillIds.entries()];
  let index = 0;
  for (const [skillName, skillId] of skillEntries) {
    const drift = ((index % 3) - 1) * 11;
    const score = Math.max(10, Math.min(100, overallScore + drift));
    await SkillScore.create({
      _id: await getNextSequence("skill_scores"),
      attemptId,
      skillId,
      scorePercent: score,
      correctCount: Math.round((score / 100) * 5),
      questionCount: 5,
      weightPercent: 100 / skillEntries.length,
      targetPercent: skillName === "System Design" ? 60 : 75,
      level: score >= 80 ? "STRONG" : score >= 65 ? "GOOD" : score >= 50 ? "DEVELOPING" : "NEEDS_IMPROVEMENT",
    });
    index += 1;
  }
}

async function ensureCv(user: UserDoc): Promise<void> {
  const existing = await CvDocument.findOne({ userId: user._id }).lean();
  if (existing) return;
  const bytes = buildPdf("Aarav Mehta", "Software Engineer - Bengaluru, India", (doc) => {
    doc.keyValue("Email", "student@careeros.dev");
    doc.keyValue("Phone", "+91 98765 43210");
    doc.keyValue("Location", "Bengaluru, Karnataka");
    doc.heading("Professional Summary");
    doc.text("Motivated final-year Computer Science student seeking a software engineering role. I build full-stack JavaScript applications, enjoy solving data-structure problems, and communicate clearly with cross-functional teams.");
    doc.heading("Technical Skills");
    doc.text("JavaScript, React, Node.js, SQL, Data Structures, Problem Solving, System Design fundamentals, Git, Docker, MongoDB");
    doc.heading("Experience");
    doc.bullet("Software Engineering Intern at Northfield Labs (2025 - Present): built REST APIs with Node.js and reduced page load time by 28%.");
    doc.bullet("Teaching Assistant for Data Structures (2024): mentored 40 juniors through weekly problem-solving sessions.");
    doc.heading("Projects");
    doc.bullet("CampusHire: full-stack placement portal with React, Node.js and MongoDB; used by 600+ students.");
    doc.bullet("SkillGraph: visualises career skill gaps using SQL analytics and an interactive dashboard.");
    doc.bullet("ChatAssist: offline guidance assistant that answers student questions from structured career data.");
    doc.heading("Education");
    doc.text("B.Tech in Computer Science, Northfield Institute of Technology, Bengaluru - 2022 to 2026. CGPA 8.6/10.");
    doc.heading("Certifications");
    doc.bullet("Meta Front-End Developer Professional Certificate (Coursera)");
    doc.bullet("SQL for Data Science (NPTEL)");
  });
  const text = extractPdfText(bytes);
  await CvDocument.create({
    _id: await getNextSequence("cv_documents"),
    userId: user._id,
    originalFilename: "Aarav-Mehta-CV.pdf",
    contentType: "application/pdf",
    fileSize: bytes.length,
    status: "PARSED",
    candidateName: "Aarav Mehta",
    candidateEmail: "student@careeros.dev",
    candidatePhone: "+91 98765 43210",
    extractedText: text,
    fileData: bytes,
    uploadedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  });
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

async function ensureImprovementPlan(
  user: UserDoc,
  studentProfileId: number,
  targetCareerId: number,
  targetCareerName: string,
  skillIds: Map<string, number>,
): Promise<void> {
  const existing = await ImprovementPlan.findOne({ studentProfileId }).lean();
  if (existing) return;
  const planId = await getNextSequence("improvement_plans");
  await ImprovementPlan.create({
    _id: planId,
    studentProfileId,
    userId: user._id,
    title: `${targetCareerName} readiness improvement plan`,
    summary: "Focused plan to close the highest-priority gaps before the placement season.",
    status: "ACTIVE",
    targetCareerId,
    targetCareerName,
    createdByName: "Prof. Vikram Shah",
  });
  const tasks: Array<{
    title: string;
    description: string;
    skillName: string;
    priority: TaskPriority;
    status: TaskStatus;
    targetDate: Date;
    baselineScore: number;
    targetScore: number;
  }> = [
    {
      title: "Complete 20 medium data-structure problems",
      description: "Cover arrays, hash maps, stacks and trees. Write down the pattern used for each problem.",
      skillName: "Data Structures",
      priority: "HIGH",
      status: "IN_PROGRESS",
      targetDate: daysFromNow(7),
      baselineScore: 68,
      targetScore: 80,
    },
    {
      title: "Build and deploy a full-stack project",
      description: "Extend CampusHire with an interview scheduling flow and deploy the updated build.",
      skillName: "JavaScript",
      priority: "HIGH",
      status: "NOT_STARTED",
      targetDate: daysFromNow(-2),
      baselineScore: 74,
      targetScore: 85,
    },
    {
      title: "Mock system design interview",
      description: "Practise designing a URL shortener with a mentor and review the feedback notes.",
      skillName: "System Design",
      priority: "MEDIUM",
      status: "COMPLETED",
      targetDate: daysFromNow(-10),
      baselineScore: 58,
      targetScore: 70,
    },
  ];
  for (const task of tasks) {
    await ImprovementTask.create({
      _id: await getNextSequence("improvement_tasks"),
      planId,
      ...task,
      skillId: skillIds.get(task.skillName) ?? null,
      ownerName: "Aarav Mehta",
      completedAt: task.status === "COMPLETED" ? daysFromNow(-9) : null,
    });
  }
}

async function ensurePlacementData(
  college: CollegeDoc,
  user: UserDoc,
  studentProfileId: number,
  departmentId: number,
  batchId: number,
): Promise<void> {
  const driveSeeds = [
    {
      name: "Northfield Software Engineer Drive 2026",
      companyName: "Northfield Labs",
      jobTitle: "Software Engineer",
      location: "Bengaluru",
      description: "Full-time software engineering role building customer-facing web products.",
      eligibilityCriteria: "CSE 2026 batch, minimum 60% readiness, no active backlogs.",
      registrationStart: daysFromNow(-10),
      registrationEnd: daysFromNow(12),
      driveDate: daysFromNow(21),
      minimumReadinessPercent: 60,
      status: "REGISTRATION_OPEN" as const,
    },
    {
      name: "QuantEdge Data Analyst Drive 2026",
      companyName: "QuantEdge Analytics",
      jobTitle: "Data Analyst",
      location: "Pune",
      description: "Analyst role focused on SQL, dashboards and business storytelling.",
      eligibilityCriteria: "CSE 2026 batch, minimum 55% readiness.",
      registrationStart: daysFromNow(-30),
      registrationEnd: daysFromNow(-5),
      driveDate: daysFromNow(4),
      minimumReadinessPercent: 55,
      status: "ONGOING" as const,
    },
  ];
  const driveIds: number[] = [];
  for (const seed of driveSeeds) {
    let drive = await PlacementDrive.findOne({ collegeId: college._id, name: seed.name });
    if (!drive) {
      drive = await PlacementDrive.create({
        _id: await getNextSequence("placement_drives"),
        collegeId: college._id,
        ...seed,
        eligibleDepartmentId: departmentId,
        eligibleBatchId: batchId,
        eligibleGraduationYear: 2026,
      });
    }
    driveIds.push(drive._id);
  }

  const existing = await PlacementApplication.findOne({ driveId: driveIds[0], studentProfileId }).lean();
  if (!existing) {
    const applicationId = await getNextSequence("placement_applications");
    await PlacementApplication.create({
      _id: applicationId,
      driveId: driveIds[0]!,
      userId: user._id,
      studentProfileId,
      collegeId: college._id,
      stage: "TECHNICAL_INTERVIEW",
      eligibilityOverride: false,
      appliedAt: daysFromNow(-8),
      history: [
        { id: await getNextSequence("placement_stage_events"), stage: "REGISTERED", note: "Student registered", recordedAt: daysFromNow(-8) },
        { id: await getNextSequence("placement_stage_events"), stage: "APPLIED", note: "Profile shortlisted", recordedAt: daysFromNow(-6) },
        { id: await getNextSequence("placement_stage_events"), stage: "TECHNICAL_INTERVIEW", note: "Technical round scheduled", recordedAt: daysFromNow(-2) },
      ],
      offer: null,
    });
  }

  const offeredExisting = await PlacementApplication.findOne({ driveId: driveIds[1], studentProfileId }).lean();
  if (!offeredExisting) {
    await PlacementApplication.create({
      _id: await getNextSequence("placement_applications"),
      driveId: driveIds[1]!,
      userId: user._id,
      studentProfileId,
      collegeId: college._id,
      stage: "OFFERED",
      eligibilityOverride: false,
      appliedAt: daysFromNow(-25),
      history: [
        { id: await getNextSequence("placement_stage_events"), stage: "REGISTERED", note: "Student registered", recordedAt: daysFromNow(-25) },
        { id: await getNextSequence("placement_stage_events"), stage: "ASSESSMENT", note: "Cleared online assessment", recordedAt: daysFromNow(-18) },
        { id: await getNextSequence("placement_stage_events"), stage: "OFFERED", note: "Offer released", recordedAt: daysFromNow(-3) },
      ],
      offer: {
        id: await getNextSequence("placement_offers"),
        packageAmount: 850000,
        currency: "INR",
        offerDate: daysFromNow(-3),
        status: "PENDING",
        joinedAt: null,
        notes: "Respond within 7 days.",
      },
    });
  }
}

async function ensureAiConversation(user: UserDoc): Promise<void> {
  const existing = await AiChatSession.findOne({ userId: user._id, title: "Roadmap planning" }).lean();
  if (existing) return;
  const sessionId = await getNextSequence("ai_chat_sessions");
  await AiChatSession.create({
    _id: sessionId,
    userId: user._id,
    title: "Roadmap planning",
  });
  const createdAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  await AiChatMessage.create({
    _id: await getNextSequence("ai_chat_messages"),
    sessionId,
    userId: user._id,
    role: "USER",
    content: "What should I learn next for my target career?",
    createdAt,
  });
  await AiChatMessage.create({
    _id: await getNextSequence("ai_chat_messages"),
    sessionId,
    userId: user._id,
    role: "ASSISTANT",
    content: [
      "**Your roadmap for Software Engineer**",
      "",
      "You have completed **3 of 12 steps (25%)**, with 2 in progress.",
      "",
      "**Suggested next steps**",
      "- Strengthen Data Structures with 20 medium problems (Foundation)",
      "- Build and deploy a full-stack project (Portfolio)",
      "- Practise a system design mock interview (Interview readiness)",
      "",
      "Start with the skill you scored lowest on, then use a project to prove the improvement.",
    ].join("\n"),
    createdAt: new Date(createdAt.getTime() + 4000),
  });
}

async function main(): Promise<void> {
  await connectDatabase(env.MONGODB_URI);
  await ensureIndexes();

  const college = await ensureCollege();
  const cse = college.departments.find((item) => item.code === "CSE")!;
  const cseBatch = college.batches.find((batch) => batch.departmentId === cse.id)!;

  await ensureUser(staffUsers[0], null, null);
  for (const demo of staffUsers.slice(1)) {
    const departmentId =
      demo.departmentCode === "CSE" ? cse.id : null;
    await ensureUser(demo, college, departmentId);
  }

  const skillIds = await ensureSkills();
  const careerByName = await ensureCareers(skillIds);
  const software = careerByName.get("Software Engineer")!;

  for (const demo of students) {
    const user = await ensureUser(demo, college, cse.id);
    const studentProfileId = await ensureStudentProfile(
      user,
      college,
      cse.id,
      cseBatch.id,
      software.id,
      "Software Engineer",
    );
    await seedAssessmentResult(user, software.assessmentId, skillIds, demo.studentScore ?? 60);
    if (demo.email === "student@careeros.dev") {
      await ensureCv(user);
      await ensureImprovementPlan(user, studentProfileId, software.id, "Software Engineer", skillIds);
      await ensurePlacementData(college, user, studentProfileId, cse.id, cseBatch.id);
      await ensureAiConversation(user);
    }
  }

  logger.info(
    {
      college: college.name,
      staff: staffUsers.length,
      students: students.length,
      password: DEMO_PASSWORD,
    },
    "Demo accounts ready",
  );

  await disconnectDatabase();
}

main().catch(async (error) => {
  logger.error({ err: error }, "Failed to seed demo data");
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
