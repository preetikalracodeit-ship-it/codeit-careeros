export const STUDENT_HOME = "/student/dashboard";
export const ADMIN_HOME = "/admin/dashboard";
export const COLLEGE_HOME = "/college/dashboard";

export function homeForRole(role) {
  if (role === "ADMIN") return ADMIN_HOME;
  if (role === "PROFESSOR") return COLLEGE_HOME;
  return STUDENT_HOME;
}

export function roleLabel(role) {
  if (role === "ADMIN") return "Administrator";
  if (role === "PROFESSOR") return "College staff";
  return "Student";
}
