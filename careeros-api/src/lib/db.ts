import mongoose, { type ClientSession } from "mongoose";
import { logger } from "./logger.js";
import { User } from "../models/User.js";
import { RefreshToken } from "../models/RefreshToken.js";
import { ConsentRecord } from "../models/ConsentRecord.js";
import { StudentProfile } from "../models/StudentProfile.js";
import { Career } from "../models/Career.js";
import { Skill } from "../models/Skill.js";
import { CareerSkill } from "../models/CareerSkill.js";
import { AssessmentTest } from "../models/AssessmentTest.js";
import { AssessmentAttempt } from "../models/AssessmentAttempt.js";
import { SkillScore } from "../models/SkillScore.js";
import { AssessmentQuestion } from "../models/AssessmentQuestion.js";
import { AssessmentAttemptQuestion } from "../models/AssessmentAttemptQuestion.js";
import { QuestionOption } from "../models/QuestionOption.js";
import { AssessmentAnswer } from "../models/AssessmentAnswer.js";
import { PasswordResetToken } from "../models/PasswordResetToken.js";
import { RoadmapPhase } from "../models/RoadmapPhase.js";
import { RoadmapItem } from "../models/RoadmapItem.js";
import { RoadmapItemProgress } from "../models/RoadmapItemProgress.js";
import { Project } from "../models/Project.js";
import { ProjectSkill } from "../models/ProjectSkill.js";
import { ProjectProgress } from "../models/ProjectProgress.js";
import { LinkedInProfile } from "../models/LinkedInProfile.js";
import { College } from "../models/College.js";

export async function connectDatabase(uri: string): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  logger.info({ database: mongoose.connection.name }, "Connected to MongoDB");
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export async function ensureIndexes(): Promise<void> {
  await Promise.all([
    User.createIndexes(),
    RefreshToken.createIndexes(),
    ConsentRecord.createIndexes(),
    StudentProfile.createIndexes(),
    Career.createIndexes(),
    Skill.createIndexes(),
    CareerSkill.createIndexes(),
    AssessmentTest.createIndexes(),
    AssessmentAttempt.createIndexes(),
    SkillScore.createIndexes(),
    AssessmentQuestion.createIndexes(),
    AssessmentAttemptQuestion.createIndexes(),
    QuestionOption.createIndexes(),
    AssessmentAnswer.createIndexes(),
    PasswordResetToken.createIndexes(),
    RoadmapPhase.createIndexes(),
    RoadmapItem.createIndexes(),
    RoadmapItemProgress.createIndexes(),
    Project.createIndexes(),
    ProjectSkill.createIndexes(),
    ProjectProgress.createIndexes(),
    LinkedInProfile.createIndexes(),
    College.createIndexes(),
  ]);
}

export async function withTransaction<T>(
  fn: (session: ClientSession) => Promise<T>,
): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
}

export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}
