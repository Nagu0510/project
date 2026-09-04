import { api } from './api';
import { safeStorage } from '../utils/storage';

const DEFAULT_STUDENT_FALLBACK = {
  id: 'usr-student-01',
  name: 'Nagappa Gongadi',
  email: 'nagappa@skillsense.ai',
  role: 'student',
  college: 'Engineering College',
  department: 'Computer Science & Engineering',
  year: 'Final Year (2026)',
  career_interest: 'Backend Developer',
  current_path: 'Backend Developer',
  preferred_language: 'Python 3',
  skill_level: 'Intermediate',
  readiness_score: 87,
  skill_progress: 74,
  assessments_completed: 1,
  strong_skills: ['Python', 'SQL', 'Java', 'REST APIs'],
  gap_skills: ['System Design', 'Docker', 'Kubernetes'],
};

const DEFAULT_ADMIN_FALLBACK = {
  id: 'usr-admin-01',
  name: 'SkillSense Admin',
  email: 'admin@skillsense.ai',
  role: 'admin',
  department: 'Platform Engineering & Placement Intelligence',
  managedPapersCount: 46,
  extractedQuestionsCount: 2840,
  verifiedCompanies: 18,
};

export const authService = {
  async register(name, email, password, careerInterest) {
    try {
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
    } catch (err) {
      if (err.isNetworkError) {
        console.info('[SkillSense Auth] Backend offline — activating resilient local registration.');
        const mockToken = `mock-token-${Date.now()}`;
        const mockUser = {
          ...DEFAULT_STUDENT_FALLBACK,
          id: `usr-${Date.now().toString(36)}`,
          name: name || 'Student User',
          email: email.toLowerCase().trim(),
          career_interest: careerInterest || 'Backend Developer',
          current_path: careerInterest || 'Backend Developer',
          strong_skills: ['Python'],
          gap_skills: ['System Design', 'Docker'],
        };
        localStorage.setItem('skillsense_token', mockToken);
        return { access_token: mockToken, user: mockUser };
      }
      throw err;
    }
  },

  async login(email, password) {
    try {
      const data = await api.post('/auth/login', {
        email,
        password,
      });
      if (data.access_token) {
        localStorage.setItem('skillsense_token', data.access_token);
      }
      return data;
    } catch (err) {
      if (err.isNetworkError) {
        console.info('[SkillSense Auth] Backend offline — activating resilient local student authentication.');
        const cleanEmail = (email || '').toLowerCase().trim();
        const displayName = cleanEmail ? cleanEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Student User';
        
        const mockToken = `mock-token-${Date.now()}`;
        const mockUser = {
          ...DEFAULT_STUDENT_FALLBACK,
          email: cleanEmail || DEFAULT_STUDENT_FALLBACK.email,
          name: cleanEmail === DEFAULT_STUDENT_FALLBACK.email ? DEFAULT_STUDENT_FALLBACK.name : displayName,
        };
        localStorage.setItem('skillsense_token', mockToken);
        return { access_token: mockToken, user: mockUser };
      }
      throw err;
    }
  },

  async adminLogin(email, password) {
    try {
      const data = await api.post('/auth/admin/login', {
        email,
        password,
      });
      if (data.access_token) {
        localStorage.setItem('skillsense_token', data.access_token);
      }
      return data;
    } catch (err) {
      if (err.isNetworkError) {
        console.info('[SkillSense Auth] Backend offline — activating resilient local administrator authentication.');
        const mockToken = `mock-admin-token-${Date.now()}`;
        localStorage.setItem('skillsense_token', mockToken);
        return { access_token: mockToken, user: DEFAULT_ADMIN_FALLBACK };
      }
      throw err;
    }
  },

  async getMe() {
    try {
      return await api.get('/auth/me');
    } catch (err) {
      if (err.isNetworkError) {
        const cachedUser = safeStorage.get('user', null);
        if (cachedUser) return cachedUser;
        return DEFAULT_STUDENT_FALLBACK;
      }
      throw err;
    }
  },

  logout() {
    localStorage.removeItem('skillsense_token');
    localStorage.removeItem('skillsense_user');
    localStorage.removeItem('skillsense_auth');
  },
};

export default authService;
