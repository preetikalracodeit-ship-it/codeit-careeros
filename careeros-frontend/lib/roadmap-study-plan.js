/**
 * Turns one roadmap item into a short, concrete study plan.
 *
 * The backend owns the step content (title, description, learning goal,
 * estimated hours, skill and target). This module only breaks that data into
 * the four sub-steps a student should actually work through, with guidance
 * tuned to the skill category. Nothing here is career-specific state: the
 * same item always produces the same plan.
 *
 * `topics` is the detailed "what to study" checklist for the step. Tokens are
 * filled from the item so the list stays useful for every skill and career.
 */

const CATEGORY_GUIDE = {
  PROGRAMMING_LANGUAGES: {
    learn: "Learn the syntax, data types and control flow",
    topics: [
      "{skill} syntax: variables, data types, operators and type conversions",
      "Control flow: conditionals, loops, functions and scope",
      "Collections and strings: lists, maps, sets and common operations",
      "Errors and debugging: reading stack traces and handling exceptions",
      "Modules, packages and dependency management",
      "Reading and writing files, plus one small automated test",
    ],
    practice: "Solve 5-8 small exercises without copying the solution",
    artifact: "a small script or program",
  },
  FRAMEWORKS: {
    learn: "Read the official getting-started guide and follow the project structure",
    topics: [
      "The official getting-started guide and the project structure",
      "Routing, components and state management in {skill}",
      "Data fetching, forms and input validation",
      "Authentication, error handling and logging",
      "Testing one feature and using the framework's debugging tools",
      "Build, configuration and deployment basics",
    ],
    practice: "Rebuild one example feature from scratch",
    artifact: "a small working feature or mini app",
  },
  DATABASES: {
    learn: "Understand the data model, keys and the queries this skill is used for",
    topics: [
      "Relational model: tables, rows, keys and relationships",
      "{skill} data types, constraints and indexes",
      "SELECT, JOIN, GROUP BY and subqueries",
      "INSERT, UPDATE, DELETE and transactions",
      "Query plans and basic performance tuning",
      "Backups, users and least-privilege access",
    ],
    practice: "Write and explain 10 queries against a sample schema",
    artifact: "a small schema with a set of queries",
  },
  CLOUD: {
    learn: "Learn the core services, the pricing model and the shared-responsibility model",
    topics: [
      "{skill} core services and how they fit together",
      "Accounts, regions, identity and access management",
      "Networking, storage and compute basics",
      "Pricing, budgets and the shared-responsibility model",
      "Deploying and monitoring one small workload",
      "Security groups, secrets and backup basics",
    ],
    practice: "Deploy one small workload on a free-tier account",
    artifact: "a deployed and documented mini environment",
  },
  DEVOPS: {
    learn: "Learn the pipeline stages and the core commands of the tool",
    topics: [
      "{skill} pipeline stages: build, test, package and deploy",
      "Core commands and configuration syntax",
      "Version control, branching and pull-request workflow",
      "Environment variables, secrets and configuration management",
      "Logging, monitoring and rollback",
      "Scripting one repeatable task end to end",
    ],
    practice: "Script one repeatable build, test or deploy task",
    artifact: "a small working pipeline or automation script",
  },
  DATA: {
    learn: "Define the question, the data shape and one analysis method",
    topics: [
      "The question, the dataset and the unit of analysis",
      "Data cleaning: missing values, duplicates and outliers",
      "{skill} basics: selection, filtering, grouping and joins",
      "Descriptive statistics and simple visualisation",
      "One analysis method such as trend, cohort or correlation",
      "Communicating three findings with their caveats",
    ],
    practice: "Clean and analyse a small real dataset",
    artifact: "a notebook or dashboard with three clear findings",
  },
  AI_ML: {
    learn: "Identify the problem type, the model options and the evaluation metric",
    topics: [
      "Problem framing: classification, regression or clustering",
      "{skill} workflow: data split, training, validation and test",
      "Features, labels and data leakage",
      "Model options and a simple baseline to compare against",
      "Evaluation metrics and error analysis",
      "Responsible AI: bias, privacy and limitations",
    ],
    practice: "Train and evaluate a small model on a public dataset",
    artifact: "a notebook or demo with honest results",
  },
  CYBERSECURITY: {
    learn: "Learn the threat model, common attack paths and the defensive controls",
    topics: [
      "Threat models, assets and attack surfaces",
      "{skill} controls: authentication, authorisation and encryption",
      "Common attack paths such as injection, XSS and misconfiguration",
      "Secure configuration and least-privilege access",
      "Logging, monitoring and incident-response basics",
      "Safe lab practice and responsible disclosure",
    ],
    practice: "Run a guided lab in a safe, isolated environment",
    artifact: "a short findings report with recommended fixes",
  },
  TESTING: {
    learn: "Learn the test pyramid, test design and the basics of the tool",
    topics: [
      "The test pyramid: unit, integration and end-to-end",
      "{skill} test structure: arrange, act, assert",
      "Equivalence partitions, boundary values and edge cases",
      "Mocks, fixtures and test data",
      "Reading failures and writing useful bug reports",
      "CI test runs, coverage and flaky-test handling",
    ],
    practice: "Write and run a small suite against a sample application",
    artifact: "a test suite plus a short defect report",
  },
  SOFT_SKILLS: {
    learn: "Learn the behaviours and phrases that make this skill visible to others",
    topics: [
      "What {skill} looks like in everyday work, and what good looks like",
      "The vocabulary and phrases that signal {skill}",
      "Structuring a clear written update or message",
      "Listening, questioning and giving or receiving feedback",
      "Handling disagreement or pressure in a real conversation",
      "Reflecting on one example and asking a mentor for feedback",
    ],
    practice: "Use it in one real conversation, meeting or written update",
    artifact: "a short reflection or artefact that shows the skill in action",
  },
  OTHER: {
    learn: "Learn the key concepts and vocabulary",
    topics: [
      "Core concepts and vocabulary of {skill}",
      "How {skill} is used in real {career} work",
      "One authoritative tutorial or reference to follow",
      "Common mistakes and how to avoid them",
      "A small realistic task that uses {skill}",
      "How to explain your result to a non-expert",
    ],
    practice: "Apply it to one small, realistic task",
    artifact: "a small, shareable deliverable",
  },
};

const CAPSTONE_TOPICS = [
  "List every skill from the previous phases and rate your confidence from 1 to 5",
  "Pick two weak skills and one strong skill to combine",
  "Find one real {career} job description and map its requirements to your skills",
  "Choose a deliverable small enough to finish in the available hours",
  "Write acceptance criteria: what must work for the project to count as done",
  "Plan the README, demo and CV bullet before you start building",
];

function fillTopics(topics, item, career) {
  return topics.map((topic) =>
    topic.replaceAll("{skill}", item.skillName || "this skill").replaceAll("{career}", career),
  );
}

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
        topics: fillTopics(CAPSTONE_TOPICS, item || {}, career),
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
      detail: `${guide.learn}. Work through the topics below in order, and explain each one in your own words before moving on.${description ? ` Your step syllabus: ${description}.` : ""}`,
      topics: fillTopics(guide.topics, item, career),
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
