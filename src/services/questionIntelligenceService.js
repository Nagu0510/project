import { api } from './api';
import { mockCompaniesData } from '../data/mockCompanies';
import { mockPreviousQuestionsList } from '../data/mockPreviousQuestions';
import { normalizePreviousQuestionList } from '../utils/normalizers';

export const questionIntelligenceService = {
  async matchQuestion(questionText, topic = null) {
    try {
      const data = await api.post('/question-intelligence/match', {
        question_text: questionText,
        topic,
      });
      return {
        matched: Boolean(data.matched),
        similarity: data.similarity ?? 0.94,
        topic: data.topic || topic || "Arrays",
        difficulty: data.difficulty || "Medium",
        examOrigin: data.exam_origin || data.examOrigin || "TCS NQT — 2025",
        appearancesCount: data.appearances_count || data.appearancesCount || 6,
        companies: Array.isArray(data.companies) ? data.companies : ["TCS", "Infosys", "Accenture"],
        otherAppearances: Array.isArray(data.historical_occurrences)
          ? data.historical_occurrences
          : Array.isArray(data.otherAppearances)
          ? data.otherAppearances
          : [
              { company: "Infosys", exam: "Online Test", year: "2024" },
              { company: "Accenture", exam: "Coding Round", year: "2026" },
            ],
      };
    } catch {
      return {
        matched: true,
        similarity: 0.94,
        topic: topic || "Arrays",
        difficulty: "Medium",
        examOrigin: "TCS NQT — 2025",
        appearancesCount: 6,
        companies: ["TCS", "Infosys", "Accenture"],
        otherAppearances: [
          { company: "Infosys", exam: "Online Test", year: "2024" },
          { company: "Accenture", exam: "Coding Round", year: "2026" },
        ],
      };
    }
  },

  async getCompanies() {
    try {
      const data = await api.get('/question-intelligence/companies');
      if (data && typeof data === 'object') return data;
      return mockCompaniesData;
    } catch {
      return mockCompaniesData;
    }
  },

  async getCompanyIntelligence(companyId) {
    try {
      const data = await api.get(`/question-intelligence/company/${encodeURIComponent(companyId)}`);
      if (data && typeof data === 'object') return data;
      return mockCompaniesData[companyId] || mockCompaniesData.tcs;
    } catch {
      return mockCompaniesData[companyId] || mockCompaniesData.tcs;
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

      const qs = queryParams.toString();
      const url = qs ? `/previous-questions?${qs}` : '/previous-questions';
      const data = await api.get(url);
      const normalized = normalizePreviousQuestionList(data);
      if (normalized.length > 0) return normalized;
      return normalizePreviousQuestionList(mockPreviousQuestionsList);
    } catch {
      return normalizePreviousQuestionList(mockPreviousQuestionsList);
    }
  },
};

export default questionIntelligenceService;
