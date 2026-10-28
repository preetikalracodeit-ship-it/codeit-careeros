const ACCESS_KEY = "careeros_access";
const REFRESH_KEY = "careeros_refresh";
const USER_KEY = "careeros_user";
const ROLE_COOKIE_NAME = "careeros_role";

function decodeJwt(token) {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(payload);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

function writeRoleHint(role) {
  if (!["STUDENT", "ADMIN", "PROFESSOR"].includes(role)) return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${ROLE_COOKIE_NAME}=${role}; path=/; SameSite=Lax; max-age=604800${secure}`;
}

export const auth = {
  save({ accessToken, refreshToken, user }) {
    localStorage.setItem(ACCESS_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    writeRoleHint(user?.role || decodeJwt(accessToken)?.role);
  },
  getAccessToken() {
    return localStorage.getItem(ACCESS_KEY);
  },
  getRefreshToken() {
    return localStorage.getItem(REFRESH_KEY);
  },
  getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || "null");
    } catch {
      return null;
    }
  },
  getRole() {
    return this.getUser()?.role || decodeJwt(this.getAccessToken() || "")?.role || null;
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${ROLE_COOKIE_NAME}=; path=/; SameSite=Lax; expires=Thu, 01 Jan 1970 00:00:00 GMT${secure}`;
  },
};

export const homeForRole = (role) =>
  role === "ADMIN" ? "/admin/dashboard" : role === "PROFESSOR" ? "/college/dashboard" : "/student/dashboard";
