import { api } from './api';
import { normalizePreviousQuestionList } from '../utils/normalizers';

export const questionIntelligenceService = {
  async matchQuestion(questionText, topic = null) {
    try {
      const data = await api.post('/question-intelligence/match', {
        question_text: questionText,
        topic,
      });
      if (!data || !data.matched) {
        return {
          matched: false,
          similarity: 0,
          topic: topic || "General",
          difficulty: "Medium",
          examOrigin: "No Paper Match Found",
          appearancesCount: 0,
          companies: [],
          best_match: null,
          matches: [],
          otherAppearances: [],
        };
      }
      return {
        matched: true,
        similarity: data.similarity ?? 0,
        topic: data.topic || topic || "General",
        difficulty: data.difficulty || "Medium",
        examOrigin: data.exam_origin || data.examOrigin || "",
        appearancesCount: data.appearances_count || data.appearancesCount || 1,
        companies: Array.isArray(data.companies) ? data.companies : [],
        best_match: data.best_match || null,
        matches: Array.isArray(data.matches) ? data.matches : [],
        otherAppearances: Array.isArray(data.historical_occurrences) ? data.historical_occurrences : [],
      };
    } catch {
      return {
        matched: false,
        similarity: 0,
        topic: topic || "General",
        difficulty: "Medium",
        examOrigin: "No Match Found",
        appearancesCount: 0,
        companies: [],
        best_match: null,
        matches: [],
        otherAppearances: [],
      };
    }
  },

  async getCompanies() {
    // `empty` is true when no previous questions are published; a failure reaches the page (error banner + retry)
    const data = await api.get('/question-intelligence/summary');
    return data && typeof data.companies === 'object' ? data.companies : {};
  },

  async getCompanyIntelligence(companyId) {
    try {
      const data = await api.get(`/question-intelligence/company/${encodeURIComponent(companyId)}`);
      return data && typeof data === 'object' ? data : null;
    } catch (err) {
      console.warn('Company intelligence unavailable:', err.message);
      return null;
    }
  },

  async getPreviousQuestions(params = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (params.company && params.company !== 'All') queryParams.append('company', params.company);
      if (params.year) queryParams.append('year', params.year);
      if (params.topic && params.topic !== 'All') queryParams.append('topic', params.topic);
      if (params.difficulty && params.difficulty !== 'All') queryParams.append('difficulty', params.difficulty);
      if (params.search) queryParams.append('search', params.search);

      // the server answers 100 at a time: keep asking until a page comes back short
      const rows = [];
      for (let page = 1; page <= 50; page += 1) {
        const pageParams = new URLSearchParams(queryParams);
        pageParams.set('page', String(page));
        pageParams.set('page_size', '100');
        const chunk = await api.get(`/previous-questions?${pageParams.toString()}`);
        rows.push(...(Array.isArray(chunk) ? chunk : []));
        if (!Array.isArray(chunk) || chunk.length < 100) break;
      }
      return normalizePreviousQuestionList(rows);
    } catch (err) {
      console.warn('Previous questions unavailable:', err.message);
      throw err; // the page shows an error banner with a retry
    }
  },
};

export default questionIntelligenceService;
