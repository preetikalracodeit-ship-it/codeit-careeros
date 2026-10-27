import axios from "axios";
import { auth } from "@/lib/auth";

// Same-origin by default: browsers call this site's own /api/*, which Next
// rewrites (server-side) to the backend — no mixed-content block on HTTPS,
// no CORS. Set NEXT_PUBLIC_API_URL only to call a backend directly.
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

export class ApiError extends Error {
  constructor(message, { status, errorCode, fieldErrors } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errorCode = errorCode;
    this.fieldErrors = fieldErrors || [];
  }
}

const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { "Content-Type": "application/json" },
  // Default safety net so requests always settle; long AI turns override it
  // per-call (see student/ai page). Axios aborts surface as ECONNABORTED.
  timeout: 60000,
});

api.interceptors.request.use((config) => {
  const token = auth.getAccessToken();
  if (token && !config.skipAuth) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // File uploads carry their own multipart boundary — never send the
  // instance JSON content type with them.
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }
  return config;
});

let refreshPromise = null;

async function refreshSession() {
  const refreshToken = auth.getRefreshToken();
  if (!refreshToken) {
    throw new ApiError("No refresh token available", { status: 401 });
  }
  const response = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, {
    refreshToken,
  });
  const data = response.data?.data;
  if (!data?.accessToken) {
    throw new ApiError("Refresh failed", { status: 401 });
  }
  auth.save({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: data.user,
  });
  return data.accessToken;
}

api.interceptors.response.use(
  (response) => (response.data?.data !== undefined ? response.data.data : response.data),
  async (error) => {
    const original = error.config;
    const isAuthCall =
      original?.url?.includes("/auth/login") ||
      original?.url?.includes("/auth/register") ||
      original?.url?.includes("/auth/google") ||
      original?.url?.includes("/auth/config") ||
      original?.url?.includes("/auth/refresh") ||
      original?.url?.includes("/invitations/") ||
      original?.skipAuth;

    if (error.response?.status === 401 && !isAuthCall && !original?._retry && typeof window !== "undefined") {
      original._retry = true;
      try {
        refreshPromise = refreshPromise || refreshSession();
        const newToken = await refreshPromise;
        refreshPromise = null;
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (refreshError) {
        refreshPromise = null;
        auth.clear();
        if (typeof window !== "undefined") {
          window.location.assign(new URL("/login", window.location.origin).href);
        }
        // Sprint 8: never resolve with undefined — every caller must see
        // the failure instead of hanging on an empty response.
        throw new ApiError("Your session has expired. Please log in again.", {
          status: 401,
          errorCode: "UNAUTHORIZED",
        });
      }
    }

    const status = error.response?.status;
    const body = error.response?.data;
    let message = "Something went wrong. Please try again.";
    if (body?.message) message = body.message;
    if (!error.response && error?.code === "ECONNABORTED") {
      message = "The request timed out. Please try again.";
    } else if (!error.response) {
      message = "Unable to reach the server. Check your connection.";
      if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
        console.error("[api] no response:", error?.code, original?.url, error?.message);
      }
    }

    throw new ApiError(message, {
      status,
      errorCode: body?.errorCode,
      fieldErrors: body?.fieldErrors,
    });
  },
);

export default api;