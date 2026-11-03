/**
 * Demo catalog used by `npm run seed:demo`.
 *
 * The seed is idempotent: it upserts this content so a local database always
 * has enough skills, careers, questions, roadmaps and projects for every
 * student flow (assessment, roadmap, projects, CV, LinkedIn) to work.
 */

export type Difficulty = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export interface DemoSkill {
  name: string;
  category: string;
  description: string;
}

export interface DemoQuestion {
  question: string;
  options: string[];
  correct: number;
  difficulty: Difficulty;
  explanation: string;
}

export interface DemoWeight {
  name: string;
  weightPercent: number;
  targetPercent: number;
  requiredLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
}

export interface DemoCareer {
  name: string;
  category: string;
  difficultyLevel: Difficulty;
  description: string;
  assessmentTitle: string;
  assessmentDescription: string;
  durationMinutes: number;
  weights: DemoWeight[];
  /** Optional hand-written capstone project appended to the generated set. */
  capstone?: { title: string; description: string; difficulty: Difficulty; estimatedWeeks: number };
}

export const SKILLS: DemoSkill[] = [
  { name: "Problem Solving", category: "Aptitude", description: "Break problems down and choose effective solutions." },
  { name: "Communication", category: "Soft Skills", description: "Explain ideas clearly to technical and non-technical audiences." },
  { name: "JavaScript", category: "Programming", description: "Build interactive behaviour with modern JavaScript." },
  { name: "Data Structures", category: "Computer Science", description: "Choose and use the right data structures." },
  { name: "SQL", category: "Data", description: "Query and transform relational data with SQL." },
  { name: "System Design", category: "Engineering", description: "Design reliable, scalable software systems." },
  { name: "HTML & CSS", category: "Frontend", description: "Structure and style accessible web interfaces." },
  { name: "React", category: "Frontend", description: "Build component-driven user interfaces with React." },
  { name: "Node.js", category: "Backend", description: "Build server-side applications with Node.js." },
  { name: "TypeScript", category: "Programming", description: "Write safer JavaScript with static types." },
  { name: "Python", category: "Programming", description: "Script, analyse data and build services in Python." },
  { name: "Statistics", category: "Data", description: "Reason about data, uncertainty and experiments." },
  { name: "Data Visualization", category: "Data", description: "Turn data into clear, honest visuals." },
  { name: "Machine Learning", category: "AI", description: "Train and evaluate models that learn from data." },
  { name: "Git & Version Control", category: "Engineering", description: "Track changes and collaborate with Git." },
  { name: "REST APIs", category: "Backend", description: "Design and consume predictable HTTP APIs." },
  { name: "Cloud Fundamentals", category: "Cloud", description: "Use core cloud compute, storage and networking concepts." },
  { name: "Docker", category: "DevOps", description: "Package and run applications in containers." },
  { name: "Linux", category: "DevOps", description: "Work confidently on the Linux command line." },
  { name: "CI/CD", category: "DevOps", description: "Automate testing, building and deployment." },
  { name: "Security Fundamentals", category: "Security", description: "Apply secure defaults and protect user data." },
  { name: "Product Thinking", category: "Product", description: "Choose the right problems and measure value." },
  { name: "Agile & Scrum", category: "Product", description: "Plan and deliver work in short, feedback-driven cycles." },
  { name: "UI/UX Design", category: "Design", description: "Design usable flows and accessible interfaces." },
  { name: "Figma", category: "Design", description: "Create and hand off interface designs in Figma." },
];

function q(
  question: string,
  options: string[],
  correct: number,
  difficulty: Difficulty,
  explanation: string,
): DemoQuestion {
  return { question, options, correct, difficulty, explanation };
}

export const QUESTION_BANK: Record<string, DemoQuestion[]> = {
  "Problem Solving": [
    q("A page is slow only for users in one region. What is the best first step?", ["Rewrite the whole page", "Reproduce the problem under the same regional conditions", "Add more servers immediately", "Ask users to refresh"], 1, "BEGINNER", "Reproduce before changing anything so you can verify the fix."),
    q("You have two possible fixes with similar effort. What should decide the order?", ["Whichever is more fun", "Impact, risk and confidence, validated with a small test", "The one with more code", "Alphabetical order"], 1, "INTERMEDIATE", "Prioritise by expected impact and risk, and validate assumptions."),
    q("A bug keeps returning after quick patches. What should you do?", ["Keep patching symptoms", "Find the root cause using logs and a minimal reproduction", "Ignore it", "Delete the feature"], 1, "ADVANCED", "Root-cause analysis prevents recurrence."),
  ],
  Communication: [
    q("A deadline will slip by a week. What is the best action?", ["Wait until the deadline passes", "Tell stakeholders early with the new timeline and impact", "Work silently overtime", "Blame another team"], 1, "BEGINNER", "Early, honest updates let others plan."),
    q("What should a good status update include?", ["Only good news", "Progress, blockers and the next action", "A full code diff", "A list of meetings"], 1, "BEGINNER", "Updates should make the next decision obvious."),
    q("A teammate misinterprets a requirement. What is the best response?", ["Continue and hope", "Restate the requirement and confirm shared understanding", "Escalate immediately", "Change the requirement"], 1, "INTERMEDIATE", "Confirming understanding prevents rework."),
  ],
  JavaScript: [
    q("Which keyword declares a block-scoped variable?", ["var", "let", "function", "class"], 1, "BEGINNER", "`let` (and `const`) are block scoped."),
    q("What does Promise.all do?", ["Resolves when all promises resolve, rejects on the first rejection", "Resolves on the first success", "Runs promises sequentially", "Ignores rejections"], 0, "INTERMEDIATE", "Promise.all waits for all and fails fast."),
    q("Which array method returns a new array of elements that pass a test?", ["map", "filter", "reduce", "forEach"], 1, "BEGINNER", "`filter` keeps elements that satisfy the predicate."),
  ],
  "Data Structures": [
    q("Which structure offers average O(1) lookup by key?", ["Array", "Hash map", "Linked list", "Stack"], 1, "BEGINNER", "Hash maps map keys to values in near-constant time."),
    q("Which structure is first-in, first-out?", ["Stack", "Queue", "Tree", "Heap"], 1, "BEGINNER", "Queues process items in arrival order."),
    q("Which structure is last-in, first-out?", ["Queue", "Stack", "Graph", "Set"], 1, "BEGINNER", "Stacks push and pop from the same end."),
  ],
  SQL: [
    q("Which clause filters rows after aggregation?", ["WHERE", "HAVING", "ORDER BY", "LIMIT"], 1, "INTERMEDIATE", "HAVING filters grouped results."),
    q("Which join returns every row from the left table?", ["INNER JOIN", "LEFT JOIN", "CROSS JOIN", "SELF JOIN"], 1, "BEGINNER", "LEFT JOIN keeps unmatched left rows."),
    q("Which statement changes existing rows?", ["INSERT", "UPDATE", "CREATE", "SELECT"], 1, "BEGINNER", "UPDATE modifies existing rows."),
  ],
  "System Design": [
    q("What does horizontal scaling mean?", ["Making one machine bigger", "Adding more machines", "Caching responses", "Compressing data"], 1, "BEGINNER", "Scale out by adding instances."),
    q("What is the purpose of a load balancer?", ["Store data", "Distribute traffic across servers", "Compile code", "Encrypt passwords"], 1, "BEGINNER", "Load balancers spread requests and improve availability."),
    q("Why add a cache in front of a database?", ["To reduce latency and backend load", "To replace backups", "To increase write durability", "To simplify schema design"], 0, "INTERMEDIATE", "Caching trades freshness for speed and lower load."),
  ],
  "HTML & CSS": [
    q("Which tag defines the main heading of a page?", ["<header>", "<h1>", "<title>", "<main>"], 1, "BEGINNER", "`h1` is the top-level heading."),
    q("Which CSS property controls space inside an element's border?", ["margin", "padding", "border", "gap"], 1, "BEGINNER", "Padding is inside the border."),
    q("Which layout mode suits one-dimensional rows or columns?", ["Grid", "Flexbox", "Float", "Table"], 1, "BEGINNER", "Flexbox is designed for one-dimensional layouts."),
  ],
  React: [
    q("Which hook manages local component state?", ["useEffect", "useState", "useMemo", "useRef"], 1, "BEGINNER", "`useState` stores local state."),
    q("Why do lists need stable keys?", ["To style items", "To help React identify items across renders", "To sort the list", "To fetch data"], 1, "INTERMEDIATE", "Keys let React reconcile list items correctly."),
    q("What usually triggers a re-render?", ["A CSS change", "A change in state or props", "A comment", "A console log"], 1, "BEGINNER", "React re-renders when state or props change."),
  ],
  "Node.js": [
    q("Node.js is built on which JavaScript engine?", ["SpiderMonkey", "V8", "JavaScriptCore", "Chakra"], 1, "BEGINNER", "Node.js uses V8."),
    q("Which core module creates an HTTP server?", ["fs", "http", "path", "os"], 1, "BEGINNER", "The `http` module provides server helpers."),
    q("What is npm?", ["A database", "A package manager", "A browser", "A language"], 1, "BEGINNER", "npm installs and manages JavaScript packages."),
  ],
  TypeScript: [
    q("What does an interface describe?", ["Runtime values", "The shape of an object", "A database table", "A CSS rule"], 1, "BEGINNER", "Interfaces describe object shapes at compile time."),
    q("Which type should be avoided when you want safety?", ["string", "number", "any", "unknown"], 2, "BEGINNER", "`any` disables type checking."),
    q("What is a union type?", ["A value that can be one of several types", "A merged object", "A loop", "A module"], 0, "INTERMEDIATE", "Unions model alternatives such as `string | number`."),
  ],
  Python: [
    q("Which keyword defines a function?", ["func", "def", "function", "lambda only"], 1, "BEGINNER", "`def` declares a function."),
    q("Which structure is immutable?", ["list", "dict", "tuple", "set"], 2, "BEGINNER", "Tuples cannot be changed after creation."),
    q("Which library is common for dataframes?", ["pandas", "flask", "requests", "pytest"], 0, "BEGINNER", "pandas provides DataFrames."),
  ],
  Statistics: [
    q("What does the mean measure?", ["Spread", "Average", "Maximum", "Correlation"], 1, "BEGINNER", "The mean is the arithmetic average."),
    q("What does standard deviation measure?", ["Spread around the mean", "The largest value", "The sample size", "Causation"], 0, "INTERMEDIATE", "It quantifies dispersion."),
    q("Correlation implies what?", ["Causation", "Association, not necessarily causation", "Nothing", "A linear model is always correct"], 1, "INTERMEDIATE", "Correlation alone cannot prove causation."),
  ],
  "Data Visualization": [
    q("Which chart best shows a trend over time?", ["Pie chart", "Line chart", "Scatter plot", "Table"], 1, "BEGINNER", "Line charts show change over time."),
    q("Which chart best shows part-to-whole?", ["Line chart", "Pie or stacked bar", "Histogram", "Box plot"], 1, "BEGINNER", "Part-to-whole comparisons suit pie or stacked bars."),
    q("What should every chart include?", ["3D effects", "Clear labels and a sensible scale", "As many colours as possible", "No title"], 1, "BEGINNER", "Labels and honest scales make charts readable."),
  ],
  "Machine Learning": [
    q("Supervised learning requires what?", ["Unlabeled data", "Labeled data", "Only images", "A GPU"], 1, "BEGINNER", "Supervised learning learns from labelled examples."),
    q("What does overfitting mean?", ["The model fits training data too closely and generalises poorly", "The model is too simple", "The data is missing", "Training is too fast"], 0, "INTERMEDIATE", "Overfit models memorise noise."),
    q("Why split data into train and test sets?", ["To evaluate generalisation", "To speed up training", "To remove labels", "To increase accuracy on training data"], 0, "INTERMEDIATE", "Held-out data estimates real-world performance."),
  ],
  "Git & Version Control": [
    q("Which command creates and switches to a new branch?", ["git merge", "git checkout -b feature", "git push", "git log"], 1, "BEGINNER", "`checkout -b` creates and switches."),
    q("What is a commit?", ["A snapshot of staged changes", "A remote server", "A branch", "A merge conflict"], 0, "BEGINNER", "Commits record snapshots with a message."),
    q("What does git pull do?", ["Deletes local changes", "Fetches and integrates remote changes", "Creates a tag", "Reverts a commit"], 1, "BEGINNER", "Pull fetches and merges or rebases."),
  ],
  "REST APIs": [
    q("Which HTTP method is conventionally idempotent for full updates?", ["POST", "PUT", "PATCH", "CONNECT"], 1, "INTERMEDIATE", "PUT replaces a resource and is idempotent."),
    q("Which status code means a resource was created?", ["200", "201", "204", "404"], 1, "BEGINNER", "201 Created."),
    q("What is a resource path?", ["A URL that identifies an entity", "A database password", "A CSS selector", "A log line"], 0, "BEGINNER", "REST paths identify resources."),
  ],
  "Cloud Fundamentals": [
    q("What is autoscaling?", ["Adjusting capacity to match demand", "Deleting servers", "Encrypting disks", "Writing tests"], 0, "BEGINNER", "Autoscaling adds or removes capacity."),
    q("What is object storage used for?", ["Files and blobs", "Relational joins", "Running containers", "DNS records"], 0, "BEGINNER", "Object storage stores unstructured files."),
    q("What is a cloud region?", ["A geographic location of data centres", "A programming language", "A billing plan", "A database index"], 0, "BEGINNER", "Regions group nearby data centres."),
  ],
  Docker: [
    q("What is a container?", ["An isolated process with its own filesystem view", "A virtual machine", "A database", "A network cable"], 0, "BEGINNER", "Containers share the host kernel but isolate the process."),
    q("What is a Dockerfile?", ["Instructions to build an image", "A running container", "A registry", "A log file"], 0, "BEGINNER", "Dockerfiles describe image builds."),
    q("What does a volume persist?", ["Data outside the container lifecycle", "Only logs", "The image", "Network rules"], 0, "INTERMEDIATE", "Volumes keep data after containers are removed."),
  ],
  Linux: [
    q("Which command lists files?", ["ls", "cd", "rm", "cat"], 0, "BEGINNER", "`ls` lists directory contents."),
    q("Which command changes file permissions?", ["chmod", "chown", "grep", "touch"], 0, "BEGINNER", "`chmod` changes permissions."),
    q("What does grep do?", ["Search text", "Copy files", "Start a server", "Compress archives"], 0, "BEGINNER", "grep searches for patterns."),
  ],
  "CI/CD": [
    q("What is continuous integration?", ["Automatically integrating and testing changes", "Deploying every minute", "Writing documentation", "Manual releases"], 0, "BEGINNER", "CI merges and tests changes frequently."),
    q("What is continuous delivery?", ["Keeping software deployable and shipping automatically or on demand", "Only running tests", "Writing infrastructure", "Manual QA only"], 0, "INTERMEDIATE", "CD keeps releases ready and repeatable."),
    q("Why keep pipelines fast?", ["Faster feedback and fewer blocked changes", "To use fewer servers", "To avoid tests", "To increase code size"], 0, "BEGINNER", "Fast feedback keeps changes small."),
  ],
  "Security Fundamentals": [
    q("What is the principle of least privilege?", ["Give every user the minimum access they need", "Give admins all access", "Share passwords", "Disable logging"], 0, "BEGINNER", "Least privilege limits blast radius."),
    q("What is phishing?", ["A deceptive message that steals credentials", "A database backup", "A type of firewall", "A code review"], 0, "BEGINNER", "Phishing tricks people into revealing secrets."),
    q("Where should secrets live?", ["In source code", "In a secret manager or environment configuration", "In chat", "In a public repo"], 1, "BEGINNER", "Secrets must never be committed to source control."),
  ],
  "Product Thinking": [
    q("What is a user story?", ["A need described from the user's perspective", "A database schema", "A design file", "A bug report"], 0, "BEGINNER", "User stories frame work around user value."),
    q("What is an MVP?", ["The smallest release that validates value", "A complete product", "A marketing site", "A test suite"], 0, "BEGINNER", "MVPs test the riskiest assumptions early."),
    q("What should prioritisation consider?", ["Impact, effort and risk", "Only effort", "Only opinions", "Alphabetical order"], 0, "INTERMEDIATE", "Balance value against cost and uncertainty."),
  ],
  "Agile & Scrum": [
    q("What is a sprint?", ["A short, time-boxed delivery cycle", "A permanent team", "A deployment", "A bug"], 0, "BEGINNER", "Sprints are fixed-length iterations."),
    q("What is the purpose of a retrospective?", ["Reflect and improve how the team works", "Assign blame", "Write code", "Plan marketing"], 0, "BEGINNER", "Retros drive continuous improvement."),
    q("What is a product backlog?", ["An ordered list of work", "A finished release", "A meeting", "A test plan"], 0, "BEGINNER", "Backlogs prioritise upcoming work."),
  ],
  "UI/UX Design": [
    q("What is a wireframe?", ["A low-fidelity layout", "A production build", "A database model", "A colour palette"], 0, "BEGINNER", "Wireframes communicate structure early."),
    q("What improves accessibility?", ["Sufficient contrast and clear labels", "Tiny text", "Colour-only meaning", "Auto-playing audio"], 0, "BEGINNER", "Contrast and labels help all users."),
    q("What is a user flow?", ["The path a user takes to complete a task", "A CSS animation", "A server log", "A data migration"], 0, "BEGINNER", "Flows describe steps toward a goal."),
  ],
  Figma: [
    q("What is a component in Figma?", ["A reusable UI element", "A browser", "A database", "A font"], 0, "BEGINNER", "Components keep designs consistent."),
    q("What does auto layout do?", ["Creates responsive layout constraints", "Compresses images", "Exports code", "Runs tests"], 0, "INTERMEDIATE", "Auto layout makes frames responsive."),
    q("What is a prototype?", ["An interactive flow for testing", "A final build", "A colour swatch", "A plugin"], 0, "BEGINNER", "Prototypes let teams test flows."),
  ],
};

export const CAREERS: DemoCareer[] = [
  {
    name: "Software Engineer",
    category: "Technology",
    difficultyLevel: "INTERMEDIATE",
    description: "Builds and maintains software products across the stack.",
    assessmentTitle: "Software Engineer Readiness Assessment",
    assessmentDescription: "Baseline readiness assessment covering problem solving, JavaScript, data structures, communication and system design.",
    durationMinutes: 30,
    weights: [
      { name: "Problem Solving", weightPercent: 25, targetPercent: 75, requiredLevel: "INTERMEDIATE" },
      { name: "JavaScript", weightPercent: 25, targetPercent: 80, requiredLevel: "INTERMEDIATE" },
      { name: "Data Structures", weightPercent: 20, targetPercent: 70, requiredLevel: "INTERMEDIATE" },
      { name: "Communication", weightPercent: 15, targetPercent: 65, requiredLevel: "INTERMEDIATE" },
      { name: "System Design", weightPercent: 15, targetPercent: 60, requiredLevel: "ADVANCED" },
    ],
    capstone: {
      title: "CampusHire: full-stack placement portal",
      description: "Build a placement portal where students browse drives and staff track applications. Use React, Node.js, REST APIs and a database, then deploy it.",
      difficulty: "ADVANCED",
      estimatedWeeks: 6,
    },
  },
  {
    name: "Data Analyst",
    category: "Data",
    difficultyLevel: "BEGINNER",
    description: "Turns data into decisions using SQL, statistics and storytelling.",
    assessmentTitle: "Data Analyst Readiness Assessment",
    assessmentDescription: "Baseline readiness assessment covering SQL, problem solving, communication and data visualisation.",
    durationMinutes: 30,
    weights: [
      { name: "SQL", weightPercent: 35, targetPercent: 80, requiredLevel: "INTERMEDIATE" },
      { name: "Problem Solving", weightPercent: 25, targetPercent: 70, requiredLevel: "INTERMEDIATE" },
      { name: "Communication", weightPercent: 20, targetPercent: 75, requiredLevel: "INTERMEDIATE" },
      { name: "Data Visualization", weightPercent: 20, targetPercent: 70, requiredLevel: "INTERMEDIATE" },
    ],
    capstone: {
      title: "Placement outcomes dashboard",
      description: "Use SQL and a BI tool to analyse placement outcomes by department and year, then present three recommendations.",
      difficulty: "INTERMEDIATE",
      estimatedWeeks: 4,
    },
  },
  {
    name: "Frontend Developer",
    category: "Technology",
    difficultyLevel: "BEGINNER",
    description: "Builds accessible, responsive interfaces with modern JavaScript and React.",
    assessmentTitle: "Frontend Developer Readiness Assessment",
    assessmentDescription: "Baseline readiness assessment covering HTML/CSS, JavaScript, React, Git and communication.",
    durationMinutes: 30,
    weights: [
      { name: "HTML & CSS", weightPercent: 20, targetPercent: 80, requiredLevel: "INTERMEDIATE" },
      { name: "JavaScript", weightPercent: 25, targetPercent: 80, requiredLevel: "INTERMEDIATE" },
      { name: "React", weightPercent: 25, targetPercent: 80, requiredLevel: "INTERMEDIATE" },
      { name: "Git & Version Control", weightPercent: 15, targetPercent: 70, requiredLevel: "BEGINNER" },
      { name: "Communication", weightPercent: 15, targetPercent: 65, requiredLevel: "INTERMEDIATE" },
    ],
    capstone: {
      title: "Design-system driven portfolio",
      description: "Build a personal portfolio with a small reusable component library, responsive layouts, accessible navigation and deployed code.",
      difficulty: "INTERMEDIATE",
      estimatedWeeks: 4,
    },
  },
  {
    name: "Backend Developer",
    category: "Technology",
    difficultyLevel: "INTERMEDIATE",
    description: "Designs APIs and services that are reliable, secure and easy to operate.",
    assessmentTitle: "Backend Developer Readiness Assessment",
    assessmentDescription: "Baseline readiness assessment covering Node.js, REST APIs, SQL, system design and Docker.",
    durationMinutes: 30,
    weights: [
      { name: "Node.js", weightPercent: 25, targetPercent: 80, requiredLevel: "INTERMEDIATE" },
      { name: "REST APIs", weightPercent: 20, targetPercent: 75, requiredLevel: "INTERMEDIATE" },
      { name: "SQL", weightPercent: 15, targetPercent: 75, requiredLevel: "INTERMEDIATE" },
      { name: "System Design", weightPercent: 20, targetPercent: 70, requiredLevel: "ADVANCED" },
      { name: "Docker", weightPercent: 20, targetPercent: 65, requiredLevel: "INTERMEDIATE" },
    ],
    capstone: {
      title: "Task API with authentication",
      description: "Build a REST API with authentication, validation, pagination, tests and a Dockerfile. Document the endpoints and error contract.",
      difficulty: "ADVANCED",
      estimatedWeeks: 5,
    },
  },
  {
    name: "Data Scientist",
    category: "Data",
    difficultyLevel: "ADVANCED",
    description: "Uses statistics and machine learning to answer questions and predict outcomes.",
    assessmentTitle: "Data Scientist Readiness Assessment",
    assessmentDescription: "Baseline readiness assessment covering Python, statistics, machine learning, SQL and visualisation.",
    durationMinutes: 35,
    weights: [
      { name: "Python", weightPercent: 20, targetPercent: 80, requiredLevel: "INTERMEDIATE" },
      { name: "Statistics", weightPercent: 20, targetPercent: 75, requiredLevel: "INTERMEDIATE" },
      { name: "Machine Learning", weightPercent: 20, targetPercent: 70, requiredLevel: "ADVANCED" },
      { name: "SQL", weightPercent: 15, targetPercent: 75, requiredLevel: "INTERMEDIATE" },
      { name: "Data Visualization", weightPercent: 15, targetPercent: 70, requiredLevel: "INTERMEDIATE" },
      { name: "Communication", weightPercent: 10, targetPercent: 65, requiredLevel: "INTERMEDIATE" },
    ],
    capstone: {
      title: "Churn prediction study",
      description: "Build a reproducible churn model: explore the data, justify features, evaluate with a hold-out set and present the business impact.",
      difficulty: "ADVANCED",
      estimatedWeeks: 6,
    },
  },
  {
    name: "DevOps Engineer",
    category: "Cloud & Operations",
    difficultyLevel: "ADVANCED",
    description: "Automates builds, deployments and infrastructure so teams can ship safely.",
    assessmentTitle: "DevOps Engineer Readiness Assessment",
    assessmentDescription: "Baseline readiness assessment covering Linux, Docker, CI/CD, cloud fundamentals and security.",
    durationMinutes: 30,
    weights: [
      { name: "Linux", weightPercent: 20, targetPercent: 75, requiredLevel: "INTERMEDIATE" },
      { name: "Docker", weightPercent: 20, targetPercent: 80, requiredLevel: "INTERMEDIATE" },
      { name: "CI/CD", weightPercent: 20, targetPercent: 75, requiredLevel: "INTERMEDIATE" },
      { name: "Cloud Fundamentals", weightPercent: 20, targetPercent: 70, requiredLevel: "INTERMEDIATE" },
      { name: "Security Fundamentals", weightPercent: 20, targetPercent: 65, requiredLevel: "INTERMEDIATE" },
    ],
    capstone: {
      title: "One-command deployment pipeline",
      description: "Containerise an app, add a CI pipeline with tests and image scanning, and deploy it to a cloud environment with rolling updates.",
      difficulty: "ADVANCED",
      estimatedWeeks: 5,
    },
  },
  {
    name: "Product Manager",
    category: "Product",
    difficultyLevel: "INTERMEDIATE",
    description: "Finds valuable problems, shapes solutions and aligns teams around outcomes.",
    assessmentTitle: "Product Manager Readiness Assessment",
    assessmentDescription: "Baseline readiness assessment covering product thinking, communication, agile delivery, problem solving and data literacy.",
    durationMinutes: 30,
    weights: [
      { name: "Product Thinking", weightPercent: 25, targetPercent: 75, requiredLevel: "INTERMEDIATE" },
      { name: "Communication", weightPercent: 25, targetPercent: 80, requiredLevel: "INTERMEDIATE" },
      { name: "Agile & Scrum", weightPercent: 20, targetPercent: 75, requiredLevel: "INTERMEDIATE" },
      { name: "Problem Solving", weightPercent: 15, targetPercent: 70, requiredLevel: "INTERMEDIATE" },
      { name: "Data Visualization", weightPercent: 15, targetPercent: 65, requiredLevel: "BEGINNER" },
    ],
    capstone: {
      title: "Product discovery pack",
      description: "Interview five users, define the problem, write a one-page strategy, prioritise a backlog and define success metrics for a small feature.",
      difficulty: "INTERMEDIATE",
      estimatedWeeks: 4,
    },
  },
  {
    name: "UI/UX Designer",
    category: "Design",
    difficultyLevel: "BEGINNER",
    description: "Designs clear, accessible experiences and hands them off to engineering.",
    assessmentTitle: "UI/UX Designer Readiness Assessment",
    assessmentDescription: "Baseline readiness assessment covering UI/UX fundamentals, Figma, communication and product thinking.",
    durationMinutes: 30,
    weights: [
      { name: "UI/UX Design", weightPercent: 30, targetPercent: 80, requiredLevel: "INTERMEDIATE" },
      { name: "Figma", weightPercent: 25, targetPercent: 80, requiredLevel: "INTERMEDIATE" },
      { name: "Communication", weightPercent: 20, targetPercent: 70, requiredLevel: "INTERMEDIATE" },
      { name: "Product Thinking", weightPercent: 15, targetPercent: 65, requiredLevel: "BEGINNER" },
      { name: "HTML & CSS", weightPercent: 10, targetPercent: 60, requiredLevel: "BEGINNER" },
    ],
    capstone: {
      title: "End-to-end mobile app case study",
      description: "Research a user problem, design flows and a clickable prototype in Figma, test with users and document the decisions.",
      difficulty: "INTERMEDIATE",
      estimatedWeeks: 5,
    },
  },
];

export interface CareerStudyGuide {
  topics: string[];
  practice: string;
  evidence: string;
}

export interface StudyLesson {
  title: string;
  content: string;
}

export interface StudyResource {
  title: string;
  url: string;
}

export interface CareerStudyMaterial {
  lessons: StudyLesson[];
  resources: StudyResource[];
}

export const CAREER_STUDY_GUIDES: Record<
  DemoCareer["name"],
  Partial<Record<DemoWeight["name"], CareerStudyGuide>>
> = {
  "Software Engineer": {
    "Problem Solving": {
      topics: ["problem decomposition", "constraints and edge cases", "time and space complexity"],
      practice: "Solve one array, one string, and one hash-map problem; compare a simple solution with an optimized one.",
      evidence: "Keep the solutions, complexity notes, and tests for edge cases.",
    },
    JavaScript: {
      topics: ["scope and closures", "modules and errors", "promises and the event loop"],
      practice: "Build a small asynchronous command-line app that calls an API, validates its response, and handles failures.",
      evidence: "Publish the source with tests and a short explanation of its asynchronous flow.",
    },
    "Data Structures": {
      topics: ["arrays and hash maps", "stacks and queues", "trees, graphs, and traversal"],
      practice: "Implement a queue and a graph traversal, then solve a problem that uses each structure.",
      evidence: "Document operation costs and add tests for empty and boundary cases.",
    },
    Communication: {
      topics: ["clarifying requirements", "explaining technical trade-offs", "constructive code review"],
      practice: "Write a one-page design note for a feature and present its trade-offs in a three-minute walkthrough.",
      evidence: "Save the design note and revise it using peer feedback.",
    },
    "System Design": {
      topics: ["API boundaries and data models", "caching and scaling", "availability and failure handling"],
      practice: "Sketch a service for a high-traffic feature, including its API, data store, bottlenecks, and failure modes.",
      evidence: "Keep the architecture diagram and a written explanation of two key trade-offs.",
    },
  },
  "Data Analyst": {
    SQL: {
      topics: ["filtering and joins", "aggregation and window functions", "data quality and query performance"],
      practice: "Use a public dataset to answer five business questions with joins, grouped metrics, and one window function.",
      evidence: "Publish the SQL queries with assumptions and a brief interpretation of each result.",
    },
    "Problem Solving": {
      topics: ["turning vague requests into questions", "checking assumptions", "separating correlation from cause"],
      practice: "Take one business question and define the metric, comparison group, time period, and possible confounders.",
      evidence: "Write a short analysis plan that another analyst can reproduce.",
    },
    Communication: {
      topics: ["audience-first storytelling", "clear metric definitions", "recommendations with limitations"],
      practice: "Present one finding to both a technical and a non-technical audience using the same evidence.",
      evidence: "Create a concise summary with the finding, its caveat, and a recommended next action.",
    },
    "Data Visualization": {
      topics: ["choosing charts for comparisons and trends", "scales and labeling", "avoiding misleading visuals"],
      practice: "Build a dashboard with three charts that answer a defined business question and include useful filters.",
      evidence: "Share the dashboard and explain why each chart type and scale was chosen.",
    },
  },
  "Frontend Developer": {
    "HTML & CSS": {
      topics: ["semantic HTML", "responsive layouts", "keyboard access and visual contrast"],
      practice: "Build a responsive, accessible page from a wireframe using semantic elements and flexible layouts.",
      evidence: "Provide screenshots at mobile and desktop widths plus a keyboard-navigation checklist.",
    },
    JavaScript: {
      topics: ["DOM and event handling", "modules and data transformation", "async requests and error states"],
      practice: "Add search, filtering, and loading/error states to a small data-driven page.",
      evidence: "Publish the feature with tests for empty, successful, and failed responses.",
    },
    React: {
      topics: ["component composition and props", "state and effects", "forms and reusable UI patterns"],
      practice: "Create a small searchable catalogue with reusable cards, controlled filters, and an empty state.",
      evidence: "Document the component boundaries and demonstrate the main interaction states.",
    },
    "Git & Version Control": {
      topics: ["small, reviewable commits", "branches and pull requests", "resolving merge conflicts"],
      practice: "Implement a feature on a branch, make focused commits, and review the diff before merging.",
      evidence: "Keep a clear commit history and a pull-request summary with test results.",
    },
    Communication: {
      topics: ["handoff questions", "explaining UI trade-offs", "accessible feedback and error messages"],
      practice: "Review a design with a teammate and turn the discussion into clear implementation notes.",
      evidence: "Save the notes and show how the final interface addresses the feedback.",
    },
  },
  "Backend Developer": {
    "Node.js": {
      topics: ["event loop and asynchronous I/O", "request lifecycle", "validation and error handling"],
      practice: "Build a small service with input validation, structured errors, and an asynchronous data-access layer.",
      evidence: "Include tests for valid input, invalid input, and downstream failures.",
    },
    "REST APIs": {
      topics: ["resource-oriented routes", "HTTP methods and status codes", "pagination and API contracts"],
      practice: "Design and implement a versioned CRUD API with pagination and consistent validation errors.",
      evidence: "Publish an API specification and example requests and responses.",
    },
    SQL: {
      topics: ["relational modeling and constraints", "joins and transactions", "indexes and query plans"],
      practice: "Model a small transactional domain and write queries for its key read paths.",
      evidence: "Include the schema, constraints, query plan, and a migration script.",
    },
    "System Design": {
      topics: ["service boundaries", "data consistency and queues", "scaling, observability, and resilience"],
      practice: "Design a job-processing service with retries, idempotency, and a clear failure-recovery path.",
      evidence: "Create a diagram and explain consistency, capacity, and operational trade-offs.",
    },
    Docker: {
      topics: ["images and layers", "multi-stage builds", "networking and runtime configuration"],
      practice: "Containerize the API with a non-root runtime and a separate local dependency service.",
      evidence: "Provide a reproducible build and run command with documented environment variables.",
    },
  },
  "Data Scientist": {
    Python: {
      topics: ["data structures and functions", "pandas data preparation", "reproducible notebooks and environments"],
      practice: "Load a raw dataset, validate its schema, clean missing values, and produce a repeatable analysis.",
      evidence: "Publish a notebook or script that runs from a clean environment with documented dependencies.",
    },
    Statistics: {
      topics: ["sampling and distributions", "confidence intervals and hypothesis tests", "bias and experimental design"],
      practice: "Compare two groups in a dataset and quantify uncertainty instead of reporting only a point estimate.",
      evidence: "Explain the assumptions, uncertainty, and limits of the conclusion.",
    },
    "Machine Learning": {
      topics: ["train/validation/test splits", "baseline models and feature leakage", "metrics and error analysis"],
      practice: "Train a baseline and a second model for a documented prediction task, then inspect their errors.",
      evidence: "Record the split strategy, chosen metric, baseline comparison, and error analysis.",
    },
    SQL: {
      topics: ["joins across analytical tables", "cohort and time-window queries", "aggregations for model features"],
      practice: "Create a leakage-safe feature table from event and entity tables using SQL.",
      evidence: "Save the query and document its grain, time boundaries, and validation checks.",
    },
    "Data Visualization": {
      topics: ["distribution and relationship plots", "uncertainty and subgroup comparisons", "visual narrative"],
      practice: "Visualize model errors across important segments and identify one actionable pattern.",
      evidence: "Present the charts with captions that distinguish evidence from interpretation.",
    },
    Communication: {
      topics: ["framing the decision", "translating model metrics", "stating uncertainty and limitations"],
      practice: "Explain a model result to a non-technical stakeholder and recommend whether to use it.",
      evidence: "Write a one-page decision brief with benefits, risks, and a monitoring plan.",
    },
  },
  "DevOps Engineer": {
    Linux: {
      topics: ["files, permissions, and processes", "shell pipelines and scripting", "logs and service troubleshooting"],
      practice: "Write a script that checks a service, captures useful diagnostics, and exits with meaningful status codes.",
      evidence: "Include usage instructions and a short incident-troubleshooting checklist.",
    },
    Docker: {
      topics: ["image construction and caching", "container networking", "health checks and resource limits"],
      practice: "Containerize a small app and its dependency with health checks and explicit resource settings.",
      evidence: "Publish the Dockerfiles and a repeatable local startup command.",
    },
    "CI/CD": {
      topics: ["build and test stages", "artifact promotion", "deployment approvals and rollback"],
      practice: "Create a pipeline that runs tests, builds an artifact, and deploys a non-production environment.",
      evidence: "Document pipeline stages and demonstrate a failed deployment rollback.",
    },
    "Cloud Fundamentals": {
      topics: ["identity and networking", "compute and managed storage", "availability, cost, and monitoring"],
      practice: "Design a small web service deployment with private data access and basic monitoring.",
      evidence: "Provide an architecture diagram and estimate its main cost and availability risks.",
    },
    "Security Fundamentals": {
      topics: ["least-privilege identity", "secret handling and image scanning", "patching and audit logs"],
      practice: "Review a deployment pipeline for exposed secrets, excessive permissions, and vulnerable images.",
      evidence: "Record findings and implement at least one preventive control.",
    },
  },
  "Product Manager": {
    "Product Thinking": {
      topics: ["user problems and outcomes", "assumptions and discovery", "success metrics and prioritization"],
      practice: "Interview users about one workflow and turn the evidence into a problem statement and outcome metric.",
      evidence: "Create a concise opportunity brief that separates observations from assumptions.",
    },
    Communication: {
      topics: ["decision memos", "stakeholder alignment", "clear scope and trade-offs"],
      practice: "Write a decision memo for a feature including options, evidence, risks, and a recommendation.",
      evidence: "Share the memo and record questions or decisions from a review.",
    },
    "Agile & Scrum": {
      topics: ["backlog refinement", "sprint goals and slicing", "reviews and retrospectives"],
      practice: "Break a user outcome into testable, ordered stories and define a sprint goal.",
      evidence: "Provide the backlog, acceptance criteria, and a short retrospective with one improvement.",
    },
    "Problem Solving": {
      topics: ["root-cause analysis", "impact-versus-effort reasoning", "testing risky assumptions"],
      practice: "Analyze a product drop-off and propose a small experiment that can distinguish likely causes.",
      evidence: "Document the hypothesis, success threshold, and decision for each possible outcome.",
    },
    "Data Visualization": {
      topics: ["metric definitions and funnels", "cohorts and trends", "communicating uncertainty"],
      practice: "Create a simple funnel or cohort view for a product question and identify a measurable opportunity.",
      evidence: "Share the chart with metric definitions and a recommendation grounded in the data.",
    },
  },
  "UI/UX Designer": {
    "UI/UX Design": {
      topics: ["user research and synthesis", "task flows and wireframes", "usability and accessibility"],
      practice: "Observe users completing a task, map the friction points, and redesign the flow.",
      evidence: "Show the research notes, before-and-after flow, and findings from a usability check.",
    },
    Figma: {
      topics: ["components and variants", "auto layout and responsive behavior", "interactive prototyping"],
      practice: "Create a small component set and prototype a complete task flow with alternate states.",
      evidence: "Share the prototype and a component page with naming and usage guidance.",
    },
    Communication: {
      topics: ["design rationale", "engineering handoff", "facilitating critique"],
      practice: "Present a design decision with evidence, constraints, and open questions to an engineering partner.",
      evidence: "Create annotated handoff notes and track one change made from feedback.",
    },
    "Product Thinking": {
      topics: ["user needs and business outcomes", "scope and prioritization", "measuring experience quality"],
      practice: "Connect a usability problem to a product outcome and define a low-cost way to validate a solution.",
      evidence: "Write a short design brief with the problem, hypothesis, and success measure.",
    },
    "HTML & CSS": {
      topics: ["semantic structure", "responsive layout constraints", "color contrast and focus states"],
      practice: "Build a responsive prototype screen and verify it with keyboard navigation and a contrast check.",
      evidence: "Share the implementation and a checklist of accessibility decisions.",
    },
  },
};

export const SKILL_STUDY_MATERIALS: Record<DemoWeight["name"], CareerStudyMaterial> = {
  "Problem Solving": {
    lessons: [
      { title: "Clarify the problem", content: "Restate the goal, identify inputs and outputs, and list constraints before choosing an algorithm." },
      { title: "Start with a simple solution", content: "Write the clearest correct approach first. Trace it with a small example and check empty, duplicate, and boundary inputs." },
      { title: "Improve and explain", content: "Look for repeated work and choose a suitable data structure. Compare time and space costs, then explain why the trade-off fits." },
    ],
    resources: [
      { title: "HackerRank: Problem Solving", url: "https://www.hackerrank.com/domains/algorithms" },
      { title: "LeetCode: Explore", url: "https://leetcode.com/explore/" },
    ],
  },
  JavaScript: {
    lessons: [
      { title: "Values, scope, and functions", content: "Practice primitives, objects, lexical scope, closures, and how functions capture values." },
      { title: "Collections and modules", content: "Transform arrays and objects with built-in methods, split code into modules, and handle errors deliberately." },
      { title: "Asynchronous JavaScript", content: "Use promises and async/await to coordinate I/O. Understand how the event loop schedules callbacks and how rejected work is handled." },
    ],
    resources: [
      { title: "MDN: JavaScript Guide", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide" },
      { title: "JavaScript.info: The Modern JavaScript Tutorial", url: "https://javascript.info/" },
    ],
  },
  "Data Structures": {
    lessons: [
      { title: "Choose a structure for the operation", content: "Compare arrays, linked structures, sets, and hash maps by lookup, insertion, deletion, and ordering needs." },
      { title: "Work with linear structures", content: "Use stacks for last-in-first-out work and queues for first-in-first-out processing; recognize common traversal patterns." },
      { title: "Explore trees and graphs", content: "Represent relationships with nodes and edges, then use breadth-first or depth-first traversal while tracking visited nodes." },
    ],
    resources: [
      { title: "Princeton: Algorithms, 4th Edition", url: "https://algs4.cs.princeton.edu/home/" },
      { title: "VisuAlgo: Data Structures and Algorithms", url: "https://visualgo.net/en" },
    ],
  },
  Communication: {
    lessons: [
      { title: "Write for your audience", content: "Lead with the context and decision the reader needs. Define unfamiliar terms and keep each paragraph focused on one idea." },
      { title: "Explain technical decisions", content: "State the problem, options considered, chosen approach, and trade-offs so another person can review the reasoning." },
      { title: "Give useful feedback", content: "Describe observable behavior, explain its impact, and suggest a concrete next step without making the feedback personal." },
    ],
    resources: [
      { title: "Google: Technical Writing One", url: "https://developers.google.com/tech-writing/one" },
      { title: "Google: Technical Writing Two", url: "https://developers.google.com/tech-writing/two" },
    ],
  },
  "System Design": {
    lessons: [
      { title: "Define requirements and constraints", content: "Separate user-visible requirements from scale, latency, availability, privacy, and cost constraints." },
      { title: "Draw the main components", content: "Trace a request through clients, APIs, services, queues, caches, and storage. Identify each component's responsibility." },
      { title: "Reason about failure and growth", content: "Estimate load, locate bottlenecks, and plan for retries, timeouts, replication, monitoring, and partial failure." },
    ],
    resources: [
      { title: "System Design Primer", url: "https://github.com/donnemartin/system-design-primer" },
      { title: "Google SRE: Service Level Objectives", url: "https://sre.google/sre-book/service-level-objectives/" },
    ],
  },
  SQL: {
    lessons: [
      { title: "Read and filter rows", content: "Use SELECT, WHERE, ORDER BY, and LIMIT to inspect a dataset and verify assumptions about its values." },
      { title: "Combine and summarize data", content: "Join tables using their keys, group at the correct grain, and use aggregate functions to answer questions." },
      { title: "Analyze sequences and validate results", content: "Use window functions for ranking and running metrics. Compare row counts and spot-check results before sharing them." },
    ],
    resources: [
      { title: "SQLBolt: Interactive SQL Lessons", url: "https://sqlbolt.com/" },
      { title: "Mode: SQL Tutorial", url: "https://mode.com/sql-tutorial/" },
    ],
  },
  "Data Visualization": {
    lessons: [
      { title: "Match the chart to the question", content: "Use position for precise comparisons, lines for trends, and distributions to show spread rather than only averages." },
      { title: "Make the encoding honest", content: "Label units and time ranges, use sensible scales, and avoid visual effects that exaggerate small differences." },
      { title: "Guide the reader", content: "Use hierarchy, annotations, and focused color to make the main finding easy to see without hiding uncertainty or caveats." },
    ],
    resources: [
      { title: "Fundamentals of Data Visualization", url: "https://clauswilke.com/dataviz/" },
      { title: "From Data to Viz: Chart Selection", url: "https://www.data-to-viz.com/" },
    ],
  },
  "HTML & CSS": {
    lessons: [
      { title: "Structure content semantically", content: "Choose HTML elements by meaning and document structure so assistive technologies and browsers can interpret the page." },
      { title: "Build flexible layouts", content: "Use the normal flow, Flexbox, Grid, and relative sizing to adapt content to different viewport widths." },
      { title: "Support accessible interaction", content: "Keep controls keyboard-operable, show visible focus, provide labels, and ensure text and controls have sufficient contrast." },
    ],
    resources: [
      { title: "MDN: Learn Web Development", url: "https://developer.mozilla.org/en-US/docs/Learn_web_development" },
      { title: "web.dev: Learn Accessibility", url: "https://web.dev/learn/accessibility/" },
    ],
  },
  React: {
    lessons: [
      { title: "Compose components", content: "Break an interface into components with clear responsibilities and pass data through explicit props." },
      { title: "Model state and events", content: "Keep state minimal, update it in response to user actions, and derive display values instead of duplicating them." },
      { title: "Connect to external data", content: "Handle loading, success, empty, and error states when synchronizing with a server; clean up effects when needed." },
    ],
    resources: [
      { title: "React: Learn", url: "https://react.dev/learn" },
      { title: "React: Thinking in React", url: "https://react.dev/learn/thinking-in-react" },
    ],
  },
  "Git & Version Control": {
    lessons: [
      { title: "Record focused changes", content: "Stage only related edits and write commit messages that describe the intent of each change." },
      { title: "Collaborate with branches", content: "Use branches and pull requests to review changes before integrating them with shared work." },
      { title: "Resolve conflicts carefully", content: "Understand both sides of a conflict, preserve intended behavior, and run tests after resolving it." },
    ],
    resources: [
      { title: "Pro Git Book", url: "https://git-scm.com/book/en/v2" },
      { title: "GitHub Skills: Introduction to GitHub", url: "https://github.com/skills/introduction-to-github" },
    ],
  },
  "Node.js": {
    lessons: [
      { title: "Understand the runtime", content: "Learn how Node.js uses the V8 engine and event loop to handle JavaScript and asynchronous I/O." },
      { title: "Organize a service", content: "Separate routing, business logic, and persistence; make configuration explicit and keep secrets outside source code." },
      { title: "Handle requests safely", content: "Validate untrusted input, return consistent errors, and use asynchronous APIs without blocking the event loop." },
    ],
    resources: [
      { title: "Node.js: Introduction to Node.js", url: "https://nodejs.org/en/learn/getting-started/introduction-to-nodejs" },
      { title: "Node.js: The Event Loop", url: "https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick" },
    ],
  },
  "REST APIs": {
    lessons: [
      { title: "Model resources and routes", content: "Name endpoints around resources and use HTTP methods consistently for reading, creating, replacing, and deleting." },
      { title: "Return predictable responses", content: "Choose meaningful status codes, validate request data, and define a stable error shape for clients." },
      { title: "Design for real clients", content: "Document pagination, filtering, authentication, versioning, and retry behavior before consumers depend on the API." },
    ],
    resources: [
      { title: "MDN: An Overview of HTTP", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview" },
      { title: "Microsoft REST API Guidelines", url: "https://github.com/microsoft/api-guidelines" },
    ],
  },
  Docker: {
    lessons: [
      { title: "Build an image", content: "Use a Dockerfile to describe reproducible image layers, pin dependencies, and exclude irrelevant files from the build context." },
      { title: "Run an isolated service", content: "Understand container processes, ports, networks, volumes, environment variables, and health checks." },
      { title: "Harden the runtime", content: "Use a small trusted base image, run as a non-root user, and avoid embedding credentials in image layers." },
    ],
    resources: [
      { title: "Docker Docs: Get Started", url: "https://docs.docker.com/get-started/" },
      { title: "Docker Docs: Build Best Practices", url: "https://docs.docker.com/build/building/best-practices/" },
    ],
  },
  Python: {
    lessons: [
      { title: "Write clear Python", content: "Practice functions, collections, iteration, exceptions, and modules using small, readable programs." },
      { title: "Work with tabular data", content: "Load data into a DataFrame, inspect types and missing values, then transform columns with explicit assumptions." },
      { title: "Make analysis reproducible", content: "Separate reusable code from exploration, control dependencies, and make each run produce the same documented result." },
    ],
    resources: [
      { title: "Python: The Official Tutorial", url: "https://docs.python.org/3/tutorial/" },
      { title: "pandas: Getting Started", url: "https://pandas.pydata.org/docs/getting_started/index.html" },
    ],
  },
  Statistics: {
    lessons: [
      { title: "Describe variation", content: "Use distributions and summary statistics to understand spread, skew, outliers, and the shape of the data." },
      { title: "Quantify uncertainty", content: "Use sampling ideas and confidence intervals to express how much an estimate might vary across samples." },
      { title: "Evaluate comparisons", content: "Choose a suitable test, inspect assumptions, and distinguish statistical evidence from practical importance or causation." },
    ],
    resources: [
      { title: "OpenIntro: Introduction to Modern Statistics", url: "https://www.openintro.org/book/ims/" },
      { title: "Khan Academy: Statistics and Probability", url: "https://www.khanacademy.org/math/statistics-probability" },
    ],
  },
  "Machine Learning": {
    lessons: [
      { title: "Create a valid evaluation", content: "Split data before fitting transformations, and keep a final test set untouched until model selection is complete." },
      { title: "Build a baseline", content: "Compare a simple baseline with more complex models using a metric aligned to the real cost of errors." },
      { title: "Inspect model behavior", content: "Check for leakage, analyze errors by segment, and monitor whether data changes after deployment." },
    ],
    resources: [
      { title: "Google: Machine Learning Crash Course", url: "https://developers.google.com/machine-learning/crash-course" },
      { title: "scikit-learn: Common Pitfalls", url: "https://scikit-learn.org/stable/common_pitfalls.html" },
    ],
  },
  Linux: {
    lessons: [
      { title: "Navigate files and permissions", content: "Use paths, file inspection, ownership, and permissions to understand what a process can read or change." },
      { title: "Inspect processes and services", content: "Find processes, signals, resource use, service state, and logs before restarting or changing a system." },
      { title: "Combine shell tools", content: "Use pipes and small scripts to filter output and automate repeatable checks with clear exit codes." },
    ],
    resources: [
      { title: "Linux Journey", url: "https://linuxjourney.com/" },
      { title: "The Linux Command Line", url: "https://linuxcommand.org/tlcl.php" },
    ],
  },
  "CI/CD": {
    lessons: [
      { title: "Automate quality checks", content: "Run formatting, tests, and security checks on every change so failures are found before deployment." },
      { title: "Promote immutable artifacts", content: "Build an artifact once, identify it by version or digest, and promote the same artifact between environments." },
      { title: "Deploy with recovery in mind", content: "Use health checks and controlled rollout strategies, and define when and how to roll back." },
    ],
    resources: [
      { title: "GitHub Actions: Understanding Workflows", url: "https://docs.github.com/en/actions/about-github-actions/understanding-github-actions" },
      { title: "Google Cloud: CI/CD Overview", url: "https://cloud.google.com/architecture/devops/devops-tech-continuous-delivery" },
    ],
  },
  "Cloud Fundamentals": {
    lessons: [
      { title: "Understand shared responsibility", content: "Know which security and reliability controls belong to the cloud provider and which remain your team's responsibility." },
      { title: "Choose core building blocks", content: "Compare compute, object storage, managed databases, virtual networks, and identity services for a workload." },
      { title: "Plan for operations and cost", content: "Use least-privilege access, monitoring, backups, and budgets as part of the design rather than after launch." },
    ],
    resources: [
      { title: "AWS Skill Builder: Cloud Essentials", url: "https://skillbuilder.aws/" },
      { title: "Microsoft Learn: Azure Fundamentals", url: "https://learn.microsoft.com/en-us/training/paths/azure-fundamentals-describe-cloud-concepts/" },
    ],
  },
  "Security Fundamentals": {
    lessons: [
      { title: "Identify threats and trust boundaries", content: "Map sensitive data, entry points, and trust boundaries; consider how an attacker could misuse each one." },
      { title: "Use secure defaults", content: "Apply least privilege, validate input, protect secrets, and use established authentication and cryptography libraries." },
      { title: "Respond and learn", content: "Log security-relevant events without exposing secrets, keep dependencies patched, and define how incidents are handled." },
    ],
    resources: [
      { title: "OWASP Top 10", url: "https://owasp.org/www-project-top-ten/" },
      { title: "OWASP Cheat Sheet Series", url: "https://cheatsheetseries.owasp.org/" },
    ],
  },
  "Product Thinking": {
    lessons: [
      { title: "Start with the user problem", content: "Understand who experiences the problem, when it occurs, and what they do today before proposing a feature." },
      { title: "Test assumptions early", content: "Separate evidence from guesses and choose the smallest experiment that can reduce an important uncertainty." },
      { title: "Measure outcomes", content: "Define a user or business outcome and a baseline so success is not confused with shipping activity." },
    ],
    resources: [
      { title: "Atlassian: Product Management", url: "https://www.atlassian.com/agile/product-management" },
      { title: "Product Talk: Continuous Discovery", url: "https://www.producttalk.org/continuous-discovery-habits/" },
    ],
  },
  "Agile & Scrum": {
    lessons: [
      { title: "Plan around an outcome", content: "Set a sprint goal that describes value, then select and refine work that supports that goal." },
      { title: "Make work small and testable", content: "Write clear acceptance criteria and split stories so progress and feedback arrive during the iteration." },
      { title: "Inspect and adapt", content: "Use reviews to learn from the product and retrospectives to choose one practical improvement to the team's process." },
    ],
    resources: [
      { title: "The Scrum Guide", url: "https://scrumguides.org/scrum-guide.html" },
      { title: "Atlassian: Agile Coach", url: "https://www.atlassian.com/agile" },
    ],
  },
  "UI/UX Design": {
    lessons: [
      { title: "Research the task", content: "Observe users and ask neutral questions to understand goals, context, and obstacles rather than confirming a preferred solution." },
      { title: "Design and test a flow", content: "Map the steps and states needed to complete a task, then test a low-fidelity prototype before polishing it." },
      { title: "Check usability and access", content: "Review feedback, error prevention, keyboard use, labels, contrast, and recovery paths across the full journey." },
    ],
    resources: [
      { title: "Nielsen Norman Group: 10 Usability Heuristics", url: "https://www.nngroup.com/articles/ten-usability-heuristics/" },
      { title: "W3C: WAI Tutorials", url: "https://www.w3.org/WAI/tutorials/" },
    ],
  },
  Figma: {
    lessons: [
      { title: "Create reusable components", content: "Turn repeated interface elements into components with clear names, variants, and sensible defaults." },
      { title: "Build responsive layouts", content: "Use auto layout and constraints to keep spacing and alignment predictable as content and frame sizes change." },
      { title: "Prototype meaningful states", content: "Connect screens and interactive states so a reviewer can test the actual task flow, including errors and empty states." },
    ],
    resources: [
      { title: "Figma Help Center: Get Started", url: "https://help.figma.com/hc/en-us/categories/360002051613-Get-started" },
      { title: "Figma: Design Systems", url: "https://help.figma.com/hc/en-us/categories/360002051613-Get-started" },
    ],
  },
};

export const CAREER_CAPSTONE_MATERIALS: Record<DemoCareer["name"], CareerStudyMaterial> = {
  "Software Engineer": {
    lessons: [
      { title: "Plan the application", content: "Define user roles, core workflows, data ownership, and API boundaries before building the placement portal." },
      { title: "Deliver a vertical slice", content: "Connect one end-to-end workflow across UI, API, and persistence, with validation and automated tests." },
      { title: "Deploy and explain it", content: "Deploy the application, document setup and trade-offs, and prepare a short walkthrough of the decisions you made." },
    ],
    resources: [
      { title: "GitHub Skills: Review Pull Requests", url: "https://github.com/skills/review-pull-requests" },
      { title: "OWASP Cheat Sheet Series", url: "https://cheatsheetseries.owasp.org/" },
    ],
  },
  "Data Analyst": {
    lessons: [
      { title: "Define the analysis grain", content: "Specify what one row represents, which outcomes matter, and how departments and years should be compared." },
      { title: "Validate the measures", content: "Check duplicates, missing values, cohort sizes, and metric definitions before building dashboard charts." },
      { title: "Turn findings into decisions", content: "Present a small number of findings with caveats and recommendations tied directly to the evidence." },
    ],
    resources: [
      { title: "Fundamentals of Data Visualization", url: "https://clauswilke.com/dataviz/" },
      { title: "SQLBolt: Interactive SQL Lessons", url: "https://sqlbolt.com/" },
    ],
  },
  "Frontend Developer": {
    lessons: [
      { title: "Build a reusable visual system", content: "Choose a small set of design tokens and components, then use them consistently across the portfolio." },
      { title: "Make every screen responsive", content: "Use flexible layouts and test content at narrow widths, zoomed text, and keyboard-only interaction." },
      { title: "Publish and evaluate", content: "Deploy the portfolio, check loading and error behavior, and ask a reviewer to complete key tasks." },
    ],
    resources: [
      { title: "React: Learn", url: "https://react.dev/learn" },
      { title: "web.dev: Learn Accessibility", url: "https://web.dev/learn/accessibility/" },
    ],
  },
  "Backend Developer": {
    lessons: [
      { title: "Define the contract", content: "Specify resources, authorization rules, validation, status codes, and stable error responses before coding." },
      { title: "Protect state changes", content: "Hash credentials, enforce ownership, validate input, and make retryable operations safe where appropriate." },
      { title: "Test and package the service", content: "Cover success and failure cases, document the API, and run the service as a non-root container." },
    ],
    resources: [
      { title: "Microsoft REST API Guidelines", url: "https://github.com/microsoft/api-guidelines" },
      { title: "Docker Docs: Get Started", url: "https://docs.docker.com/get-started/" },
    ],
  },
  "Data Scientist": {
    lessons: [
      { title: "Establish a trustworthy baseline", content: "Define the prediction target and split strategy before exploring model choices; prevent leakage across the split." },
      { title: "Compare and inspect models", content: "Compare a baseline to a candidate model using suitable metrics and inspect errors across important segments." },
      { title: "Communicate limitations", content: "Explain uncertainty, data limitations, likely failure cases, and how the model should be monitored." },
    ],
    resources: [
      { title: "Google: Machine Learning Crash Course", url: "https://developers.google.com/machine-learning/crash-course" },
      { title: "scikit-learn: Common Pitfalls", url: "https://scikit-learn.org/stable/common_pitfalls.html" },
    ],
  },
  "DevOps Engineer": {
    lessons: [
      { title: "Make builds repeatable", content: "Keep infrastructure and pipeline configuration reviewable, versioned, and reproducible." },
      { title: "Add deployment safeguards", content: "Run tests and image checks, use health probes, and avoid deploying unverified artifacts." },
      { title: "Operate the deployment", content: "Collect useful logs and metrics, test rollback, and document how to diagnose a failed release." },
    ],
    resources: [
      { title: "GitHub Actions: Understanding Workflows", url: "https://docs.github.com/en/actions/about-github-actions/understanding-github-actions" },
      { title: "Docker Docs: Build Best Practices", url: "https://docs.docker.com/build/building/best-practices/" },
    ],
  },
  "Product Manager": {
    lessons: [
      { title: "Synthesize discovery", content: "Group interview observations into needs and unmet outcomes; avoid treating a proposed feature as proof of the problem." },
      { title: "Choose a focused opportunity", content: "Compare opportunities by user impact, confidence, and effort, and record assumptions that still need testing." },
      { title: "Connect delivery to outcomes", content: "Define a product metric and a learning plan that show whether the shipped work improved the user outcome." },
    ],
    resources: [
      { title: "Atlassian: Product Management", url: "https://www.atlassian.com/agile/product-management" },
      { title: "Product Talk: Continuous Discovery", url: "https://www.producttalk.org/continuous-discovery-habits/" },
    ],
  },
  "UI/UX Designer": {
    lessons: [
      { title: "Ground the design in research", content: "Connect user observations to a clear problem statement and prioritize the most important task or friction point." },
      { title: "Prototype and test the flow", content: "Create realistic states and use usability sessions to find confusion before refining visual details." },
      { title: "Prepare a useful case study", content: "Show the process, iterations, accessibility considerations, and what changed because of user feedback." },
    ],
    resources: [
      { title: "Nielsen Norman Group: 10 Usability Heuristics", url: "https://www.nngroup.com/articles/ten-usability-heuristics/" },
      { title: "W3C: WAI Tutorials", url: "https://www.w3.org/WAI/tutorials/" },
    ],
  },
};
