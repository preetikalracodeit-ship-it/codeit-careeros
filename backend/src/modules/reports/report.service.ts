import { AppError } from "../../lib/errors.js";
import { buildPdf } from "../../lib/pdf.js";
import { Skill } from "../../models/Skill.js";
import { SkillScore } from "../../models/SkillScore.js";
import { getStudentProfile } from "../students/student.service.js";
import { getAttemptHistory } from "../students/attempt-history.service.js";
import { getStudentReadiness } from "../students/readiness.service.js";
import { getMyRoadmap } from "../roadmaps/roadmap.service.js";
import { getRecommendedProjects } from "../projects/project.service.js";
import { analyzeLinkedInProfile } from "../linkedin/linkedin.service.js";
import { analyzeCvFor } from "../cvs/cv.service.js";

function pretty(value: string | null | undefined): string {
  if (!value) return "-";
  const lower = value.toLowerCase().replaceAll("_", " ");
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

async function latestSkillScores(attemptId: number) {
  const scores = await SkillScore.find({ attemptId }).sort({ weightPercent: -1 }).lean();
  const skills = await Skill.find({ _id: { $in: scores.map((score) => score.skillId) } }).lean();
  const skillById = new Map(skills.map((skill) => [skill._id, skill]));
  return scores.flatMap((score) => {
    const skill = skillById.get(score.skillId);
    if (!skill) return [];
    return [{
      skillId: skill._id,
      skillName: skill.name,
      skillCategory: skill.category,
      weightPercent: score.weightPercent,
      targetPercent: score.targetPercent,
      questionCount: score.questionCount,
      correctCount: score.correctCount,
      scorePercent: score.scorePercent,
      level: score.level,
    }];
  });
}

export async function listReports(userId: number) {
  const now = new Date();
  const [readiness, attempts, roadmap] = await Promise.all([
    getStudentReadiness(userId),
    getAttemptHistory(userId),
    getMyRoadmap(userId),
    getRecommendedProjects(userId),
  ]);
  const hasTarget = Boolean(readiness.hasTarget);
  const hasAttempts = attempts.length > 0;
  const hasRoadmap = (roadmap.totalItems ?? 0) > 0;
  return [
    {
      type: "readiness",
      title: "Career Readiness Report",
      description: "Overall readiness, strengths, improvement areas and next steps for your target career.",
      generatedAt: now,
      available: hasTarget && hasAttempts,
      statusDetail: hasTarget
        ? (hasAttempts
          ? readiness.readinessPercent == null
            ? "Assessment submitted; no skill score is available yet"
            : `${readiness.readinessPercent}% ready`
          : "No assessment submitted yet")
        : "No target career selected",
    },
    {
      type: "assessment",
      title: "Skill Assessment Report",
      description: "Submitted attempts with skill-wise scores and correct/incorrect summary.",
      generatedAt: now,
      available: hasAttempts,
      statusDetail: hasAttempts ? `${attempts.length} submission(s)` : "No assessment submitted yet",
    },
    {
      type: "gap-analysis",
      title: "Career Gap Analysis Report",
      description: "Required vs current levels, gaps, priority areas and recommendations.",
      generatedAt: now,
      available: hasTarget,
      statusDetail: hasTarget ? `${readiness.totalSkills} required skills` : "No target career selected",
    },
    {
      type: "roadmap",
      title: "Learning / Roadmap Progress Report",
      description: "Phases, completed / in-progress / pending items and completion percentage.",
      generatedAt: now,
      available: hasTarget && hasRoadmap,
      statusDetail: hasRoadmap
        ? `${roadmap.completedItems}/${roadmap.totalItems} steps completed`
        : "No roadmap published for your career yet",
    },
    {
      type: "overall",
      title: "Overall CareerOS Progress Report",
      description: "Combined career-development snapshot: readiness, gaps, roadmap, projects, CV and LinkedIn.",
      generatedAt: now,
      available: hasTarget,
      statusDetail: hasTarget ? `Covers ${readiness.targetCareerName}` : "No target career selected",
    },
  ];
}

export async function readinessReport(userId: number) {
  const readiness = await getStudentReadiness(userId);
  if (!readiness.hasTarget) {
    throw AppError.badRequest("Choose a target career first to generate the readiness report");
  }
  return readiness;
}

export async function assessmentReport(userId: number) {
  const attempts = await getAttemptHistory(userId);
  if (attempts.length === 0) {
    throw AppError.badRequest("No submitted assessment found for the assessment report");
  }
  const latest = attempts[0]!;
  return {
    attempts,
    latestAttempt: latest,
    latestSkillScores: await latestSkillScores(latest.attemptId),
  };
}

export async function gapReport(userId: number) {
  const readiness = await getStudentReadiness(userId);
  if (!readiness.hasTarget) {
    throw AppError.badRequest("Choose a target career first to generate the gap report");
  }
  return readiness;
}

export async function roadmapReport(userId: number) {
  const roadmap = await getMyRoadmap(userId);
  if (!roadmap.hasTarget) {
    throw AppError.badRequest("Choose a target career first to generate the roadmap report");
  }
  return roadmap;
}

async function nextSteps(
  readiness: Awaited<ReturnType<typeof getStudentReadiness>>,
  roadmap: Awaited<ReturnType<typeof getMyRoadmap>>,
  projects: Awaited<ReturnType<typeof getRecommendedProjects>>,
  cv: Awaited<ReturnType<typeof analyzeCvFor>>,
  linkedIn: Awaited<ReturnType<typeof analyzeLinkedInProfile>>,
) {
  const steps: string[] = [];
  if (!readiness.hasTarget) {
    steps.push("Choose your target career to unlock assessments, gaps and roadmap.");
    return steps;
  }
  for (const gap of readiness.improvements.slice(0, 3)) {
    steps.push(`Improve ${gap.skillName} (${gap.assessed ? `${gap.scorePercent}% vs required ${gap.targetPercent}%` : `not assessed yet, required ${gap.targetPercent}%`}).`);
  }
  if (roadmap.totalItems > 0 && roadmap.completedItems < roadmap.totalItems) {
    steps.push(`Continue your roadmap: ${roadmap.completedItems} of ${roadmap.totalItems} steps completed.`);
  }
  if (projects.totalProjects > 0 && projects.completedProjects < projects.totalProjects) {
    steps.push("Complete a recommended project to turn a gap into proof.");
  }
  if (!cv.hasCv) steps.push("Upload your CV to detect skills and match them against your career.");
  if (!linkedIn.hasProfile) steps.push("Connect your LinkedIn profile to check completeness and alignment.");
  if (steps.length === 0) steps.push("You are on track - keep your profile, CV and LinkedIn fresh.");
  return steps;
}

export async function overallReport(userId: number) {
  const [student, readiness, roadmap, projects, cv, linkedIn] = await Promise.all([
    getStudentProfile(userId),
    getStudentReadiness(userId),
    getMyRoadmap(userId),
    getRecommendedProjects(userId),
    analyzeCvFor(userId),
    analyzeLinkedInProfile(userId),
  ]);
  return {
    student,
    readiness,
    roadmap,
    projects,
    cv,
    linkedIn,
    recommendedNextSteps: await nextSteps(readiness, roadmap, projects, cv, linkedIn),
    generatedAt: new Date(),
  };
}

export function reportFilename(type: string) {
  return `careeros-${type}-report.pdf`;
}

async function readinessPdf(userId: number) {
  const [student, readiness, roadmap, projects, cv, linkedIn] = await Promise.all([
    getStudentProfile(userId),
    readinessReport(userId),
    getMyRoadmap(userId),
    getRecommendedProjects(userId),
    analyzeCvFor(userId),
    analyzeLinkedInProfile(userId),
  ]);
  const steps = await nextSteps(readiness, roadmap, projects, cv, linkedIn);
  return buildPdf("Career Readiness Report", "Career Development Report", (doc) => {
    doc.heading("Student information");
    doc.keyValue("Name", student.fullName);
    doc.keyValue("Student ID", student.studentId);
    doc.keyValue("Target career", readiness.targetCareerName ?? "Not selected yet");
    doc.heading("Overall readiness");
    doc.keyValue("Readiness", readiness.readinessPercent == null
      ? "Not assessed"
      : `${readiness.readinessPercent}% (${pretty(readiness.readinessLevel)})`);
    doc.keyValue("Skills assessed", `${readiness.assessedSkills} of ${readiness.totalSkills} (${readiness.metSkills} on target, ${readiness.submittedAttempts} submissions)`);
    doc.heading("Strengths");
    if (readiness.strengths.length === 0) {
      doc.text("No met skills yet - your first wins will show up here.");
    } else {
      doc.table(["Skill", "Score", "Target"], readiness.strengths.map((gap) => [gap.skillName, `${gap.scorePercent ?? 0}%`, `${gap.targetPercent ?? 0}%`]));
    }
    doc.heading("Improvement areas");
    if (readiness.improvements.length === 0) {
      doc.text("Everything assessed is on target. Nice work.");
    } else {
      doc.table(["Skill", "Score", "Target", "Gap"], readiness.improvements.map((gap) => [
        gap.skillName,
        gap.assessed ? `${gap.scorePercent ?? 0}%` : "Not assessed",
        `${gap.targetPercent ?? 0}%`,
        gap.assessed ? (gap.metTarget ? "On target" : `${gap.gapPercent ?? 0}%`) : "-",
      ]));
    }
    doc.heading("Recommended next steps");
    for (const step of steps) doc.bullet(step);
  });
}

async function assessmentPdf(userId: number) {
  const [student, report] = await Promise.all([getStudentProfile(userId), assessmentReport(userId)]);
  return buildPdf("Skill Assessment Report", "Career Development Report", (doc) => {
    doc.heading("Student information");
    doc.keyValue("Name", student.fullName);
    doc.keyValue("Student ID", student.studentId);
    doc.keyValue("Target career", report.latestAttempt.careerName ?? "Not selected yet");
    for (const attempt of report.attempts) {
      doc.heading(`${attempt.assessmentTitle} - ${formatDate(attempt.submittedAt ?? attempt.startedAt)}`);
      doc.keyValue("Score", attempt.overallScore ?? "-");
      doc.keyValue("Questions", `${attempt.answeredCount} answered of ${attempt.totalQuestions}`);
    }
    if (report.latestSkillScores.length > 0) {
      doc.heading("Skill-wise scores (latest attempt)");
      doc.table(["Skill", "Score", "Target", "Level"], report.latestSkillScores.map((score) => [
        score.skillName,
        `${score.scorePercent}% (${score.correctCount}/${score.questionCount})`,
        `${score.targetPercent}%`,
        pretty(score.level),
      ]));
    }
  });
}

async function gapPdf(userId: number) {
  const [student, readiness] = await Promise.all([getStudentProfile(userId), gapReport(userId)]);
  const sorted = [...readiness.gaps].sort((a, b) => (a.gapPercent ?? Number.MIN_SAFE_INTEGER) - (b.gapPercent ?? Number.MIN_SAFE_INTEGER));
  return buildPdf("Career Gap Analysis Report", "Career Development Report", (doc) => {
    doc.heading("Student information");
    doc.keyValue("Name", student.fullName);
    doc.keyValue("Student ID", student.studentId);
    doc.keyValue("Target career", readiness.targetCareerName ?? "Not selected yet");
    doc.keyValue("Skills on target", `${readiness.metSkills} of ${readiness.assessedSkills} assessed`);
    doc.heading("Required skills - current vs target (largest gaps first)");
    doc.table(["Skill", "Current", "Required", "Gap"], sorted.map((gap) => [
      gap.skillName,
      gap.assessed ? `${gap.scorePercent}%` : "Not assessed",
      `${gap.targetPercent}%`,
      gap.assessed ? (gap.metTarget ? "On target" : `${gap.gapPercent}%`) : "-",
    ]));
    doc.heading("Priority areas");
    for (const gap of readiness.improvements) {
      doc.bullet(`${gap.skillName}: ${gap.assessed ? `${gap.scorePercent}% vs required ${gap.targetPercent}%` : `not assessed yet, required ${gap.targetPercent}%`}`);
    }
  });
}

async function roadmapPdf(userId: number) {
  const [student, roadmap, projects] = await Promise.all([
    getStudentProfile(userId),
    roadmapReport(userId),
    getRecommendedProjects(userId),
  ]);
  return buildPdf("Learning / Roadmap Progress Report", "Career Development Report", (doc) => {
    doc.heading("Student information");
    doc.keyValue("Name", student.fullName);
    doc.keyValue("Student ID", student.studentId);
    doc.keyValue("Target career", roadmap.careerName ?? "Not selected yet");
    doc.keyValue("Completion", `${roadmap.completedItems} of ${roadmap.totalItems} steps (${roadmap.progressPercent}%)`);
    doc.keyValue("In progress", roadmap.inProgressItems);
    for (const phase of roadmap.phases) {
      doc.heading(`${phase.title} (${phase.completedItems}/${phase.totalItems} done)`);
      for (const item of phase.items) doc.bullet(`[${pretty(item.status)}] ${item.title}`);
    }
    doc.heading("Projects");
    doc.text(`${projects.completedProjects} of ${projects.totalProjects} recommended projects completed (${projects.inProgressProjects} in progress).`);
    for (const project of projects.projects) doc.bullet(`[${pretty(project.status)}] ${project.title}`);
  });
}

async function overallPdf(userId: number) {
  const overall = await overallReport(userId);
  return buildPdf("Overall CareerOS Progress Report", "Career Development Report", (doc) => {
    doc.heading("Student information");
    doc.keyValue("Name", overall.student.fullName);
    doc.keyValue("Student ID", overall.student.studentId);
    doc.keyValue("Target career", overall.readiness.hasTarget ? overall.readiness.targetCareerName : "Not selected yet");
    doc.heading("Career readiness");
    if (overall.readiness.hasTarget) {
      doc.keyValue("Readiness", overall.readiness.readinessPercent == null
        ? "Not assessed"
        : `${overall.readiness.readinessPercent}% (${pretty(overall.readiness.readinessLevel)})`);
      doc.keyValue("Gaps", `${overall.readiness.metSkills} of ${overall.readiness.assessedSkills} assessed skills on target`);
    } else {
      doc.text("No target career selected yet - choose one to unlock readiness, gaps and roadmap.");
    }
    doc.heading("Learning roadmap");
    doc.text(overall.roadmap.hasTarget
      ? `${overall.roadmap.completedItems} of ${overall.roadmap.totalItems} steps completed (${overall.roadmap.progressPercent}%).`
      : "No roadmap available yet.");
    doc.heading("Projects");
    doc.text(`${overall.projects.completedProjects} of ${overall.projects.totalProjects} recommended projects completed.`);
    doc.heading("CV analysis");
    doc.text(overall.cv.hasCv
      ? `${overall.cv.detectedSkills.length} skills detected on CV; ${overall.cv.matchedSkills.length} framework skills matched, ${overall.cv.missingSkills.length} missing.`
      : "No CV uploaded yet.");
    doc.heading("LinkedIn analysis");
    doc.text(overall.linkedIn.hasProfile
      ? `Profile completeness ${overall.linkedIn.completenessPercent}%, alignment ${overall.linkedIn.alignmentPercent}%.`
      : "No LinkedIn profile connected yet.");
    doc.heading("Recommended next steps");
    for (const step of overall.recommendedNextSteps) doc.bullet(step);
  });
}

export async function generateReportPdf(userId: number, type: string) {
  const normalized = type.trim().toLowerCase();
  switch (normalized) {
    case "readiness":
      return readinessPdf(userId);
    case "assessment":
      return assessmentPdf(userId);
    case "gap-analysis":
    case "gap":
      return gapPdf(userId);
    case "roadmap":
      return roadmapPdf(userId);
    case "overall":
      return overallPdf(userId);
    default:
      throw AppError.badRequest(`Unknown report type: ${type} (expected readiness, assessment, gap-analysis, roadmap or overall)`);
  }
}
