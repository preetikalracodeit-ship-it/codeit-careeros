import { getStudentReadiness } from "../students/readiness.service.js";
import { getAttemptHistory } from "../students/attempt-history.service.js";
import { getMyRoadmap } from "../roadmaps/roadmap.service.js";
import { getRecommendedProjects } from "../projects/project.service.js";
import { analyzeCvFor } from "../cvs/cv.service.js";
import { analyzeLinkedInProfile } from "../linkedin/linkedin.service.js";
import { RoadmapItemProgress, type RoadmapItemProgressDoc } from "../../models/RoadmapItemProgress.js";
import { RoadmapItem, type RoadmapItemDoc } from "../../models/RoadmapItem.js";
import { ProjectProgress, type ProjectProgressDoc } from "../../models/ProjectProgress.js";
import { Project, type ProjectDoc } from "../../models/Project.js";
import { CvDocument, type CvDocumentDoc } from "../../models/CvDocument.js";
import { LinkedInProfile, type LinkedInProfileDoc } from "../../models/LinkedInProfile.js";

export interface ActivityItem {
  type: "ASSESSMENT" | "ROADMAP" | "PROJECT" | "CV" | "LINKEDIN";
  title: string;
  detail: string | null;
  occurredAt: Date;
}

export interface ProgressResponse {
  readiness: unknown;
  attempts: unknown[];
  completedAssessments: number;
  latestAttempt: unknown | null;
  previousAttempt: unknown | null;
  roadmap: unknown;
  projects: unknown;
  cv: unknown;
  linkedIn: unknown;
  recentActivity: ActivityItem[];
}

export async function getMyProgress(userId: number): Promise<ProgressResponse> {
  const [readiness, attempts, roadmap, projects, cv, linkedIn] = await Promise.all([
    getStudentReadiness(userId).catch(() => ({ hasTarget: false, readinessPercent: 0, gaps: [] })),
    getAttemptHistory(userId).catch(() => []),
    getMyRoadmap(userId).catch(() => ({ careerId: null, careerName: null, phases: [], totalItems: 0, completedItems: 0 })),
    getRecommendedProjects(userId).catch(() => ({ careerId: null, careerName: null, projects: [], totalProjects: 0, completedProjects: 0 })),
    analyzeCvFor(userId).catch(() => null),
    analyzeLinkedInProfile(userId).catch(() => null),
  ]);

  const latestAttempt = attempts.length > 0 ? attempts[0] : null;
  const previousAttempt = attempts.length > 1 ? attempts[1] : null;

  const activity: ActivityItem[] = [];

  for (const attempt of attempts.slice(0, 5)) {
    if (attempt.submittedAt) {
      activity.push({
        type: "ASSESSMENT",
        title: `Assessment submitted: ${attempt.assessmentTitle ?? "Assessment"}`,
        detail: attempt.overallScore != null ? `Score ${attempt.overallScore}` : "Submitted",
        occurredAt: new Date(attempt.submittedAt),
      });
    }
  }

  try {
    const roadmapProgress = await RoadmapItemProgress.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean<RoadmapItemProgressDoc[]>();
    if (roadmapProgress.length > 0) {
      const itemIds = roadmapProgress.map((r) => r.itemId);
      const items = await RoadmapItem.find({ _id: { $in: itemIds } }).lean<RoadmapItemDoc[]>();
      const itemMap = new Map(items.map((i) => [i._id, i]));
      for (const p of roadmapProgress) {
        if (p.updatedAt) {
          const item = itemMap.get(p.itemId);
          activity.push({
            type: "ROADMAP",
            title: `Roadmap item ${p.status.toLowerCase().replace("_", " ")}: ${item?.title ?? "roadmap item"}`,
            detail: null,
            occurredAt: new Date(p.updatedAt),
          });
        }
      }
    }
  } catch {
    // Ignore progress lookup errors for activity timeline
  }

  try {
    const projectProgress = await ProjectProgress.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean<ProjectProgressDoc[]>();
    if (projectProgress.length > 0) {
      const projectIds = projectProgress.map((p) => p.projectId);
      const projList = await Project.find({ _id: { $in: projectIds } }).lean<ProjectDoc[]>();
      const projMap = new Map(projList.map((pr) => [pr._id, pr]));
      for (const p of projectProgress) {
        if (p.updatedAt) {
          const proj = projMap.get(p.projectId);
          activity.push({
            type: "PROJECT",
            title: `Project ${p.status.toLowerCase().replace("_", " ")}: ${proj?.title ?? "project"}`,
            detail: null,
            occurredAt: new Date(p.updatedAt),
          });
        }
      }
    }
  } catch {
    // Ignore progress lookup errors for activity timeline
  }

  try {
    const cvDoc = await CvDocument.findOne({ userId }).lean<CvDocumentDoc>();
    if (cvDoc?.uploadedAt) {
      activity.push({
        type: "CV",
        title: `CV updated: ${cvDoc.originalFilename}`,
        detail: null,
        occurredAt: new Date(cvDoc.uploadedAt),
      });
    }
  } catch {
    // Ignore
  }

  try {
    const li = await LinkedInProfile.findOne({ userId }).lean<LinkedInProfileDoc>();
    if (li?.updatedAt) {
      activity.push({
        type: "LINKEDIN",
        title: "LinkedIn profile updated",
        detail: li.profileUrl ?? null,
        occurredAt: new Date(li.updatedAt),
      });
    }
  } catch {
    // Ignore
  }

  activity.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

  return {
    readiness,
    attempts,
    completedAssessments: attempts.length,
    latestAttempt,
    previousAttempt,
    roadmap,
    projects,
    cv,
    linkedIn,
    recentActivity: activity.slice(0, 15),
  };
}

