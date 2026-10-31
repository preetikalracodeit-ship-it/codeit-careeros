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
