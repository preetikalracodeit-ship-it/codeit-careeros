import { AppError } from "../../lib/errors.js";
import { AssessmentQuestion } from "../../models/AssessmentQuestion.js";
import { AssessmentTest } from "../../models/AssessmentTest.js";
import { Career } from "../../models/Career.js";

const MAX_ATTEMPT_QUESTIONS = 20;

export async function listPublishedAssessmentsForCareer(careerId: number) {
  const assessments = await AssessmentTest.find({ careerId, published: true })
    .sort({ createdAt: -1 })
    .lean();
  if (!assessments.length) return [];

  const career = await Career.findById(careerId).select("name").lean();
  if (!career) throw AppError.notFound(`Career not found: ${careerId}`);

  const counts = await AssessmentQuestion.aggregate<{ _id: number; count: number }>([
    { $match: { assessmentId: { $in: assessments.map((item) => item._id) }, active: true } },
    { $group: { _id: "$assessmentId", count: { $sum: 1 } } },
  ]);
  const countByAssessmentId = new Map(counts.map((row) => [row._id, row.count]));

  return assessments.map((assessment) => ({
    assessmentId: assessment._id,
    careerId: assessment.careerId,
    careerName: career.name,
    title: assessment.title,
    description: assessment.description ?? null,
    durationMinutes: assessment.durationMinutes,
    questionCount: Math.min(countByAssessmentId.get(assessment._id) ?? 0, MAX_ATTEMPT_QUESTIONS),
  }));
}
