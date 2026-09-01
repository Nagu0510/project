import { api } from './api';

export const studentService = {
  async getProfile() {
    return await api.get('/student/profile');
  },

  async updateProfile(profileData) {
    return await api.put('/student/profile', profileData);
  },

  async getProgress() {
    return await api.get('/student/progress');
  },

  async getDashboard() {
    return await api.get('/student/dashboard');
  },
};

export default studentService;
