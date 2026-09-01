import { api } from './api';
import { normalizeResumeReport } from '../utils/normalizers';

export const resumeService = {
  async analyzeResume(file, careerPath = 'Backend Developer') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('career_path', careerPath);

    const data = await api.post('/resume/analyze', formData);
    return normalizeResumeReport(data, careerPath);
  },
};

export default resumeService;
