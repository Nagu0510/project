import { api } from './api';
import { mockCareerPaths } from '../data/mockCareerPaths';
import { normalizeCareerPathList } from '../utils/normalizers';

export const careerService = {
  async getCareerPaths() {
    try {
      const data = await api.get('/career-paths');
      const normalized = normalizeCareerPathList(data);
      if (normalized.length > 0) return normalized;
      return normalizeCareerPathList(mockCareerPaths);
    } catch {
      return normalizeCareerPathList(mockCareerPaths);
    }
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
