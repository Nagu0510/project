import { api } from './api';

export const studentService = {
  async getProfile() {
    return await api.get('/student/profile');
  },

  async updateProfile(profileData) {
    return await api.put('/student/profile', profileData);
  },

  /** Email copies of placement alerts: off until the student turns them on (sent only to a verified address). */
  async saveSettings(emailNotifications) {
    return await api.put('/student/settings', { email_notifications: Boolean(emailNotifications) });
  },

  async getProgress() {
    return await api.get('/student/progress');
  },

  async getDashboard() {
    return await api.get('/student/dashboard');
  },
  // minutes east of UTC: the day boundary for streaks (stored once; see the daily challenge rules)
  setDayOffset(minutes) {
    return api.put('/student/day-offset', { day_offset_minutes: minutes });
  },
};

export default studentService;
