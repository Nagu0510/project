import { api } from './api';
import { mockPlacementJobs } from '../data/mockPlacementJobs';
import { normalizePlacementJobList } from '../utils/normalizers';

export const placementService = {
  async getPlacementJobs() {
    try {
      const data = await api.get('/placements');
      const normalized = normalizePlacementJobList(data);
      if (normalized.length > 0) return normalized;
      return normalizePlacementJobList(mockPlacementJobs);
    } catch {
      return normalizePlacementJobList(mockPlacementJobs);
    }
  },
};

export default placementService;
