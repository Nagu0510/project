import { api } from './api';
import { normalizeRoadmap } from '../utils/normalizers';

export const roadmapService = {
  async getRoadmap(careerPath = '') {
    const url = careerPath ? `/student/roadmap?career_path=${encodeURIComponent(careerPath)}` : '/student/roadmap';
    return normalizeRoadmap(await api.get(url), careerPath);
  },

  async updateProgress(milestoneId, status) {
    return await api.put('/student/roadmap/progress', {
      milestone_id: milestoneId,
      status,
    });
  },
};

export default roadmapService;
