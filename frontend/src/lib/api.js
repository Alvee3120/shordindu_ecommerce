// lib/api.js
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api";

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS", "TRACE"];
// Requests to these paths must never trigger a refresh-and-retry — refreshing
// off a failed signin/signup would be meaningless, and retrying the refresh
// call itself off its own 401 would recurse.
const NO_REFRESH_PATHS = ["/auth/signin/", "/auth/signup/", "/auth/token/refresh/"];

/** Reads Django's csrftoken cookie (requires CSRF_COOKIE_HTTPONLY = False on the backend). */
function getCsrfToken() {
  if (typeof document === "undefined") return null; // SSR guard
  const match = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

let refreshPromise = null;

/** Coalesces concurrent 401s into a single POST /auth/token/refresh/ call. */
function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_BASE_URL}/auth/token/refresh/`, {
      method: "POST",
      credentials: "include",
      headers: { "X-CSRFToken": getCsrfToken() },
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/**
 * Thin fetch wrapper — always sends cookies, always JSON unless told otherwise,
 * attaches the CSRF token on unsafe methods, and normalizes DRF error shapes
 * into a single throwable object. On a 401 (expired 15-minute access token) it
 * silently refreshes via the httpOnly refresh cookie and retries once, so a
 * signed-in user doesn't get logged out from under them mid-session.
 */
export async function apiFetch(path, options = {}) {
  const { body, headers, isFormData, _isRetry, ...rest } = options;
  const method = (options.method || "GET").toUpperCase();
  const needsCsrf = !SAFE_METHODS.includes(method);

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    method,
    credentials: "include", // required — auth is cookie-based, not token-based
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(needsCsrf ? { "X-CSRFToken": getCsrfToken() } : {}),
      ...headers,
    },
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });

  if (res.status === 401 && !_isRetry && !NO_REFRESH_PATHS.includes(path)) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return apiFetch(path, { ...options, _isRetry: true });
    }
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // no JSON body (e.g. 204/205) — fine
  }

  if (!res.ok) {
    const error = new Error(extractErrorMessage(data));
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

/** Picks a single human-readable message out of DRF's various error shapes. */
export function extractErrorMessage(data) {
  if (!data) return "Something went wrong. Please try again.";
  if (data.detail) return data.detail;
  if (data.non_field_errors?.length) return data.non_field_errors[0];

  // field-specific errors, e.g. { email: ["This field is required."] }
  const firstField = Object.keys(data)[0];
  if (firstField && Array.isArray(data[firstField])) {
    return data[firstField][0];
  }

  return "Something went wrong. Please try again.";
}