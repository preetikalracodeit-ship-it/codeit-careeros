import { auth } from "./auth.js";

let refreshPromise;
const GET_CACHE_TTL_MS = 8_000;
const getResponseCache = new Map();
const inFlightGetRequests = new Map();
let getCacheGeneration = 0;

function invalidateGetCache() {
  getCacheGeneration += 1;
  getResponseCache.clear();
  inFlightGetRequests.clear();
}

function cloneResponse(data) {
  return data == null ? data : JSON.parse(JSON.stringify(data));
}

async function refreshSession() {
  const refreshToken = auth.getRefreshToken();
  if (!refreshToken) throw new Error("Your session has expired. Please log in again.");
  const response = await fetch("/api/v1/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  const body = await response.json();
  if (!response.ok || !body?.data?.accessToken) throw new Error("Your session has expired. Please log in again.");
  auth.save(body.data);
  return body.data.accessToken;
}

export async function api(path, options = {}) {
  const { params, responseType, skipAuth, retried, ...requestOptions } = options;
  const method = (requestOptions.method || "GET").toUpperCase();
  const headers = new Headers(requestOptions.headers || {});
  if (requestOptions.body && !(requestOptions.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (!skipAuth && auth.getAccessToken()) headers.set("Authorization", `Bearer ${auth.getAccessToken()}`);
  const url = new URL(`/api/v1${path}`, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
  }

  const cacheable = method === "GET" && responseType !== "blob";
  const mutating = !["GET", "HEAD"].includes(method);
  if (mutating) invalidateGetCache();

  const cacheKey = cacheable
    ? `${getCacheGeneration}:${auth.getAccessToken() || "anonymous"}:${url.href}`
    : null;
  if (cacheKey) {
    const cached = getResponseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cloneResponse(cached.data);
    if (cached) getResponseCache.delete(cacheKey);
    const inFlight = inFlightGetRequests.get(cacheKey);
    if (inFlight) return cloneResponse(await inFlight);
  }

  const request = async () => {
    let response = await fetch(url, { ...requestOptions, headers });
    if (response.status === 401 && !skipAuth && !retried) {
      try {
        refreshPromise ||= refreshSession();
        const token = await refreshPromise;
        refreshPromise = null;
        headers.set("Authorization", `Bearer ${token}`);
        response = await fetch(url, { ...requestOptions, headers });
      } catch (error) {
        refreshPromise = null;
        auth.clear();
        window.location.assign("/login");
        throw error;
      }
    }

    if (responseType === "blob" && response.ok) return response.blob();
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(body?.message || "Something went wrong. Please try again.");
      error.status = response.status;
      error.errorCode = body?.errorCode;
      error.fieldErrors = body?.fieldErrors || [];
      throw error;
    }
    return body?.data !== undefined ? body.data : body;
  };

  if (!cacheKey) {
    try {
      return await request();
    } finally {
      if (mutating) invalidateGetCache();
    }
  }

  const generation = getCacheGeneration;
  const pending = request();
  inFlightGetRequests.set(cacheKey, pending);
  try {
    const data = await pending;
    if (generation === getCacheGeneration) {
      getResponseCache.set(cacheKey, { data: cloneResponse(data), expiresAt: Date.now() + GET_CACHE_TTL_MS });
    }
    return cloneResponse(data);
  } finally {
    inFlightGetRequests.delete(cacheKey);
  }
}

api.get = (path, options) => api(path, options);
api.post = (path, data, options = {}) => api(path, { ...options, method: "POST", body: data instanceof FormData ? data : JSON.stringify(data ?? {}) });
api.put = (path, data, options = {}) => api(path, { ...options, method: "PUT", body: data instanceof FormData ? data : JSON.stringify(data ?? {}) });
api.patch = (path, data, options = {}) => api(path, { ...options, method: "PATCH", body: data instanceof FormData ? data : JSON.stringify(data ?? {}) });
api.delete = (path, options = {}) => api(path, { ...options, method: "DELETE" });

export default api;
