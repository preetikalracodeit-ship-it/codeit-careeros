import { getStudentProfile } from "../students/student.service.js";
import { getStudentReadiness } from "../students/readiness.service.js";
import { getAttemptHistory } from "../students/attempt-history.service.js";
import { getMyRoadmap } from "../roadmaps/roadmap.service.js";
import { getRecommendedProjects } from "../projects/project.service.js";
import { analyzeLinkedInProfile } from "../linkedin/linkedin.service.js";
import { analyzeCvFor } from "../cvs/cv.service.js";
import { getMyImprovementPlans } from "../improvement/improvement.service.js";
import { getMyApplications, getMyDrives } from "../placements/placement.service.js";

export interface GuidanceResult {
  reply: string;
  toolsUsed: string[];
}

type Snapshot = {
  profile: Awaited<ReturnType<typeof getStudentProfile>>;
  readiness: Awaited<ReturnType<typeof getStudentReadiness>>;
  roadmap: Awaited<ReturnType<typeof getMyRoadmap>>;
  projects: Awaited<ReturnType<typeof getRecommendedProjects>>;
  cv: Awaited<ReturnType<typeof analyzeCvFor>>;
  linkedIn: Awaited<ReturnType<typeof analyzeLinkedInProfile>>;
  attempts: Awaited<ReturnType<typeof getAttemptHistory>>;
  plans: Awaited<ReturnType<typeof getMyImprovementPlans>>;
  drives: Awaited<ReturnType<typeof getMyDrives>>;
  applications: Awaited<ReturnType<typeof getMyApplications>>;
};

function containsAny(text: string, values: string[]): boolean {
  return values.some((value) => text.includes(value));
}

function isGreeting(text: string): boolean {
  return /^(hi|hello|hey|hiya|good morning|good afternoon|good evening|namaste)\b/i.test(text.trim());
}

function isHelp(text: string): boolean {
  return containsAny(text, ["what can you do", "how can you help", "help me with", "what do you do", "who are you"]);
}

function isFollowUp(text: string): boolean {
  const value = text.trim().toLowerCase();
  if (/^(it|that|this|that one|this one|more|tell me more|explain more|why\?*|how\?*)[?.!\s]*$/.test(value)) return true;
  return value.length < 70
    && /(\bit\b|\bthat\b|\bthis\b|\bthey\b)/.test(value)
    && containsAny(value, ["why is", "why should", "how good am i", "am i good", "what should i", "tell me more", "useful", "benefit", "drawback"]);
}

function isGeneralQuestion(text: string): boolean {
  return /^(explain|describe|define|what is|what are|how does|how do i use|difference between|give me interview|interview questions|write |list )/i.test(text.trim())
    || containsAny(text, [" vs ", "interview questions", "code example", "tutorial", "trending"]);
}

function hasPersonalAsk(text: string): boolean {
  return containsAny(text, [
    "my ", " i ", "am i", "for me", "based on my", "should i", "how good am i",
    "my gap", "my weak", "my skill", "my readiness", "my progress", "my career",
  ]);
}

const GENERAL_TOPICS: { match: RegExp; title: string; body: string }[] = [
  {
    match: /\bjava\b/i,
    title: "Java",
    body: "Java is a statically typed, object-oriented language that runs on the JVM. Focus on collections, exceptions, generics, concurrency basics, and the Spring ecosystem for backend work. A practical path is: core syntax -> OOP -> collections/streams -> JDBC/SQL -> Spring Boot REST APIs -> testing.",
  },
  {
    match: /\bpython\b/i,
    title: "Python",
    body: "Python is a readable, general-purpose language with strong data and automation libraries. Learn syntax, data structures, functions, modules, virtual environments, and one domain such as data analysis (pandas) or web APIs (FastAPI/Flask).",
  },
  {
    match: /\bjavascript\b|\bjs\b/i,
    title: "JavaScript",
    body: "JavaScript powers interactive web pages and Node.js services. Build fluency in functions, scope, async/await, promises, DOM events, fetch, and ES modules. Then learn one framework (React) and browser debugging.",
  },
  {
    match: /\breact\b/i,
    title: "React",
    body: "React is a component-based UI library. Learn components, props, state, hooks (useState/useEffect), lists and keys, forms, and data fetching. Build a small CRUD app and practise splitting reusable components.",
  },
  {
    match: /\bsql\b|\bdatabase\b/i,
    title: "SQL and databases",
    body: "SQL is the language of relational data. Practise SELECT/WHERE/ORDER BY, joins, GROUP BY with aggregates, subqueries, indexes, and transactions. For interviews, be ready to explain the difference between INNER and LEFT joins and how indexes speed reads.",
  },
  {
    match: /\bdocker\b/i,
    title: "Docker",
    body: "Docker packages an application and its dependencies into an image. Learn Dockerfiles, images vs containers, ports, volumes, environment variables, and docker compose for multi-service apps.",
  },
  {
    match: /\bkubernetes\b|\bk8s\b/i,
    title: "Kubernetes",
    body: "Kubernetes orchestrates containers. Start with pods, deployments, services, config maps, and secrets. Learn how readiness/liveness probes and horizontal scaling work before moving to Helm and operators.",
  },
  {
    match: /\bspring boot\b|\bspring\b/i,
    title: "Spring Boot",
    body: "Spring Boot builds production-ready Java services quickly. Learn dependency injection, REST controllers, validation, JPA repositories, transactions, and configuration. Practise building a CRUD API with tests.",
  },
  {
    match: /\bdsa\b|\balgorithm|\bdata structure/i,
    title: "Data structures and algorithms",
    body: "Start with arrays, strings, hash maps, stacks/queues, linked lists, trees, and graphs. Practise patterns: two pointers, sliding window, binary search, recursion, BFS/DFS, and dynamic programming. Aim for consistent daily practice over long grinding sessions.",
  },
  {
    match: /\boop\b|\bobject oriented/i,
    title: "Object-oriented programming",
    body: "OOP organises code around objects that combine data and behaviour. Learn encapsulation, inheritance, polymorphism, and abstraction, then practise composition over inheritance and SOLID principles.",
  },
  {
    match: /\bgit\b|\bgithub\b/i,
    title: "Git and GitHub",
    body: "Git tracks versions locally; GitHub hosts and collaborates. Learn clone, status, add, commit, branch, merge, pull/push, pull requests, and resolving conflicts. Commit small, describe why, and keep a clean history.",
  },
  {
    match: /\bmachine learning\b|\bml\b|\bai\b/i,
    title: "Machine learning",
    body: "Machine learning finds patterns in data to make predictions. Learn the workflow: problem framing, data cleaning, train/test split, baseline model, evaluation metrics, and iteration. Start with regression and classification before deep learning.",
  },
];

function generalAnswer(message: string): { title: string; body: string } | null {
  for (const topic of GENERAL_TOPICS) {
    if (topic.match.test(message)) return topic;
  }
  if (/interview/i.test(message)) {
    return {
      title: "Interview preparation",
      body: "Structure answers with situation, action, and result. For technical rounds, explain your reasoning before writing code, state assumptions, and test edge cases aloud. Prepare two strong project stories and be ready to discuss trade-offs.",
    };
  }
  return null;
}

function levelWord(level: string | null | undefined): string {
  if (!level) return "Not assessed";
  return level.toLowerCase().replaceAll("_", " ").replace(/^\w/, (char) => char.toUpperCase());
}

async function loadSnapshotFor(userId: number): Promise<Snapshot> {
  const [profile, readiness, roadmap, projects, cv, linkedIn, attempts, plans, drives, applications] = await Promise.all([
    getStudentProfile(userId),
    getStudentReadiness(userId),
    getMyRoadmap(userId),
    getRecommendedProjects(userId),
    analyzeCvFor(userId),
    analyzeLinkedInProfile(userId),
    getAttemptHistory(userId),
    getMyImprovementPlans(userId),
    getMyDrives(userId),
    getMyApplications(userId),
  ]);
  return { profile, readiness, roadmap, projects, cv, linkedIn, attempts, plans, drives, applications };
}

const ALL_TOOLS = [
  "getStudentProfile", "getReadiness", "getRoadmap", "getProjects", "getCvAnalysis",
  "getLinkedInAnalysis", "getAssessmentHistory", "getImprovementPlans", "getPlacements",
];

function greetingReply(snapshot: Snapshot): GuidanceResult {
  const first = snapshot.profile.fullName?.split(/\s+/)[0] || "there";
  const readiness = snapshot.readiness.hasTarget
    ? `You are currently **${snapshot.readiness.readinessPercent}% ready** for ${snapshot.readiness.targetCareerName}.`
    : "You have not picked a target career yet.";
  return {
    reply: `Hi ${first}! I am your CareerOS career assistant.\n\n${readiness}\n\nI can help with readiness, skill gaps, roadmap steps, projects, your CV, LinkedIn, assessments, placements, and improvement tasks. What would you like to work on?`,
    toolsUsed: ["getStudentProfile", "getReadiness"],
  };
}

function helpReply(snapshot: Snapshot): GuidanceResult {
  const first = snapshot.profile.fullName?.split(/\s+/)[0] || "there";
  return {
    reply: `Hi ${first}! Here is what I can do using your live CareerOS data:\n\n- **Readiness and skill gaps:** where you stand and what to improve first\n- **Roadmap and projects:** what to learn next and what to build\n- **CV review:** ATS score, sections, matched and missing skills\n- **LinkedIn review:** completeness, alignment, and suggestions\n- **Assessment and placements:** recent scores, drives, applications, and offers\n- **Improvement plan:** tasks your college created for you\n\nAsk me things like "What are my biggest skill gaps?" or "What should I learn next?"`,
    toolsUsed: ["getStudentProfile"],
  };
}

function readinessReply(snapshot: Snapshot): string {
  const readiness = snapshot.readiness;
  if (!readiness.hasTarget) {
    return "**Career readiness**\n\nYou have not selected a target career yet. Choose one under **Career paths** and I can compare your skills against what that role needs.";
  }
  const lines = [
    `**Career readiness for ${readiness.targetCareerName}**`,
    "",
    `You are **${readiness.readinessPercent}% ready** (${levelWord(readiness.readinessLevel)}).`,
    "",
    `- Skills on target: **${readiness.metSkills} of ${readiness.totalSkills}**`,
    `- Skills assessed: **${readiness.assessedSkills} of ${readiness.totalSkills}**`,
    `- Submitted assessments: **${readiness.submittedAttempts}**`,
  ];
  if (readiness.strengths.length > 0) {
    lines.push("", "**Strengths**");
    for (const gap of readiness.strengths) lines.push(`- ${gap.skillName}: ${gap.scorePercent}% (target ${gap.targetPercent}%)`);
  }
  if (readiness.improvements.length > 0) {
    lines.push("", "**Focus next**");
    for (const gap of readiness.improvements) {
      lines.push(`- ${gap.skillName}: ${gap.assessed ? `${gap.scorePercent}% vs ${gap.targetPercent}% target` : `not assessed yet, target ${gap.targetPercent}%`}`);
    }
  }
  lines.push("", "Take a short assessment for any unassessed skill so this picture gets sharper.");
  return lines.join("\n");
}

function roadmapReply(snapshot: Snapshot): string {
  const roadmap = snapshot.roadmap;
  if (!roadmap.hasTarget) {
    return "**Your roadmap**\n\nPick a target career first and CareerOS will build a phase-by-phase learning path for you.";
  }
  if (roadmap.totalItems === 0) {
    return `**Your roadmap**\n\nThere is no published roadmap for **${roadmap.careerName}** yet. You can still work on the skill gaps shown in your readiness report.`;
  }
  const nextItems = roadmap.phases
    .flatMap((phase) => phase.items.map((item) => ({ ...item, phase: phase.title })))
    .filter((item) => item.status !== "COMPLETED")
    .slice(0, 3);
  const lines = [
    `**Your roadmap for ${roadmap.careerName}**`,
    "",
    `You have completed **${roadmap.completedItems} of ${roadmap.totalItems} steps (${roadmap.progressPercent}%)**, with ${roadmap.inProgressItems} in progress.`,
  ];
  if (nextItems.length > 0) {
    lines.push("", "**Suggested next steps**");
    for (const item of nextItems) lines.push(`- ${item.title} (${item.phase})${item.estimatedHours ? ` - about ${item.estimatedHours} hours` : ""}`);
  } else {
    lines.push("", "Every step is complete. Revisit a phase or build a portfolio project to keep growing.");
  }
  return lines.join("\n");
}

function projectsReply(snapshot: Snapshot): string {
  const projects = snapshot.projects;
  if (!projects.hasTarget || projects.totalProjects === 0) {
    return "**Projects**\n\nThere are no recommended projects for your target career yet. Pick a career under **Career paths** to unlock project suggestions.";
  }
  const pending = projects.projects.filter((project) => project.status !== "COMPLETED").slice(0, 3);
  const lines = [
    "**Recommended projects**",
    "",
    `You have completed **${projects.completedProjects} of ${projects.totalProjects}** projects, with ${projects.inProgressProjects} in progress.`,
  ];
  if (pending.length > 0) {
    lines.push("", "**Best next builds**");
    for (const project of pending) {
      const skills = project.skills.slice(0, 3).map((skill) => skill.skillName).join(", ");
      lines.push(`- **${project.title}** - ${levelWord(project.difficulty)}${project.estimatedWeeks ? `, about ${project.estimatedWeeks} weeks` : ""}${skills ? ` - proves ${skills}` : ""}`);
    }
    lines.push("", "Choose one project that uses a skill you are currently weakest at. Shipping it turns a gap into evidence.");
  }
  return lines.join("\n");
}

function cvReply(snapshot: Snapshot): string {
  const cv = snapshot.cv;
  if (!cv.hasCv) {
    return "**CV review**\n\nYou have not uploaded a CV yet. Open **CV Analysis**, upload a PDF or DOCX, and I can review ATS readability, sections, and how your skills match your target career.";
  }
  const lines = [
    "**CV review**",
    "",
    `Overall score: **${cv.overallScore}%** - ATS readability: **${cv.atsScore}%** - completeness: **${cv.completeness.scorePercent}%**.`,
    "",
    `I detected **${cv.detectedSkills.length} skills** and matched **${cv.matchedSkills.length}** against ${cv.careerName ?? "your target career"}.`,
  ];
  if (cv.missingSkills.length > 0) {
    lines.push("", "**Missing framework skills**");
    for (const gap of cv.missingSkills.slice(0, 5)) lines.push(`- ${gap.skillName} (target ${gap.targetPercent}%)`);
    lines.push("", "Add only the skills you genuinely have. Then back them up with a project bullet or certification.");
  }
  const failed = cv.sections.filter((section) => !section.passed);
  if (failed.length > 0) {
    lines.push("", "**Sections to improve**");
    for (const section of failed.slice(0, 4)) lines.push(`- ${section.title}: ${section.note}`);
  }
  if (cv.completeness.suggestions.length > 0) {
    lines.push("", `Top suggestion: ${cv.completeness.suggestions[0]}`);
  }
  return lines.join("\n");
}

function linkedInReply(snapshot: Snapshot): string {
  const linkedIn = snapshot.linkedIn;
  if (!linkedIn.hasProfile) {
    return "**LinkedIn review**\n\nYou have not connected a LinkedIn profile yet. Open **LinkedIn review**, save your profile URL and summary, and I can score completeness and alignment with your target career.";
  }
  const lines = [
    "**LinkedIn review**",
    "",
    `Completeness: **${linkedIn.completenessPercent}%** - career alignment: **${linkedIn.alignmentPercent}%**.`,
    "",
    `Skills detected: **${linkedIn.detectedSkills.length}**${linkedIn.hasTarget ? `; ${linkedIn.matchedSkills.length} of ${linkedIn.matchedSkills.length + linkedIn.missingSkills.length} target skills matched` : ""}.`,
  ];
  if (linkedIn.suggestions.length > 0) {
    lines.push("", "**Suggestions**");
    for (const suggestion of linkedIn.suggestions.slice(0, 4)) lines.push(`- ${suggestion}`);
  }
  return lines.join("\n");
}

function assessmentReply(snapshot: Snapshot): string {
  const attempts = snapshot.attempts;
  if (attempts.length === 0) {
    return "**Assessments**\n\nYou have not submitted an assessment yet. Take one from the **Assessments** page so readiness and gap analysis become accurate.";
  }
  const lines = ["**Recent assessments**", ""];
  for (const attempt of attempts.slice(0, 4)) {
    lines.push(`- **${attempt.assessmentTitle}** (${attempt.careerName}): ${attempt.overallScore ?? "-"}% - ${attempt.answeredCount}/${attempt.totalQuestions} answered`);
  }
  lines.push("", "Skill-wise scores update automatically after each submission, so retake a weak area after studying rather than guessing.");
  return lines.join("\n");
}

function placementsReply(snapshot: Snapshot): string {
  const drives = snapshot.drives.items;
  const applications = snapshot.applications.items;
  const open = drives.filter((item) => item.drive.status === "REGISTRATION_OPEN" && !item.alreadyApplied);
  const offers = applications.filter((application) => application.offer);
  const lines = [
    "**Placements**",
    "",
    `- Visible drives: **${drives.length}** (${open.length} open for registration)`,
    `- Your applications: **${applications.length}**`,
    `- Offers: **${offers.length}**`,
  ];
  if (open.length > 0) {
    lines.push("", "**Open drives you can register for**");
    for (const item of open.slice(0, 4)) lines.push(`- ${item.drive.name} at ${item.drive.companyName}${item.drive.registrationEnd ? ` - closes ${new Date(item.drive.registrationEnd).toLocaleDateString()}` : ""}`);
  }
  if (offers.length > 0) {
    lines.push("", "**Offers needing attention**");
    for (const application of offers) {
      if (application.offer?.status === "PENDING") lines.push(`- ${application.companyName}: offer pending your response`);
    }
  }
  lines.push("", "Before registering, check the eligibility criteria and keep your readiness score current.");
  return lines.join("\n");
}

function improvementReply(snapshot: Snapshot): string {
  const plans = snapshot.plans.items;
  if (plans.length === 0) {
    return "**Improvement plan**\n\nNo plan has been created for you yet. Your college creates these after reviewing assessment gaps; keep your assessments and target career up to date.";
  }
  const lines = ["**Your improvement plan**", ""];
  for (const plan of plans.slice(0, 3)) {
    lines.push(`**${plan.title}** - ${plan.completedTasks}/${plan.totalTasks} tasks (${plan.progressPercent}%)`);
    const pending = plan.tasks.filter((task) => task.status !== "COMPLETED").slice(0, 3);
    for (const task of pending) {
      lines.push(`- ${task.title}${task.overdue ? " (overdue)" : ""}${task.targetDate ? ` - target ${new Date(task.targetDate).toLocaleDateString()}` : ""}`);
    }
  }
  lines.push("", "Tick tasks off in **Improvement Plan** as you finish them so your mentor sees real progress.");
  return lines.join("\n");
}

function profileReply(snapshot: Snapshot): string {
  const profile = snapshot.profile;
  return [
    "**Your profile**",
    "",
    `- Name: **${profile.fullName}**`,
    `- Student ID: **${profile.studentId}**`,
    `- Target career: **${profile.targetCareerName ?? "Not selected"}**`,
    `- Branch: **${profile.branch ?? "-"}**`,
    `- Graduation year: **${profile.graduationYear ?? "-"}**`,
    "",
    snapshot.readiness.hasTarget
      ? `You are ${snapshot.readiness.readinessPercent}% ready, with ${snapshot.readiness.metSkills} of ${snapshot.readiness.totalSkills} skills on target.`
      : "Choose a target career to unlock readiness and a roadmap.",
  ].join("\n");
}

function overviewReply(snapshot: Snapshot): string {
  const readiness = snapshot.readiness;
  const lines = [
    "**Your CareerOS snapshot**",
    "",
    readiness.hasTarget
      ? `- Readiness for ${readiness.targetCareerName}: **${readiness.readinessPercent}%** (${levelWord(readiness.readinessLevel)})`
      : "- Target career: **not selected**",
    `- Roadmap: **${snapshot.roadmap.completedItems}/${snapshot.roadmap.totalItems}** steps`,
    `- Projects: **${snapshot.projects.completedProjects}/${snapshot.projects.totalProjects}** complete`,
    `- CV: **${snapshot.cv.hasCv ? `${snapshot.cv.overallScore}% overall` : "not uploaded"}**`,
    `- LinkedIn: **${snapshot.linkedIn.hasProfile ? `${snapshot.linkedIn.completenessPercent}% complete` : "not connected"}**`,
    `- Open placement drives: **${snapshot.drives.items.filter((item) => item.drive.status === "REGISTRATION_OPEN").length}**`,
  ];
  if (readiness.improvements.length > 0) {
    lines.push("", "**What I would do first**");
    for (const gap of readiness.improvements.slice(0, 3)) lines.push(`- Improve ${gap.skillName} (${gap.assessed ? `${gap.scorePercent}% vs ${gap.targetPercent}%` : `target ${gap.targetPercent}%`})`);
  }
  lines.push("", "Ask me about any of these areas and I will go deeper.");
  return lines.join("\n");
}

function noTargetReply(): string {
  return "**Career readiness**\n\nYou have not chosen a target career yet. Pick one under **Career paths** so I can compare your skills, build a roadmap, and tell you what to focus on next.";
}

function resolvedMessage(message: string, history: string[]): string {
  if (!isFollowUp(message)) return message;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (!entry || entry.trim().length < 8) continue;
    if (isGreeting(entry)) continue;
    return `${message} [context: ${entry.slice(0, 200)}]`;
  }
  return message;
}

export async function generateGuidance(userId: number, message: string, history: string[] = []): Promise<GuidanceResult> {
  const raw = resolvedMessage(message.trim(), history);
  const lower = raw.toLowerCase();

  if (isGreeting(lower)) {
    const snapshot = await loadSnapshotFor(userId);
    return greetingReply(snapshot);
  }

  const general = generalAnswer(raw);
  const personal = hasPersonalAsk(lower);
  const generalQuestion = isGeneralQuestion(raw) || Boolean(general);

  if (isHelp(lower) && !generalQuestion) {
    const snapshot = await loadSnapshotFor(userId);
    return helpReply(snapshot);
  }

  if (generalQuestion && !personal) {
    if (general) {
      return {
        reply: `**${general.title}**\n\n${general.body}\n\nWant me to connect this to your target career? Ask "How good am I at ${general.title}?" and I will check your readiness data.`,
        toolsUsed: [],
      };
    }
    return {
      reply: "I can answer general questions about common technologies and interview preparation, or use your live CareerOS data for readiness, gaps, roadmap, projects, CV, LinkedIn, assessments, placements, and improvement plans. Ask about a specific technology or your own progress.",
      toolsUsed: [],
    };
  }

  const snapshot = await loadSnapshotFor(userId);

  if (general && personal) {
    const base = readinessReply(snapshot);
    return {
      reply: `**${general.title}**\n\n${general.body}\n\n---\n\n${base}`,
      toolsUsed: ALL_TOOLS,
    };
  }

  if (!snapshot.readiness.hasTarget) {
    return { reply: noTargetReply(), toolsUsed: ["getStudentProfile", "getReadiness"] };
  }

  if (containsAny(lower, ["improvement plan", "my task", "task status", "plan task"])) {
    return { reply: improvementReply(snapshot), toolsUsed: ["getImprovementPlans"] };
  }
  if (containsAny(lower, ["placement", "drive", "job", "application", "offer", "registered", "company"])) {
    return { reply: placementsReply(snapshot), toolsUsed: ["getPlacements"] };
  }
  if (containsAny(lower, ["cv", "resume", "curriculum"])) {
    return { reply: cvReply(snapshot), toolsUsed: ["getCvAnalysis", "getReadiness"] };
  }
  if (containsAny(lower, ["linkedin"])) {
    return { reply: linkedInReply(snapshot), toolsUsed: ["getLinkedInAnalysis", "getReadiness"] };
  }
  if (containsAny(lower, ["assessment", "test", "exam", "score", "result", "attempt", "quiz", "marks"])) {
    return { reply: assessmentReply(snapshot), toolsUsed: ["getAssessmentHistory"] };
  }
  if (containsAny(lower, ["project", "portfolio", "build", "practice"])) {
    return { reply: projectsReply(snapshot), toolsUsed: ["getProjects"] };
  }
  if (containsAny(lower, ["roadmap", "learn next", "what should i learn", "next step", "focus", "30-day", "30 day", "plan", "week", "step should"])) {
    return { reply: roadmapReply(snapshot), toolsUsed: ["getRoadmap"] };
  }
  if (containsAny(lower, ["gap", "missing", "weak", "improve", "skill", "readiness", "ready", "how am i doing"])) {
    return { reply: readinessReply(snapshot), toolsUsed: ["getReadiness"] };
  }
  if (containsAny(lower, ["career", "target", "profile", "who am i", "about me"])) {
    return { reply: profileReply(snapshot), toolsUsed: ["getStudentProfile", "getReadiness"] };
  }
  return { reply: overviewReply(snapshot), toolsUsed: ALL_TOOLS };
}
