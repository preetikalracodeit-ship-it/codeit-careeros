export const ROLE_LABELS = {
  SUPER_ADMIN: "Platform Super Admin",
  COLLEGE_ADMIN: "College Admin",
  TPO: "TPO / Placement Officer",
  HOD: "HOD / Department Coordinator",
  FACULTY: "Faculty / Mentor",
  STUDENT: "Student",
};

export const ROLE_TAGLINES = {
  SUPER_ADMIN: "Create and monitor college workspaces across the platform.",
  COLLEGE_ADMIN: "Run your college, departments, batches, and staff.",
  TPO: "Review readiness, skill gaps, and placement activity.",
  HOD: "Track students and reports for your department.",
  FACULTY: "Guide your assigned students and improvement plans.",
  STUDENT: "Grow your skills and follow your career plan.",
};

export const ROLE_NAV = {
  SUPER_ADMIN: [
    { to: "/platform/dashboard", label: "Overview", icon: "grid" },
    { to: "/platform/colleges", label: "College workspaces", icon: "building" },
    { to: "/platform/staff", label: "Administrators", icon: "shield" },
    { to: "/platform/students", label: "Students", icon: "users" },
    { to: "/platform/skills", label: "Skills", icon: "chart" },
    { to: "/platform/careers", label: "Career paths", icon: "target" },
    { to: "/platform/assessments", label: "Assessments", icon: "clipboard" },
    { to: "/platform/roadmaps", label: "Roadmaps", icon: "layers" },
    { to: "/platform/projects", label: "Projects", icon: "briefcase" },
    { to: "/platform/reports", label: "Reports", icon: "download" },
    { to: "/platform/ai", label: "AI status", icon: "spark" },
    { to: "/platform/activity", label: "Operational info", icon: "activity" },
    { to: "/platform/settings", label: "Settings", icon: "settings" },
  ],
  COLLEGE_ADMIN: [
    { to: "/college/dashboard", label: "Overview", icon: "grid" },
    { to: "/college/profile", label: "College profile", icon: "building" },
    { to: "/college/departments", label: "Departments", icon: "layers" },
    { to: "/college/batches", label: "Batches", icon: "calendar" },
    { to: "/college/staff", label: "Staff & permissions", icon: "shield" },
    { to: "/college/students", label: "Students", icon: "users" },
    { to: "/college/plans", label: "Improvement plans", icon: "clipboard" },
    { to: "/college/reports", label: "Reports", icon: "chart" },
    { to: "/college/settings", label: "Settings", icon: "settings" },
  ],
  TPO: [
    { to: "/tpo/dashboard", label: "Overview", icon: "grid" },
    { to: "/tpo/students", label: "Students", icon: "users" },
    { to: "/tpo/readiness", label: "Readiness", icon: "target" },
    { to: "/tpo/skill-gaps", label: "Skill gaps", icon: "chart" },
    { to: "/tpo/reports", label: "Reports", icon: "clipboard" },
    { to: "/tpo/placement", label: "Placement drives", icon: "briefcase" },
    { to: "/tpo/settings", label: "Settings", icon: "settings" },
  ],
  HOD: [
    { to: "/hod/dashboard", label: "Overview", icon: "grid" },
    { to: "/hod/students", label: "Department students", icon: "users" },
    { to: "/hod/readiness", label: "Readiness", icon: "target" },
    { to: "/hod/department", label: "Department", icon: "layers" },
    { to: "/hod/reports", label: "Reports", icon: "chart" },
    { to: "/hod/settings", label: "Settings", icon: "settings" },
  ],
  FACULTY: [
    { to: "/faculty/dashboard", label: "Overview", icon: "grid" },
    { to: "/faculty/mentees", label: "My mentees", icon: "users" },
    { to: "/faculty/improvement-plans", label: "Improvement plans", icon: "clipboard" },
    { to: "/faculty/reports", label: "Reports", icon: "chart" },
    { to: "/faculty/settings", label: "Settings", icon: "settings" },
  ],
  STUDENT: [
    { to: "/student/dashboard", label: "Dashboard", icon: "grid" },
    { to: "/student/careers", label: "Career paths", icon: "target" },
    { to: "/student/assessment", label: "Assessments", icon: "clipboard" },
    { to: "/student/roadmap", label: "Roadmap", icon: "layers" },
    { to: "/student/cv", label: "CV analysis", icon: "file" },
    { to: "/student/improvement-plan", label: "Improvement plan", icon: "clipboard" },
    { to: "/student/projects", label: "Projects", icon: "briefcase" },
    { to: "/student/placements", label: "Placements", icon: "building" },
    { to: "/student/linkedin", label: "LinkedIn review", icon: "shield" },
    { to: "/student/progress", label: "Progress", icon: "chart" },
    { to: "/student/reports", label: "Reports", icon: "download" },
    { to: "/student/ai", label: "AI assistant", icon: "message" },
    { to: "/student/profile", label: "Profile", icon: "users" },
    { to: "/student/settings", label: "Settings", icon: "settings" },
  ],
};

export const DEMO_ACCOUNTS = [
  { role: "SUPER_ADMIN", label: "Platform Super Admin", email: "superadmin@careeros.dev" },
  { role: "COLLEGE_ADMIN", label: "College Admin", email: "collegeadmin@careeros.dev" },
  { role: "TPO", label: "TPO / Placement Officer", email: "tpo@careeros.dev" },
  { role: "HOD", label: "HOD / Department Coordinator", email: "hod@careeros.dev" },
  { role: "FACULTY", label: "Faculty / Mentor", email: "faculty@careeros.dev" },
  { role: "STUDENT", label: "Student", email: "student@careeros.dev" },
];

export const DEMO_PASSWORD = "DemoPass123";

export function roleLabel(role) {
  return ROLE_LABELS[role] || "CareerOS member";
}

export function initials(name) {
  return (name || "CareerOS")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}
