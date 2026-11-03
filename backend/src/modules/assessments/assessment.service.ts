import { AssessmentQuestion } from "../../models/AssessmentQuestion.js";
import { AssessmentTest } from "../../models/AssessmentTest.js";
import { Career } from "../../models/Career.js";

export async function listPublishedAssessments(careerId: number) {
  const assessments = await AssessmentTest.find({ careerId, published: true })
    .sort({ createdAt: -1 })
    .lean();
  if (!assessments.length) return [];

  const [career, counts] = await Promise.all([
    Career.findById(careerId).lean(),
    AssessmentQuestion.aggregate<{ _id: number; count: number }>([
      { $match: { assessmentId: { $in: assessments.map((item) => item._id) }, active: true } },
      { $group: { _id: "$assessmentId", count: { $sum: 1 } } },
    ]),
  ]);
  if (!career) return [];
  const countByAssessmentId = new Map(counts.map((item) => [item._id, item.count]));
  return assessments.map((assessment) => ({
    assessmentId: assessment._id,
    careerId: career._id,
    careerName: career.name,
    title: assessment.title,
    ...(assessment.description == null ? {} : { description: assessment.description }),
    durationMinutes: assessment.durationMinutes,
    questionCount: Math.min(countByAssessmentId.get(assessment._id) ?? 0, 20),
  }));
}
