import { api } from './api';
import { mockRoadmapData } from '../data/mockRoadmapData';
import { normalizeRoadmap } from '../utils/normalizers';

export const roadmapService = {
  async getRoadmap(careerPath = 'Backend Developer') {
    try {
      const url = careerPath ? `/student/roadmap?career_path=${encodeURIComponent(careerPath)}` : '/student/roadmap';
      const data = await api.get(url);
      const normalized = normalizeRoadmap(data, careerPath);
      if (normalized.milestones && normalized.milestones.length > 0) {
        return normalized;
      }
      return normalizeRoadmap({ career_path: careerPath, milestones: mockRoadmapData }, careerPath);
    } catch {
      return normalizeRoadmap({ career_path: careerPath, milestones: mockRoadmapData }, careerPath);
    }
  },

  async updateProgress(milestoneId, status) {
    return await api.put('/student/roadmap/progress', {
      milestone_id: milestoneId,
      status,
    });
  },
};

export default roadmapService;
