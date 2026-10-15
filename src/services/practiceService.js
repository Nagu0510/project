import { api } from './api';
import { normalizeProblem, normalizeProblemList } from '../utils/normalizers';

export const practiceService = {
  // Coding IDE problems (API data only; an empty list becomes an empty state in the page)
  async getProblems(params = {}) {
    try {
      const queryStr = new URLSearchParams(params).toString();
      const data = await api.get(queryStr ? `/practice/problems?${queryStr}` : '/practice/problems');
      return normalizeProblemList(data);
    } catch (err) {
      console.warn('Problems unavailable:', err.message);
      throw err;
    }
  },

  async getProblemBySlug(slug) {
    const data = await api.get(`/practice/problems/${encodeURIComponent(slug)}`);
    return normalizeProblem(data);
  },

  // These two throw on failure (401, 413, 429, 503, network) so the page can tell the user exactly what happened.
  runCode(problemId, language, sourceCode, stdin = '') {
    return api.post('/practice/code/run', {
      problem_id: problemId,
      language,
      source_code: sourceCode,
      stdin,
    }, { timeoutMs: 40000 });
  },

  submitCode(problemId, language, sourceCode) {
    return api.post('/practice/code/submit', {
      problem_id: problemId,
      language,
      source_code: sourceCode,
    }, { timeoutMs: 120000 }); // judges up to 5 cases one after another
  },

  // Slugs of the problems this student has an Accepted submission for
  async getSolved() {
    const data = await api.get('/practice/solved');
    return Array.isArray(data?.solved) ? data.solved : [];
  },

  async matchQuestionIntelligence(questionId, questionText) {
    try {
      return await api.post('/question-intelligence/match', {
        question_id: questionId,
        question_text: questionText,
      });
    } catch (err) {
      console.warn('Question intelligence match error:', err);
      return {
        matched: false,
        similarity: 0.0,
        companies: [],
        best_match: null,
        matches: [],
      };
    }
  },

  submitAttempt(slug, language, code) {
    return api.post(`/practice/problems/${encodeURIComponent(slug)}/attempt`, { language, code });
  },

  // Interactive Question Practice (MCQs, Code Output, Find Error)
  async getInteractiveQuestions(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.skill && filters.skill !== 'All') params.append('skill', filters.skill);
      if (filters.topic && filters.topic !== 'All') params.append('topic', filters.topic);
      if (filters.difficulty && filters.difficulty !== 'All') params.append('difficulty', filters.difficulty);
      if (filters.type && filters.type !== 'All') params.append('question_type', filters.type);

      const endpoint = `/practice/questions?${params.toString()}`;
      return await api.get(endpoint);
    } catch (err) {
      console.warn('Practice questions fetch fallback:', err);
      return [];
    }
  },

  answerQuestion(questionId, selectedOptionIndex) {
    return api.post(`/practice/questions/${encodeURIComponent(questionId)}/answer`, {
      selected_option_index: selectedOptionIndex,
    });
  },

  getStats() {
    return api.get('/practice/stats');
  },
};

export default practiceService;
