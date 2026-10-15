import { api } from './api';
import { normalizeResumeReport, normalizeResumeHistory } from '../utils/normalizers';

// Reading a scan or photo runs OCR on the server (up to 40 s), so these requests wait longer than the default.
const SLOW = { timeoutMs: 90000 };

export const resumeService = {
  async analyzeResume(file, careerPath, jobDescription = '') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('career_path', careerPath);
    if (jobDescription.trim()) formData.append('job_description', jobDescription.trim());
    return normalizeResumeReport(await api.post('/resume/analyze', formData, SLOW), careerPath);
  },

  // Re-score text the student edited (for example to fix OCR mistakes) without uploading the file again
  async analyzeText(text, careerPath, jobDescription = '') {
    const body = { text, career_path: careerPath };
    if (jobDescription.trim()) body.job_description = jobDescription.trim();
    return normalizeResumeReport(await api.post('/resume/analyze-text', body, SLOW), careerPath);
  },

  async getHistory() {
    return normalizeResumeHistory(await api.get('/resume/history'));
  },
};

export default resumeService;
