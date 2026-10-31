import { env } from "../config/env.js";
import { connectDatabase, disconnectDatabase, ensureIndexes } from "../lib/db.js";
import { hashPassword } from "../lib/password.js";
import { logger } from "../lib/logger.js";
import { getNextSequence, setSequenceFloor } from "../models/Counter.js";
import { College, type CollegeDoc } from "../models/College.js";
import { User, type Role, type UserDoc } from "../models/User.js";
import { Institution } from "../models/Institution.js";
import {
  InstitutionMembership,
  type StaffDesignation,
} from "../models/InstitutionMembership.js";
import { Department } from "../models/Department.js";
import { Program } from "../models/Program.js";
import { AcademicYear } from "../models/AcademicYear.js";
import { Batch } from "../models/Batch.js";
import { Section } from "../models/Section.js";
import { StudentEnrollment } from "../models/StudentEnrollment.js";
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
import { Company } from "../models/Company.js";
import { JobOpening } from "../models/JobOpening.js";
import { AiChatSession } from "../models/AiChatSession.js";
import { AiChatMessage } from "../models/AiChatMessage.js";
import { buildPdf } from "../lib/pdf.js";
import { extractPdfText } from "../lib/cv-text.js";
import { CAREERS, QUESTION_BANK, SKILLS, type DemoWeight } from "./demoContent.js";
import { LinkedInProfile } from "../models/LinkedInProfile.js";
import { AssessmentQuestion } from "../models/AssessmentQuestion.js";
import { QuestionOption } from "../models/QuestionOption.js";
import { RoadmapPhase } from "../models/RoadmapPhase.js";
import { RoadmapItem } from "../models/RoadmapItem.js";
import { Project } from "../models/Project.js";
import { ProjectSkill } from "../models/ProjectSkill.js";

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

const skills = SKILLS;

const careers = CAREERS;

function weightedSkillTargets(weights: DemoWeight[]) {
  return new Map(weights.map((weight) => [weight.name, weight]));
}


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

interface InstitutionWorkspace {
  institutionId: number;
  departments: Map<string, number>;
  programs: Map<string, number>;
  batches: Map<string, number>;
  sections: Map<string, number>;
}

async function ensureInstitutionStructure(college: CollegeDoc): Promise<InstitutionWorkspace> {
  let institution = await Institution.findOne({ code: COLLEGE_CODE });
  if (!institution) {
    institution = await Institution.create({
      _id: await getNextSequence("institutions"),
      code: COLLEGE_CODE,
      name: college.name,
      status: "ACTIVE",
      timezone: "Asia/Kolkata",
      contactEmail: college.contactEmail ?? "admin@northfield.example.edu",
    });
  } else {
    institution.name = college.name;
    institution.status = "ACTIVE";
    institution.timezone = institution.timezone || "Asia/Kolkata";
    institution.contactEmail = institution.contactEmail ?? college.contactEmail ?? null;
    await institution.save();
  }
  const institutionId = institution._id;

  const departments = new Map<string, number>();
  for (const department of college.departments) {
    let record = await Department.findOne({ institutionId, code: department.code });
    if (!record) {
      record = await Department.create({
        _id: department.id,
        institutionId,
        code: department.code,
        name: department.name,
        status: "ACTIVE",
      });
    }
    departments.set(department.code, record._id);
  }
  await setSequenceFloor("departments", Math.max(0, ...departments.values()));

  const programs = new Map<string, number>();
  const programSeeds = [
    { departmentCode: "CSE", code: "BTECH-CSE", name: "B.Tech Computer Science" },
    { departmentCode: "ECE", code: "BTECH-ECE", name: "B.Tech Electronics" },
  ];
  for (const seed of programSeeds) {
    const departmentId = departments.get(seed.departmentCode);
    if (!departmentId) continue;
    let record = await Program.findOne({ institutionId, code: seed.code });
    if (!record) {
      record = await Program.create({
        _id: await getNextSequence("programs"),
        institutionId,
        departmentId,
        code: seed.code,
        name: seed.name,
        degreeType: "B.Tech",
        durationYears: 4,
        status: "ACTIVE",
      });
    }
    programs.set(seed.departmentCode, record._id);
  }

  const academicYears = new Map<string, number>();
  for (const year of [2022, 2023]) {
    const label = `${year}-${year + 4}`;
    let record = await AcademicYear.findOne({ institutionId, label });
    if (!record) {
      record = await AcademicYear.create({
        _id: await getNextSequence("academic_years"),
        institutionId,
        label,
        startDate: `${year}-08-01`,
        endDate: `${year + 4}-06-30`,
        active: year === 2022,
      });
    }
    academicYears.set(label, record._id);
  }

  const departmentCodeById = new Map(college.departments.map((department) => [department.id, department.code]));
  const batches = new Map<string, number>();
  for (const batch of college.batches) {
    const departmentCode = departmentCodeById.get(batch.departmentId);
    const programId = departmentCode ? programs.get(departmentCode) : undefined;
    const academicYearId = academicYears.get(`${batch.year}-${batch.year + 4}`);
    if (!programId || !academicYearId) continue;
    let record = await Batch.findOne({ programId, label: batch.name });
    if (!record) {
      record = await Batch.create({
        _id: batch.id,
        programId,
        academicYearId,
        label: batch.name,
        graduationYear: batch.year + 4,
        status: "ACTIVE",
      });
    }
    batches.set(batch.name, record._id);
  }
  await setSequenceFloor("batches", Math.max(0, ...batches.values()));

  const sections = new Map<string, number>();
  for (const [batchName, batchId] of batches) {
    if (!batchName.startsWith("CSE")) continue;
    let record = await Section.findOne({ batchId, name: "A" });
    if (!record) {
      record = await Section.create({
        _id: await getNextSequence("sections"),
        batchId,
        name: "A",
        status: "ACTIVE",
      });
    }
    sections.set(batchName, record._id);
  }

  return { institutionId, departments, programs, batches, sections };
}

const STAFF_DESIGNATIONS = new Set<Role>(["COLLEGE_ADMIN", "TPO", "HOD", "FACULTY"]);

async function ensureStaffMembership(user: UserDoc, workspace: InstitutionWorkspace): Promise<void> {
  if (!STAFF_DESIGNATIONS.has(user.role)) return;
  const designation = user.role as StaffDesignation;
  const institutionWide = designation === "COLLEGE_ADMIN" || designation === "TPO";
  const scopeType = institutionWide ? "INSTITUTION" : "DEPARTMENT";
  const scopeId = institutionWide ? null : workspace.departments.get("CSE") ?? null;
  const existing = await InstitutionMembership.findOne({
    userId: user._id,
    institutionId: workspace.institutionId,
  });
  if (existing) {
    existing.designation = designation;
    existing.status = "ACTIVE";
    existing.scopeType = scopeType;
    existing.scopeId = scopeId;
    existing.acceptedAt = existing.acceptedAt ?? new Date();
    await existing.save();
    return;
  }
  await InstitutionMembership.create({
    _id: await getNextSequence("institution_memberships"),
    userId: user._id,
    institutionId: workspace.institutionId,
    designation,
    status: "ACTIVE",
    scopeType,
    scopeId,
    acceptedAt: new Date(),
  });
}

async function ensureStudentEnrollment(
  user: UserDoc,
  studentProfileId: number,
  workspace: InstitutionWorkspace,
): Promise<void> {
  const departmentId = workspace.departments.get("CSE")!;
  const programId = workspace.programs.get("CSE")!;
  const batchId = workspace.batches.get("CSE 2022-2026")!;
  const sectionId = workspace.sections.get("CSE 2022-2026") ?? null;
  const payload = {
    studentProfileId,
    institutionId: workspace.institutionId,
    departmentId,
    programId,
    batchId,
    sectionId,
    rollNumber: `NIT-CSE-${String(user._id).padStart(4, "0")}`,
    status: "ACTIVE" as const,
    startDate: "2022-08-01",
    endDate: null,
  };
  const existing = await StudentEnrollment.findOne({ studentProfileId });
  if (existing) {
    await StudentEnrollment.updateOne({ _id: existing._id }, { $set: payload });
  } else {
    await StudentEnrollment.create({
      _id: await getNextSequence("student_enrollments"),
      ...payload,
    });
  }
  await StudentProfile.updateOne({ _id: studentProfileId }, { $set: { departmentId, batchId } });
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
    } else {
      await Career.updateOne(
        { _id: record._id },
        {
          $set: {
            description: career.description,
            category: career.category,
            difficultyLevel: career.difficultyLevel,
            published: true,
          },
        },
      );
    }
    for (const mapping of career.weights) {
      const skillId = skillIds.get(mapping.name);
      if (!skillId) continue;
      await CareerSkill.updateOne(
        { careerId: record._id, skillId },
        {
          $set: {
            weightPercent: mapping.weightPercent,
            requiredLevel: mapping.requiredLevel ?? "INTERMEDIATE",
            targetPercent: mapping.targetPercent,
          },
          $setOnInsert: {
            _id: await getNextSequence("career_skills"),
            careerId: record._id,
            skillId,
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
        title: career.assessmentTitle,
        description: career.assessmentDescription,
        durationMinutes: career.durationMinutes,
        published: true,
      });
    } else {
      await AssessmentTest.updateOne(
        { _id: assessment._id },
        {
          $set: {
            title: career.assessmentTitle,
            description: career.assessmentDescription,
            durationMinutes: career.durationMinutes,
            published: true,
          },
        },
      );
    }
    byName.set(career.name, { id: record._id, assessmentId: assessment._id });
  }
  return byName;
}

type DemoCareer = (typeof careers)[number];

const ROADMAP_PHASE_TITLES = [
  "Phase 1 · Foundations",
  "Phase 2 · Applied practice",
  "Phase 3 · Portfolio and interviews",
];

async function ensureAssessmentQuestions(
  career: DemoCareer,
  assessmentId: number,
  skillIds: Map<string, number>,
): Promise<void> {
  let displayOrder = 0;
  for (const weight of career.weights) {
    const skillId = skillIds.get(weight.name);
    const bank = QUESTION_BANK[weight.name];
    if (!skillId || !bank?.length) continue;
    for (const item of bank) {
      displayOrder += 1;
      let question = await AssessmentQuestion.findOne({
        assessmentId,
        skillId,
        questionText: item.question,
      });
      if (!question) {
        question = await AssessmentQuestion.create({
          _id: await getNextSequence("assessment_questions"),
          assessmentId,
          skillId,
          questionText: item.question,
          questionType: "MCQ",
          difficulty: item.difficulty,
          displayOrder,
          explanation: item.explanation,
          active: true,
        });
      } else {
        await AssessmentQuestion.updateOne(
          { _id: question._id },
          {
            $set: {
              difficulty: item.difficulty,
              displayOrder,
              explanation: item.explanation,
              active: true,
            },
          },
        );
      }
      const options = await QuestionOption.find({ questionId: question._id }).lean();
      if (options.length !== item.options.length) {
        await QuestionOption.deleteMany({ questionId: question._id });
        for (let index = 0; index < item.options.length; index += 1) {
          await QuestionOption.create({
            _id: await getNextSequence("question_options"),
            questionId: question._id,
            optionText: item.options[index]!,
            correct: index === item.correct,
            displayOrder: index,
          });
        }
      }
    }
  }
}

async function ensureRoadmap(
  career: DemoCareer,
  careerId: number,
  skillIds: Map<string, number>,
): Promise<void> {
  const sorted = [...career.weights].sort((a, b) => b.weightPercent - a.weightPercent);
  const items = sorted.map((weight) => ({
    skillId: skillIds.get(weight.name) ?? null,
    title: `Master ${weight.name}`,
    description: `Study the core ideas of ${weight.name} and apply them in a short, focused exercise.`,
    learningGoal: `Reach ${weight.targetPercent}% readiness in ${weight.name} and add evidence to your portfolio.`,
    estimatedHours: Math.max(6, Math.round(weight.weightPercent * 0.6)),
  }));
  items.push({
    skillId: null,
    title: career.capstone?.title ?? `Build a portfolio project for ${career.name}`,
    description:
      career.capstone?.description ??
      `Ship one project that demonstrates the core skills required for ${career.name}.`,
    learningGoal:
      "Publish the project, write a short case study and prepare to discuss your decisions in interviews.",
    estimatedHours: 30,
  });

  const phaseSize = Math.ceil(items.length / 3);
  let cursor = 0;
  for (let index = 0; index < 3; index += 1) {
    const displayOrder = index + 1;
    const phaseItems = items.slice(cursor, cursor + phaseSize);
    cursor += phaseSize;
    const phasePayload = {
      title: ROADMAP_PHASE_TITLES[index]!,
      description:
        index === 0
          ? "Close the foundational gaps that every interview assumes."
          : index === 1
            ? "Turn knowledge into working, reviewed practice."
            : "Package your work and get interview-ready.",
      displayOrder,
      durationDays: [21, 30, 21][index]!,
    };
    let phase = await RoadmapPhase.findOne({ careerId, displayOrder });
    if (!phase) {
      phase = await RoadmapPhase.create({
        _id: await getNextSequence("roadmap_phases"),
        careerId,
        ...phasePayload,
      });
    } else {
      await RoadmapPhase.updateOne({ _id: phase._id }, { $set: phasePayload });
    }

    let itemOrder = 0;
    for (const item of phaseItems) {
      itemOrder += 1;
      const payload = {
        skillId: item.skillId,
        title: item.title,
        description: item.description,
        learningGoal: item.learningGoal,
        displayOrder: itemOrder,
        estimatedHours: item.estimatedHours,
      };
      const existing = await RoadmapItem.findOne({ phaseId: phase._id, displayOrder: itemOrder });
      if (!existing) {
        await RoadmapItem.create({
          _id: await getNextSequence("roadmap_items"),
          phaseId: phase._id,
          ...payload,
        });
      } else {
        await RoadmapItem.updateOne({ _id: existing._id }, { $set: payload });
      }
    }
  }
}

async function ensureProjects(
  career: DemoCareer,
  careerId: number,
  skillIds: Map<string, number>,
): Promise<void> {
  const sorted = [...career.weights].sort((a, b) => b.weightPercent - a.weightPercent);
  const definitions = [
    {
      title: `${career.name} starter project`,
      description: `Build a small deliverable focused on ${sorted.slice(0, 2).map((weight) => weight.name).join(" and ")}. Keep the scope tight and document what you learned.`,
      difficulty: "BEGINNER",
      estimatedWeeks: 2,
      skills: sorted.slice(0, 2),
    },
    {
      title: `${career.name} applied case study`,
      description: `Take a realistic ${career.name.toLowerCase()} scenario and produce a reviewed solution using ${sorted.slice(2, 4).map((weight) => weight.name).join(" and ")}.`,
      difficulty: "INTERMEDIATE",
      estimatedWeeks: 3,
      skills: sorted.slice(2, 4).length ? sorted.slice(2, 4) : sorted.slice(0, 2),
    },
    {
      title: `${career.name} team simulation`,
      description: `Work in a small team to deliver a feature end to end for a ${career.name.toLowerCase()} role, including review and a short demo.`,
      difficulty: "INTERMEDIATE",
      estimatedWeeks: 4,
      skills: sorted,
    },
    {
      title: career.capstone?.title ?? `${career.name} portfolio capstone`,
      description:
        career.capstone?.description ??
        `Ship a portfolio-quality project that demonstrates the skills required for ${career.name}.`,
      difficulty: (career.capstone?.difficulty ?? "ADVANCED") as "BEGINNER" | "INTERMEDIATE" | "ADVANCED",
      estimatedWeeks: career.capstone?.estimatedWeeks ?? 5,
      skills: sorted,
    },
  ];

  let displayOrder = 0;
  for (const definition of definitions) {
    displayOrder += 1;
    let project = await Project.findOne({ careerId, title: definition.title });
    if (!project) {
      project = await Project.create({
        _id: await getNextSequence("projects"),
        careerId,
        title: definition.title,
        description: definition.description,
        difficulty: definition.difficulty,
        estimatedWeeks: definition.estimatedWeeks,
        displayOrder,
        published: true,
      });
    } else {
      await Project.updateOne(
        { _id: project._id },
        {
          $set: {
            description: definition.description,
            difficulty: definition.difficulty,
            estimatedWeeks: definition.estimatedWeeks,
            displayOrder,
            published: true,
          },
        },
      );
    }
    await ProjectSkill.deleteMany({ projectId: project._id });
    for (const weight of definition.skills) {
      const skillId = skillIds.get(weight.name);
      if (!skillId) continue;
      const exists = await ProjectSkill.findOne({ projectId: project._id, skillId });
      if (!exists) {
        await ProjectSkill.create({
          _id: await getNextSequence("project_skills"),
          projectId: project._id,
          skillId,
        });
      }
    }
  }
}

async function ensureLinkedIn(
  user: UserDoc,
  degree: string,
  branch: string,
  collegeName: string,
  careerName: string,
): Promise<void> {
  const handle = user.email.split("@")[0]!.replace(/[^a-z0-9._-]/gi, "");
  const payload = {
    profileUrl: `https://www.linkedin.com/in/${handle}`,
    headline: `${careerName} track | ${degree} ${branch} student`,
    about: `Final-year ${degree} student in ${branch} at ${collegeName}, focused on becoming a ${careerName}. I enjoy turning what I learn into small, shippable projects and I am looking for an internship where I can contribute and grow.`,
    currentRole: "Student",
    experienceText:
      "Software Engineering Intern — Northfield Labs (2025)\n- Built internal tools with JavaScript and REST APIs.\n- Worked with a mentor on code reviews and testing.\n\nCampus Ambassador — CareerOS (2025)\n- Ran two interview-preparation workshops for 80+ students.",
    skillsText: `Problem Solving, Communication, JavaScript, SQL, Git, ${careerName} fundamentals`,
    educationText: `${degree} in ${branch}, ${collegeName} (2022 - 2026)`,
  };
  const existing = await LinkedInProfile.findOne({ userId: user._id });
  if (!existing) {
    await LinkedInProfile.create({
      _id: await getNextSequence("linkedin_profiles"),
      userId: user._id,
      ...payload,
    });
    return;
  }
  await LinkedInProfile.updateOne({ _id: existing._id }, { $set: payload });
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

async function ensureCv(user: UserDoc, careerName: string, branch: string): Promise<void> {
  const existing = await CvDocument.findOne({ userId: user._id }).lean();
  if (existing) return;
  const career = careers.find((item) => item.name === careerName);
  const skillsText = [...(career?.weights.map((weight) => weight.name) ?? []), "Git", "Communication"].join(", ");
  const fileName = `${user.fullName.replace(/\s+/g, "-")}-CV.pdf`;
  const bytes = buildPdf(user.fullName, `${careerName} - Bengaluru, India`, (doc) => {
    doc.keyValue("Email", user.email);
    doc.keyValue("Phone", "+91 98765 43210");
    doc.keyValue("Location", "Bengaluru, Karnataka");
    doc.heading("Professional Summary");
    doc.text(`Motivated final-year ${branch} student seeking a ${careerName} role. I build projects that apply ${skillsText}, and I communicate clearly with cross-functional teams.`);
    doc.heading("Technical Skills");
    doc.text(skillsText);
    doc.heading("Experience");
    doc.bullet("Software Engineering Intern at Northfield Labs (2025 - Present): built REST APIs and reduced page load time by 28%.");
    doc.bullet("Teaching Assistant for Data Structures (2024): mentored 40 juniors through weekly problem-solving sessions.");
    doc.heading("Projects");
    doc.bullet("CampusHire: full-stack placement portal with React, Node.js and MongoDB; used by 600+ students.");
    doc.bullet("SkillGraph: visualises career skill gaps using SQL analytics and an interactive dashboard.");
    doc.bullet("ChatAssist: offline guidance assistant that answers student questions from structured career data.");
    doc.heading("Education");
    doc.text(`${branch}, Northfield Institute of Technology, Bengaluru - 2022 to 2026. CGPA 8.6/10.`);
    doc.heading("Certifications");
    doc.bullet("Meta Front-End Developer Professional Certificate (Coursera)");
    doc.bullet("SQL for Data Science (NPTEL)");
  });
  const text = extractPdfText(bytes);
  await CvDocument.create({
    _id: await getNextSequence("cv_documents"),
    userId: user._id,
    originalFilename: fileName,
    contentType: "application/pdf",
    fileSize: bytes.length,
    status: "PARSED",
    candidateName: user.fullName,
    candidateEmail: user.email,
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
  let plan = await ImprovementPlan.findOne({ studentProfileId });
  if (!plan) {
    plan = await ImprovementPlan.create({
      _id: await getNextSequence("improvement_plans"),
      studentProfileId,
      userId: user._id,
      title: `${targetCareerName} readiness improvement plan`,
      summary: "Focused plan to close the highest-priority gaps before the placement season.",
      status: "ACTIVE",
      targetCareerId,
      targetCareerName,
      createdByName: "Prof. Vikram Shah",
    });
  }
  const existingTasks = await ImprovementTask.countDocuments({ planId: plan._id });
  if (existingTasks > 0) return;

  const career = careers.find((item) => item.name === targetCareerName);
  const focus = (career?.weights ?? [])
    .slice()
    .sort((a, b) => b.weightPercent - a.weightPercent)
    .slice(0, 3)
    .map((weight) => weight.name);
  const fallback = ["Problem Solving", "Communication", "JavaScript"];
  while (focus.length < 3) focus.push(fallback[focus.length]!);

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
      title: `Practice ${focus[0]} for 30 minutes daily`,
      description: `Work through focused exercises in ${focus[0]} and log what you learn after each session.`,
      skillName: focus[0]!,
      priority: "HIGH",
      status: "IN_PROGRESS",
      targetDate: daysFromNow(7),
      baselineScore: 62,
      targetScore: 78,
    },
    {
      title: `Complete a guided module on ${focus[1]}`,
      description: `Finish one structured module in ${focus[1]} and add the resulting exercise to your portfolio.`,
      skillName: focus[1]!,
      priority: "HIGH",
      status: "NOT_STARTED",
      targetDate: daysFromNow(-2),
      baselineScore: 55,
      targetScore: 72,
    },
    {
      title: `Review ${focus[2]} feedback and notes`,
      description: `Revisit your last ${focus[2]} attempt, correct mistakes and write a short summary of the patterns you missed.`,
      skillName: focus[2]!,
      priority: "MEDIUM",
      status: "COMPLETED",
      targetDate: daysFromNow(-10),
      baselineScore: 60,
      targetScore: 70,
    },
  ];
  for (const task of tasks) {
    await ImprovementTask.create({
      _id: await getNextSequence("improvement_tasks"),
      planId: plan._id,
      ...task,
      skillId: skillIds.get(task.skillName) ?? null,
      ownerName: user.fullName,
      completedAt: task.status === "COMPLETED" ? daysFromNow(-9) : null,
    });
  }
}

async function ensurePlacementData(
  college: CollegeDoc,
  workspace: InstitutionWorkspace,
  user: UserDoc,
  studentProfileId: number,
  departmentId: number,
  batchId: number,
): Promise<void> {
  const driveSeeds = [
    {
      name: "Northfield Software Engineer Drive 2026",
      companyName: "Northfield Labs",
      companyIndustry: "Software product engineering",
      jobTitle: "Software Engineer",
      jobDescription: "Full-time software engineering role building customer-facing web products.",
      requiredSkills: "React, Node.js, REST APIs, SQL, Git",
      employmentType: "FULL_TIME" as const,
      salaryMin: 900000,
      salaryMax: 1400000,
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
      companyIndustry: "Data and business analytics",
      jobTitle: "Data Analyst",
      jobDescription: "Analyst role focused on SQL, dashboards and business storytelling.",
      requiredSkills: "SQL, Python, Data Visualisation, Communication",
      employmentType: "FULL_TIME" as const,
      salaryMin: 700000,
      salaryMax: 1100000,
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
  const eligibleDepartmentId = workspace.departments.get("CSE") ?? departmentId;
  const eligibleProgramId = workspace.programs.get("CSE") ?? null;
  const eligibleBatchId = workspace.batches.get("CSE 2022-2026") ?? batchId;
  for (const seed of driveSeeds) {
    let company = await Company.findOne({ institutionId: workspace.institutionId, name: seed.companyName });
    if (!company) {
      company = await Company.create({
        _id: await getNextSequence("placement_companies"),
        institutionId: workspace.institutionId,
        name: seed.companyName,
        industry: seed.companyIndustry,
        recruitmentStatus: "ACTIVE",
      });
    } else if (company.recruitmentStatus !== "ACTIVE") {
      company.recruitmentStatus = "ACTIVE";
      await company.save();
    }
    let job = await JobOpening.findOne({
      institutionId: workspace.institutionId,
      companyId: company._id,
      title: seed.jobTitle,
    });
    if (!job) {
      job = await JobOpening.create({
        _id: await getNextSequence("placement_jobs"),
        institutionId: workspace.institutionId,
        companyId: company._id,
        title: seed.jobTitle,
        description: seed.jobDescription,
        requiredSkills: seed.requiredSkills,
        location: seed.location,
        employmentType: seed.employmentType,
        eligibilityCriteria: seed.eligibilityCriteria,
        salaryMin: seed.salaryMin,
        salaryMax: seed.salaryMax,
        currency: "INR",
        applicationDeadline: seed.registrationEnd.toISOString().slice(0, 10),
        status: "OPEN",
      });
    }
    const driveValues = {
      institutionId: workspace.institutionId,
      collegeId: college._id,
      companyId: company._id,
      jobId: job._id,
      companyName: seed.companyName,
      jobTitle: seed.jobTitle,
      location: seed.location,
      description: seed.description,
      eligibilityCriteria: seed.eligibilityCriteria,
      registrationStart: seed.registrationStart,
      registrationEnd: seed.registrationEnd,
      driveDate: seed.driveDate,
      eligibleDepartmentId,
      eligibleProgramId,
      eligibleBatchId,
      eligibleGraduationYear: 2026,
      minimumReadinessPercent: seed.minimumReadinessPercent,
      status: seed.status,
    };
    let drive = await PlacementDrive.findOne({ collegeId: college._id, name: seed.name });
    if (!drive) {
      drive = await PlacementDrive.create({
        _id: await getNextSequence("placement_drives"),
        ...driveValues,
      });
    } else {
      Object.assign(drive, driveValues);
      await drive.save();
    }
    driveIds.push(drive._id);
  }

  const existing = await PlacementApplication.findOne({ driveId: driveIds[0], studentProfileId }).lean();
  if (!existing) {
    const applicationId = await getNextSequence("placement_applications");
    await PlacementApplication.create({
      _id: applicationId,
      institutionId: workspace.institutionId,
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
      institutionId: workspace.institutionId,
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

  await PlacementApplication.updateMany(
    { driveId: { $in: driveIds }, collegeId: college._id, institutionId: null },
    { $set: { institutionId: workspace.institutionId } },
  );
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
  const workspace = await ensureInstitutionStructure(college);
  const cse = college.departments.find((item) => item.code === "CSE")!;
  const cseBatch = college.batches.find((batch) => batch.departmentId === cse.id)!;

  await ensureUser(staffUsers[0], null, null);
  for (const demo of staffUsers.slice(1)) {
    const departmentId =
      demo.departmentCode === "CSE" ? cse.id : null;
    const staff = await ensureUser(demo, college, departmentId);
    await ensureStaffMembership(staff, workspace);
  }

  const skillIds = await ensureSkills();
  const careerByName = await ensureCareers(skillIds);
  const software = careerByName.get("Software Engineer")!;

  for (const career of careers) {
    const entry = careerByName.get(career.name);
    if (!entry) continue;
    await ensureAssessmentQuestions(career, entry.assessmentId, skillIds);
    await ensureRoadmap(career, entry.id, skillIds);
    await ensureProjects(career, entry.id, skillIds);
  }

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
    await ensureStudentEnrollment(user, studentProfileId, workspace);
    await seedAssessmentResult(user, software.assessmentId, skillIds, demo.studentScore ?? 60);
    await ensureCv(user, "Software Engineer", cse.name);
    await ensureImprovementPlan(user, studentProfileId, software.id, "Software Engineer", skillIds);
    await ensureLinkedIn(user, "B.Tech", cse.name, college.name, "Software Engineer");
    await ensurePlacementData(college, workspace, user, studentProfileId, cse.id, cseBatch.id);
    if (demo.email === "student@careeros.dev") {
      await ensureAiConversation(user);
    }
  }

  logger.info(
    {
      college: college.name,
      careers: careers.length,
      skills: skills.length,
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
