import { AssessmentAttempt } from "../../models/AssessmentAttempt.js";
import { AssessmentTest } from "../../models/AssessmentTest.js";
import { Career } from "../../models/Career.js";

export async function getAttemptHistory(userId: number, assessmentId?: number) {
  const filter: { userId: number; status: string; assessmentId?: number } = {
    userId,
    status: "SUBMITTED",
    ...(assessmentId === undefined ? {} : { assessmentId }),
  };
  const attempts = await AssessmentAttempt.find(filter).sort({ startedAt: -1 }).lean();
  const assessmentIds = [...new Set(attempts.map((attempt) => attempt.assessmentId))];
  const assessments = await AssessmentTest.find({ _id: { $in: assessmentIds } }).lean();
  const assessmentById = new Map(assessments.map((assessment) => [assessment._id, assessment]));
  const careerIds = [...new Set(assessments.map((assessment) => assessment.careerId))];
  const careers = await Career.find({ _id: { $in: careerIds } }).lean();
  const careerById = new Map(careers.map((career) => [career._id, career]));

  return attempts.flatMap((attempt) => {
    const assessment = assessmentById.get(attempt.assessmentId);
    const career = assessment ? careerById.get(assessment.careerId) : undefined;
    if (!assessment || !career) return [];
    return [{
      attemptId: attempt._id,
      assessmentId: assessment._id,
      assessmentTitle: assessment.title,
      careerId: career._id,
      careerName: career.name,
      status: attempt.status,
      ...(attempt.overallScore == null ? {} : { overallScore: attempt.overallScore }),
      totalQuestions: attempt.totalQuestions,
      answeredCount: attempt.answeredCount,
      startedAt: attempt.startedAt.toISOString(),
      ...(attempt.submittedAt == null ? {} : { submittedAt: attempt.submittedAt.toISOString() }),
    }];
  });
}
