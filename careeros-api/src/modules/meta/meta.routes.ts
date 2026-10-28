import { Router, type Request, type Response } from "express";
import { env } from "../../config/env.js";
import { sendSuccess } from "../../lib/response.js";

const CAREER_CATEGORIES = [
  "SOFTWARE_DEVELOPMENT",
  "DATA_AI",
  "CLOUD_DEVOPS",
  "CYBERSECURITY",
  "QUALITY_ASSURANCE",
  "BUSINESS",
  "OTHER",
];

const DIFFICULTY_LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
const SKILL_CATEGORIES = [
  "PROGRAMMING_LANGUAGES",
  "FRAMEWORKS",
  "DATABASES",
  "CLOUD",
  "DEVOPS",
  "DATA",
  "AI_ML",
  "CYBERSECURITY",
  "TESTING",
  "SOFT_SKILLS",
  "OTHER",
];
const SKILL_LEVELS = ["BEGINNER", "BASIC", "INTERMEDIATE", "ADVANCED", "EXPERT"];
const QUESTION_TYPES = ["MCQ"];

export const metaRouter = Router();

metaRouter.get("/catalog", (_req: Request, res: Response) => {
  sendSuccess(res, {
    careerCategories: CAREER_CATEGORIES,
    difficultyLevels: DIFFICULTY_LEVELS,
    skillCategories: SKILL_CATEGORIES,
    skillLevels: SKILL_LEVELS,
    questionTypes: QUESTION_TYPES,
  });
});

metaRouter.get("/version", (_req: Request, res: Response) => {
  sendSuccess(res, {
    service: env.SERVICE_NAME,
    version: env.SERVICE_VERSION,
    buildTime: process.env.APP_BUILD_TIME ?? "unknown",
    commit: env.APP_BUILD_COMMIT,
  });
});
