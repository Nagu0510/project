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

  async getExtractedQuestions(paperId = null) {
    const url = paperId ? `/admin/extracted-questions?paper_id=${encodeURIComponent(paperId)}` : '/admin/extracted-questions';
    return await api.get(url);
  },

  async updateQuestionStatus(questionId, newStatus) {
    return await api.put(`/admin/extracted-questions/${questionId}/status?new_status=${encodeURIComponent(newStatus)}`);
  },

  async getAdminAnalytics() {
    return await api.get('/admin/analytics');
  },
};

export default adminService;
