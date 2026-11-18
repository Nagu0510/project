// Centralized SkillSense API client.
// The access token lives only in memory; the session survives reloads through an httpOnly
// refresh cookie that the backend sets (see authService.restoreSession).

const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL)
  ? import.meta.env.VITE_API_BASE_URL
  : '/api';

let accessToken = null;
export const setAccessToken = (token) => { accessToken = token || null; };
export const getAccessToken = () => accessToken;

// Endpoints where a 401 means "bad credentials" rather than "session expired".
const NO_REFRESH = /^\/auth\/(login|admin\/login|register|refresh|logout|forgot-password|reset-password)/;

const hasSessionHint = () => {
  try { return Boolean(localStorage.getItem('skillsense_auth')); } catch { return false; }
};

const expireSession = () => {
  accessToken = null;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('skillsense:auth:expired'));
  }
};

let refreshInFlight = null;

// One shared refresh at a time, so parallel 401s (or React StrictMode) don't race.
const refreshSession = () => {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/auth/refresh`, { method: 'POST', credentials: 'include' });
        if (!res.ok) {
          accessToken = null;
          return null;
        }
        const data = await res.json();
        accessToken = data.access_token;
        return data;
      } catch {
        return null;
      }
    })().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
};

// What a person sees when the server answered with a bare status and no usable message
// (the dev proxy returns plain-text 500/502/503/504 when the backend is not running).
const STATUS_MESSAGES = {
  500: 'Server problem, please try again in a moment.',
  502: 'The server is not reachable right now. Please try again in a moment.',
  503: 'The service is temporarily unavailable. Please try again in a moment.',
  504: 'The server took too long to answer. Please try again.',
};

class ApiClient {
  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  getHeaders(isFormData = false) {
    const headers = {};
    if (!isFormData) headers['Content-Type'] = 'application/json';
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    return headers;
  }

  refreshSession() {
    return refreshSession();
  }

  async request(endpoint, options = {}, retried = false) {
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const isFormData = options.body instanceof FormData;
    const url = `${this.baseUrl}${path}`;

    const timeoutMs = options.timeoutMs || 15000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const { timeoutMs: _ignored, ...fetchOptions } = options;
    const config = {
      ...fetchOptions,
      credentials: 'include',
      signal: options.signal || controller.signal,
      headers: {
        ...this.getHeaders(isFormData),
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      clearTimeout(timer);

      if (response.status === 401 && !NO_REFRESH.test(path)) {
        // Only try to restore a session that can exist: we hold a token, or a sign-in left its hint behind.
        if (!retried && (accessToken || hasSessionHint()) && (await refreshSession())) {
          return this.request(endpoint, options, true);
        }
        expireSession();
      }

      if (!response.ok) {
        let errorMsg = STATUS_MESSAGES[response.status] || `Request failed (${response.status}). Please try again.`;
        let errorDetail = null;
        try {
          const errorData = await response.json();
          if (errorData.detail) {
            errorDetail = errorData.detail;
            errorMsg = typeof errorData.detail === 'string'
              ? errorData.detail
              : (Array.isArray(errorData.detail) && errorData.detail[0]?.msg
                ? errorData.detail[0].msg.replace(/^Value error, /, '')
                : (typeof errorData.detail.message === 'string' ? errorData.detail.message : JSON.stringify(errorData.detail)));
          } else if (errorData.error && errorData.error.message) {
            errorMsg = errorData.error.message;
          }
        } catch {
          // body wasn't JSON; keep the generic message
        }
        const error = new Error(errorMsg);
        error.status = response.status;
        error.detail = errorDetail; // {message, errors: [...]} from the admin content editor, a list for 422 field errors
        throw error;
      }

      return await response.json();
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        const timeoutErr = new Error(`Request timed out after ${timeoutMs / 1000}s`);
        timeoutErr.isTimeout = true;
        throw timeoutErr;
      }
      if (!err.status && err instanceof TypeError) {
        err.isNetworkError = true;
      }
      throw err;
    }
  }

  // A file (PDF, CSV): same login handling as request(), but the body is a Blob. Returns { blob, filename }.
  async download(endpoint, retried = false) {
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const response = await fetch(`${this.baseUrl}${path}`, { credentials: 'include', headers: this.getHeaders(true) });
    if (response.status === 401 && !retried && (accessToken || hasSessionHint()) && (await refreshSession())) {
      return this.download(endpoint, true);
    }
    if (!response.ok) {
      let message = STATUS_MESSAGES[response.status] || `Download failed (${response.status}).`;
      try { const body = await response.json(); if (typeof body.detail === 'string') message = body.detail; } catch { /* not JSON */ }
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    const match = /filename="?([^";]+)"?/.exec(response.headers.get('Content-Disposition') || '');
    return { blob: await response.blob(), filename: match ? match[1] : 'download' };
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, body, options = {}) {
    const isFormData = body instanceof FormData;
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: isFormData || body === undefined ? body : JSON.stringify(body),
    });
  }

  put(endpoint, body, options = {}) {
    const isFormData = body instanceof FormData;
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: isFormData ? body : JSON.stringify(body),
    });
  }

  patch(endpoint, body, options = {}) {
    return this.request(endpoint, { ...options, method: 'PATCH', body: JSON.stringify(body) });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
}

export const api = new ApiClient();
export default api;
