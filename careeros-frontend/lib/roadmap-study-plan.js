/**
 * Turns one roadmap item into a short, concrete study plan.
 *
 * The backend owns the step content (title, description, learning goal,
 * estimated hours, skill and target). This module only breaks that data into
 * the four sub-steps a student should actually work through, with guidance
 * tuned to the skill category. Nothing here is career-specific state: the
 * same item always produces the same plan.
 */

const CATEGORY_GUIDE = {
  PROGRAMMING_LANGUAGES: {
    learn: "Learn the syntax, data types and control flow",
    practice: "Solve 5-8 small exercises without copying the solution",
    artifact: "a small script or program",
  },
  FRAMEWORKS: {
    learn: "Read the official getting-started guide and follow the project structure",
    practice: "Rebuild one example feature from scratch",
    artifact: "a small working feature or mini app",
  },
  DATABASES: {
    learn: "Understand the data model, keys and the queries this skill is used for",
    practice: "Write and explain 10 queries against a sample schema",
    artifact: "a small schema with a set of queries",
  },
  CLOUD: {
    learn: "Learn the core services, the pricing model and the shared-responsibility model",
    practice: "Deploy one small workload on a free-tier account",
    artifact: "a deployed and documented mini environment",
  },
  DEVOPS: {
    learn: "Learn the pipeline stages and the core commands of the tool",
    practice: "Script one repeatable build, test or deploy task",
    artifact: "a small working pipeline or automation script",
  },
  DATA: {
    learn: "Define the question, the data shape and one analysis method",
    practice: "Clean and analyse a small real dataset",
    artifact: "a notebook or dashboard with three clear findings",
  },
  AI_ML: {
    learn: "Identify the problem type, the model options and the evaluation metric",
    practice: "Train and evaluate a small model on a public dataset",
    artifact: "a notebook or demo with honest results",
  },
  CYBERSECURITY: {
    learn: "Learn the threat model, common attack paths and the defensive controls",
    practice: "Run a guided lab in a safe, isolated environment",
    artifact: "a short findings report with recommended fixes",
  },
  TESTING: {
    learn: "Learn the test pyramid, test design and the basics of the tool",
    practice: "Write and run a small suite against a sample application",
    artifact: "a test suite plus a short defect report",
  },
  SOFT_SKILLS: {
    learn: "Learn the behaviours and phrases that make this skill visible to others",
    practice: "Use it in one real conversation, meeting or written update",
    artifact: "a short reflection or artefact that shows the skill in action",
  },
  OTHER: {
    learn: "Learn the key concepts and vocabulary",
    practice: "Apply it to one small, realistic task",
    artifact: "a small, shareable deliverable",
  },
};

function splitHours(totalHours) {
  const hours = Math.max(1, Number(totalHours) || 4);
  const learn = Math.max(1, Math.round(hours * 0.4));
  const practice = Math.max(1, Math.round(hours * 0.35));
  const build = Math.max(1, hours - learn - practice);
  return { learn, practice, build };
}

function cleanDescription(description) {
  if (!description) return "";
  return String(description).trim().replace(/[.\s]+$/, "");
}

/** Four sub-steps for one roadmap item. */
export function buildStudyPlan(item, careerName) {
  const career = careerName || "your target career";

  if (!item?.skillName) {
    const { learn, practice, build } = splitHours(item?.estimatedHours);
    return [
      {
        key: "review",
        kind: "review",
        hours: learn,
        title: "Review every skill you have covered",
        detail: `List the ${career} skills from the previous phases, then pick the two strongest ones to combine. Keep the scope small enough to finish.`,
      },
      {
        key: "build",
        kind: "build",
        hours: practice + build,
        title: "Build one end-to-end deliverable",
        detail: "Turn those skills into a single working project: an app, analysis or campaign that a hiring manager can open and understand in a few minutes.",
      },
      {
        key: "document",
        kind: "document",
        hours: 0,
        title: "Write the story around it",
        detail: "Add a short README: the problem, your approach, the result and what you would improve next. Link it from your CV and LinkedIn.",
      },
      {
        key: "prove",
        kind: "prove",
        hours: 0,
        title: "Present it and re-take the assessment",
        detail: `Walk a friend or mentor through the work in five minutes, then re-take the ${career} assessment to confirm your new level.`,
      },
    ];
  }

  const guide = CATEGORY_GUIDE[item.skillCategory] || CATEGORY_GUIDE.OTHER;
  const { learn, practice, build } = splitHours(item.estimatedHours);
  const description = cleanDescription(item.description);
  const proveDetail = item.targetPercent
    ? `Re-take the ${career} assessment to measure ${item.skillName}. The target is ${item.targetPercent}%${item.assessed ? ` and you measured ${item.scorePercent}% last time` : ""}. When you reach it, mark this step complete.`
    : `Re-take the ${career} assessment to measure ${item.skillName}, then mark this step complete once you have evidence to show.`;

  return [
    {
      key: "learn",
      kind: "learn",
      hours: learn,
      title: `Study the core of ${item.skillName}`,
      detail: `${guide.learn}.${description ? ` Use this step as your syllabus: ${description}.` : ""} Aim to explain the main ideas in your own words before moving on.`,
    },
    {
      key: "practice",
      kind: "practice",
      hours: practice,
      title: `Practise ${item.skillName} on a realistic task`,
      detail: `${guide.practice}. Work slowly enough that you can explain every step, and keep the exercise somewhere you can revisit it.`,
    },
    {
      key: "build",
      kind: "build",
      hours: build,
      title: `Build ${guide.artifact}`,
      detail: `Turn the practice into proof: create ${guide.artifact} that shows ${item.skillName} doing real work. Add one sentence to your CV explaining the result.`,
    },
    {
      key: "prove",
      kind: "prove",
      hours: 0,
      title: "Check your level and complete the step",
      detail: proveDetail,
    },
  ];
}
