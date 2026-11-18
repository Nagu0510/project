import { api } from './api';
import { normalizeProblem, normalizeProblemList } from '../utils/normalizers';
import { normalizeRunResult, normalizeSubmitResult } from '../utils/practiceHelpers';

export const practiceService = {
  // Coding problems (API data only; an empty list becomes an empty state in the page)
  async getProblems(params = {}) {
    const queryStr = new URLSearchParams(params).toString();
    const data = await api.get(queryStr ? `/practice/problems?${queryStr}` : '/practice/problems');
    return normalizeProblemList(data);
  },

  async getProblemBySlug(slug) {
    const data = await api.get(`/practice/problems/${encodeURIComponent(slug)}`);
    return normalizeProblem(data);
  },

  // Run / submit throw on failure (401, 413, 422, 429, 503, network) so the page can tell the user exactly what happened.
  // `cases` is a list of "name = value" texts (examples as edited, plus custom cases); leave it out to run the shown examples.
  async runCode(slug, language, sourceCode, cases) {
    const body = { problem_slug: slug, language, source_code: sourceCode };
    if (Array.isArray(cases)) body.cases = cases;
    return normalizeRunResult(await api.post('/practice/code/run', body, { timeoutMs: 60000 }));
  },

  // Judges every test case in one execution.
  async submitCode(slug, language, sourceCode) {
    return normalizeSubmitResult(await api.post('/practice/code/submit', { problem_slug: slug, language, source_code: sourceCode }, { timeoutMs: 120000 }));
  },

  // Slugs of the problems this student has an Accepted submission for
  async getSolved() {
    const data = await api.get('/practice/solved');
    return Array.isArray(data?.solved) ? data.solved : [];
  },

  // One hint at a time (1, 2, 3)
  async getHint(slug, level) {
    return api.get(`/practice/problems/${encodeURIComponent(slug)}/hints?level=${encodeURIComponent(level)}`);
  },

  // This student's last 20 judged submissions of one problem, newest first
  async getSubmissions(slug) {
    const rows = await api.get(`/practice/problems/${encodeURIComponent(slug)}/submissions`);
    return (Array.isArray(rows) ? rows : []).map((r) => ({
      id: r.id,
      language: r.language,
      verdict: r.verdict,
      runtimeMs: r.runtime_ms ?? null,
      memoryKb: r.memory_kb ?? null,
      passedCount: r.passed_count ?? null,
      totalCount: r.total_count ?? null,
      createdAt: r.created_at,
      code: r.code || '',
    }));
  },

  async matchQuestionIntelligence(questionId, questionText) {
    try {
      return await api.post('/question-intelligence/match', {
        question_id: questionId,
        question_text: questionText.slice(0, 5000),
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

  // Daily challenge, streaks and badges (see backend/app/services/daily_challenge_service.py for the day rules)
  getDaily() {
    return api.get('/practice/daily');
  },

  getAchievements() {
    return api.get('/practice/achievements');
  },

  // "My submissions": one page of the student's own judged submissions; filters are { verdict, language, difficulty }
  getMySubmissions({ page = 1, pageSize = 20, verdict = '', language = '', difficulty = '' } = {}) {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (verdict) params.set('verdict', verdict);
    if (language) params.set('language', language);
    if (difficulty) params.set('difficulty', difficulty);
    return api.get(`/practice/submissions?${params.toString()}`);
  },

  getMySubmission(id) {
    return api.get(`/practice/submissions/${encodeURIComponent(id)}`);
  },
};

export default practiceService;
