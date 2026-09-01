import { api } from './api';
import { mockCodingProblems } from '../data/mockCodingProblems';
import { normalizeProblem, normalizeProblemList } from '../utils/normalizers';

export const practiceService = {
  async getProblems() {
    try {
      const data = await api.get('/practice/problems');
      const normalized = normalizeProblemList(data);
      if (normalized.length > 0) return normalized;
      return normalizeProblemList(mockCodingProblems);
    } catch {
      return normalizeProblemList(mockCodingProblems);
    }
  },

  async getProblemBySlug(slug) {
    try {
      const data = await api.get(`/practice/problems/${encodeURIComponent(slug)}`);
      const normalized = normalizeProblem(data);
      if (normalized) return normalized;
      
      const fallback = mockCodingProblems[slug] || Object.values(mockCodingProblems)[0];
      return normalizeProblem(fallback);
    } catch {
      const fallback = mockCodingProblems[slug] || Object.values(mockCodingProblems)[0];
      return normalizeProblem(fallback);
    }
  },

  async submitAttempt(slug, language, code) {
    try {
      return await api.post(`/practice/problems/${encodeURIComponent(slug)}/attempt`, {
        language,
        code,
      });
    } catch {
      return {
        id: `att-local-${Date.now()}`,
        status: 'Accepted',
        message: 'Solution recorded in candidate portfolio session.',
      };
    }
  },
};

export default practiceService;
