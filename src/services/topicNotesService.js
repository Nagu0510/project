import { api } from './api';

export const topicNotesService = {
  async getNotesForTopic(topicKey) {
    return await api.get(`/topics/${encodeURIComponent(topicKey)}/notes`);
  },

  getDownloadUrl(noteId) {
    return `/api/topics/notes/${encodeURIComponent(noteId)}/download`;
  },

  async listAdminNotes(topic = null) {
    const params = new URLSearchParams();
    if (topic && topic !== 'All') params.set('topic', topic);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return await api.get(`/admin/notes${qs}`);
  },

  async createNote(formData) {
    return await api.post('/admin/notes', formData);
  },

  async updateNote(noteId, formData) {
    return await api.put(`/admin/notes/${encodeURIComponent(noteId)}`, formData);
  },

  async deleteNote(noteId) {
    return await api.delete(`/admin/notes/${encodeURIComponent(noteId)}`);
  },
};

export default topicNotesService;
