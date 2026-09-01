import { api } from './api';

export const authService = {
  async register(name, email, password, careerInterest) {
    const data = await api.post('/auth/register', {
      name,
      email,
      password,
      career_interest: careerInterest,
    });
    if (data.access_token) {
      localStorage.setItem('skillsense_token', data.access_token);
    }
    return data;
  },

  async login(email, password) {
    const data = await api.post('/auth/login', {
      email,
      password,
    });
    if (data.access_token) {
      localStorage.setItem('skillsense_token', data.access_token);
    }
    return data;
  },

  async adminLogin(email, password) {
    const data = await api.post('/auth/admin/login', {
      email,
      password,
    });
    if (data.access_token) {
      localStorage.setItem('skillsense_token', data.access_token);
    }
    return data;
  },

  async getMe() {
    return await api.get('/auth/me');
  },

  logout() {
    localStorage.removeItem('skillsense_token');
    localStorage.removeItem('skillsense_user');
    localStorage.removeItem('skillsense_auth');
  },
};

export default authService;
