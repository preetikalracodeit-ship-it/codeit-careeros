const ACCESS_KEY = "careeros_access";
const REFRESH_KEY = "careeros_refresh";
const USER_KEY = "careeros_user";
const ROLE_COOKIE = "careeros_role";

function decodeJwt(token) {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(Array.from(atob(payload), (char) =>
      `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`).join("")));
  } catch {
    return null;
  }
}

function cookie(name, value, maxAge) {
  document.cookie = `${name}=${value}; path=/; SameSite=Lax; max-age=${maxAge}${location.protocol === "https:" ? "; Secure" : ""}`;
}

export const auth = {
  save({ accessToken, refreshToken, user }) {
    localStorage.setItem(ACCESS_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    const role = user?.role || decodeJwt(accessToken)?.role;
    if (role) cookie(ROLE_COOKIE, role, 604800);
  },
  getAccessToken: () => localStorage.getItem(ACCESS_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_KEY),
  getUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); }
    catch { return null; }
  },
  getRole() { return this.getUser()?.role || decodeJwt(this.getAccessToken())?.role || null; },
  isAuthenticated: () => Boolean(localStorage.getItem(ACCESS_KEY)),
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    cookie(ROLE_COOKIE, "", 0);
  },
};

const ROLE_HOME = {
  SUPER_ADMIN: "/platform/dashboard",
  COLLEGE_ADMIN: "/college/dashboard",
  TPO: "/tpo/dashboard",
  HOD: "/hod/dashboard",
  FACULTY: "/faculty/dashboard",
  STUDENT: "/student/dashboard",
};

export function homeForRole(role) {
  return ROLE_HOME[role] || "/student/dashboard";
}
