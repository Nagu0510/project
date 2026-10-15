import { api } from './api';
import { normalizePlacementJobList } from '../utils/normalizers';

export const placementService = {
  async getPlacementJobs() {
    return normalizePlacementJobList(await api.get('/placements')); // a failure reaches the page, which shows an error banner with a retry
  },

  async createPlacementJob(jobData) {
    return await api.post('/placements', jobData);
  },

  async updatePlacementJob(jobId, jobData) {
    return await api.put(`/placements/${jobId}`, jobData);
  },

  /** newStatus is draft | published | closed (a JSON body; anything else is a 422). */
  async setStatus(jobId, newStatus) {
    return await api.patch(`/placements/${encodeURIComponent(jobId)}/status`, { new_status: newStatus });
  },

  async deletePlacementJob(jobId) {
    return await api.delete(`/placements/${jobId}`);
  },
};

export default placementService;
