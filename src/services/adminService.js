import { api } from './api';

export const adminService = {
  async getDashboard() {
    return await api.get('/admin/dashboard');
  },

  async getQuestionPapers() {
    return await api.get('/admin/question-papers');
  },

  async uploadQuestionPaper(file, metadata) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('company', metadata.company);
    formData.append('exam', metadata.exam);
    formData.append('year', metadata.year || 2025);
    formData.append('paper_type', metadata.paperType || 'Mixed');
    formData.append('role', metadata.role || 'Software Engineer');
    if (metadata.description) formData.append('description', metadata.description);

    return await api.post('/admin/question-papers/upload', formData);
  },

  /** One page of the review queue (the server caps page_size at 100). A full page means there may be more. */
  async getExtractedQuestions(paperId = null, { page = 1, pageSize = 100, status = null } = {}) {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (paperId) params.set('paper_id', paperId);
    if (status) params.set('status', status);
    return await api.get(`/admin/extracted-questions?${params.toString()}`);
  },

  /** newStatus is one of needs_review | approved | published | rejected (sent as a JSON body; anything else is a 422). */
  async updateQuestionStatus(questionId, newStatus) {
    return await api.put(`/admin/extracted-questions/${encodeURIComponent(questionId)}/status`, { new_status: newStatus });
  },

  // ---- content editor: assessment questions, courses, career paths
  getContentMeta: () => api.get('/admin/content/meta'),
  listContentQuestions: ({ skill, difficulty, active, search, page = 1, pageSize = 25 } = {}) => {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (skill) params.set('skill', skill);
    if (difficulty) params.set('difficulty', difficulty);
    if (active !== undefined && active !== null && active !== '') params.set('active', String(active));
    if (search) params.set('search', search);
    return api.get(`/admin/content/questions?${params.toString()}`);
  },
  createContentQuestion: (body) => api.post('/admin/content/questions', body),
  updateContentQuestion: (id, body) => api.put(`/admin/content/questions/${encodeURIComponent(id)}`, body),
  setContentQuestionActive: (id, active) => api.post(`/admin/content/questions/${encodeURIComponent(id)}/${active ? 'activate' : 'deactivate'}`, {}),
  listContentCourses: () => api.get('/admin/content/courses'),
  createContentCourse: (body) => api.post('/admin/content/courses', body),
  updateContentCourse: (slug, body) => api.put(`/admin/content/courses/${encodeURIComponent(slug)}`, body),
  setContentCourseActive: (slug, active) => api.post(`/admin/content/courses/${encodeURIComponent(slug)}/${active ? 'activate' : 'deactivate'}`, {}),
  listContentPaths: () => api.get('/admin/content/career-paths'),
  updateContentPath: (id, body) => api.put(`/admin/content/career-paths/${encodeURIComponent(id)}`, body),

  async deleteQuestion(extractedQuestionId) {
    return await api.delete(`/admin/questions/${encodeURIComponent(extractedQuestionId)}`);
  },

  async getStudents() {
    return await api.get('/admin/students');
  },

  async getAdminAnalytics() {
    return await api.get('/admin/analytics');
  },
};

export default adminService;
