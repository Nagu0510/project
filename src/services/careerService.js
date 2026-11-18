import { api } from './api';
import { normalizeCareerPathList } from '../utils/normalizers';

export const careerService = {
  async getCareerPaths() {
    return normalizeCareerPathList(await api.get('/career-paths')); // a failure reaches the page, which shows an error banner with a retry
  },

  async selectCareerPath(careerPathId, careerPathTitle) {
    return await api.post('/student/career-path', {
      career_path_id: careerPathId,
      career_path_title: careerPathTitle,
      career_path: careerPathTitle,
    });
  },
};

export default careerService;
