import { api, setAccessToken } from './api';
import { safeStorage } from '../utils/storage';

const OFFLINE_MESSAGE = 'Cannot reach the server. Please try again.';

// Network failures become one clear error. There is deliberately no offline/mock login:
// if the server can't be reached, the user stays signed out.
const withNetworkError = async (fn) => {
  try {
    return await fn();
  } catch (err) {
    if (err.isNetworkError || err.isTimeout) throw new Error(OFFLINE_MESSAGE);
    throw err;
  }
};

const startSession = (data) => {
  setAccessToken(data.access_token);
  safeStorage.set('auth', 'true'); // hint only: tells us a refresh cookie may exist
  return data;
};

export const authService = {
  register: (name, email, password, careerInterest) =>
    withNetworkError(async () =>
      startSession(await api.post('/auth/register', {
        name,
        email,
        password,
        career_interest: careerInterest,
      }))),

  login: (email, password) =>
    withNetworkError(async () => startSession(await api.post('/auth/login', { email, password }))),

  adminLogin: (email, password) =>
    withNetworkError(async () => startSession(await api.post('/auth/admin/login', { email, password }))),

  googleLogin: (credential) =>
    withNetworkError(async () => startSession(await api.post('/auth/google', { credential }))),

  sendVerification: () => withNetworkError(() => api.post('/auth/send-verification')),

  verifyEmail: (token) =>
    withNetworkError(() => api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`)),

  // Called on page load. Returns { user } when the refresh cookie is still valid, otherwise null.
  async restoreSession() {
    if (!safeStorage.get('auth', null)) return null;
    const data = await api.refreshSession();
    if (!data) safeStorage.remove('auth');
    return data;
  },

  getMe: () => withNetworkError(() => api.get('/auth/me')),

  async changePassword(currentPassword, newPassword) {
    const data = await withNetworkError(() => api.post('/auth/change-password', {
      current_password: currentPassword || null, // null = "set a password" for Google-only accounts
      new_password: newPassword,
    }));
    if (data.access_token) setAccessToken(data.access_token); // old tokens were just invalidated
    return data;
  },

  forgotPassword: (email) =>
    withNetworkError(() => api.post('/auth/forgot-password', { email })),

  resetPassword: (token, newPassword) =>
    withNetworkError(() => api.post('/auth/reset-password', { token, new_password: newPassword })),

  async logout() {
    try {
      await api.post('/auth/logout');
    } catch {
      // Server unreachable: still sign out locally; the refresh cookie expires on its own.
    }
    setAccessToken(null);
    safeStorage.clearSkillSenseKeys();
  },
};

export default authService;
