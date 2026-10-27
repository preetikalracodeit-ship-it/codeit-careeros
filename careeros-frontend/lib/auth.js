const ACCESS_KEY = "careeros_access";
const REFRESH_KEY = "careeros_refresh";
const USER_KEY = "careeros_user";
// Non-sensitive routing hint only. The access token is deliberately NOT
// copied into a JavaScript-readable cookie; the backend remains the sole
// authority for authentication and authorization.
const ROLE_COOKIE_NAME = "careeros_role";
const LEGACY_COOKIE_NAME = "careeros_token";

function decodeJwt(token) {
  try {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(
      decodeURIComponent(
        Array.prototype.map
          .call(atob(normalized), (c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
          .join(""),
      ),
    );
  } catch {
    return null;
  }
}

function cookieSecureFlag() {
  if (typeof window !== "undefined" && window.location?.protocol === "https:") return "; Secure";
  return "";
}

function setCookie(name, value) {
  document.cookie = `${name}=${value}; path=/; SameSite=Lax; max-age=604800${cookieSecureFlag()}`;
}

function clearCookie(name) {
  document.cookie = `${name}=; path=/; SameSite=Lax; expires=Thu, 01 Jan 1970 00:00:00 GMT${cookieSecureFlag()}`;
}

export const auth = {
  save({ accessToken, refreshToken, user }) {
    if (typeof window === "undefined") return;
    localStorage.setItem(ACCESS_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    const role = user?.role || decodeJwt(accessToken)?.role;
    if (role) setCookie(ROLE_COOKIE_NAME, role);
    // Remove the old token-in-cookie copy on the next successful session save.
    clearCookie(LEGACY_COOKIE_NAME);
  },

  getAccessToken() {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(ACCESS_KEY);
  },

  getRefreshToken() {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(REFRESH_KEY);
  },

  getUser() {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  getRole() {
    const user = this.getUser();
    if (user?.role) return user.role;
    const token = this.getAccessToken();
    return decodeJwt(token)?.role ?? null;
  },

  isAuthenticated() {
    return Boolean(this.getAccessToken());
  },

  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    clearCookie(ROLE_COOKIE_NAME);
    clearCookie(LEGACY_COOKIE_NAME);
  },
};

export { decodeJwt, ROLE_COOKIE_NAME, LEGACY_COOKIE_NAME };