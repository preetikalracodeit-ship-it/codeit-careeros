import axios from "axios";
import { auth } from "./auth.js";

const api = axios.create({
  baseURL: "/api/v1",
  timeout: 60000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = auth.getAccessToken();
  if (token && !config.skipAuth) config.headers.Authorization = `Bearer ${token}`;
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }
  return config;
});

let refreshPromise;

async function refreshSession() {
  const refreshToken = auth.getRefreshToken();
  if (!refreshToken) throw new Error("No refresh token available");

  const response = await axios.post("/api/v1/auth/refresh", { refreshToken }, { timeout: 60000 });
  const data = response.data?.data;
  if (!data?.accessToken || !data?.refreshToken) throw new Error("Session refresh failed");
  auth.save(data);
  return data.accessToken;
}

api.interceptors.response.use(
  (response) => (response.data?.data !== undefined ? response.data.data : response.data),
  async (error) => {
    const original = error.config;
    const isAuthCall = ["/auth/login", "/auth/register", "/auth/google", "/auth/config", "/auth/refresh", "/auth/logout"]
      .some((path) => original?.url?.includes(path));
    if (error.response?.status === 401 && !original?.skipAuth && !isAuthCall && !original?._retry) {
      original._retry = true;
      try {
        refreshPromise ||= refreshSession();
        const accessToken = await refreshPromise;
        refreshPromise = undefined;
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        refreshPromise = undefined;
        auth.clear();
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          const redirect = `${window.location.pathname}${window.location.search}`;
          window.location.assign(`/login?redirect=${encodeURIComponent(redirect)}`);
        }
      }
    }
    const body = error.response?.data;
    const message = body?.message || (error.response ? "Request failed. Please try again." : "Unable to reach the server.");
    return Promise.reject(Object.assign(new Error(message), {
      status: error.response?.status,
      errorCode: body?.errorCode,
      fieldErrors: body?.fieldErrors || [],
    }));
  },
);

export default api;
