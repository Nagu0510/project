import { api } from './api';

// Courses, recommendations, notifications and the resume practice set. API data only: an empty answer is an empty state.
const camelModule = (m) => ({ id: m.id, title: m.title, topics: m.topics || [], hours: m.hours || 0 });

const camelCourse = (c) => ({
  slug: c.slug,
  title: c.title,
  level: c.level,
  description: c.description || '',
  skills: c.skills || [],
  prerequisites: c.prerequisites || [],
  modulesCount: c.modules_count ?? (c.modules || []).length,
  estimatedHours: c.estimated_hours || 0,
  modules: (c.modules || []).map(camelModule),
  outcomes: c.outcomes || [],
  practiceTopics: c.practice_topics || [],
  assessmentSkills: c.assessment_skills || [],
  resources: c.resources || [], // { provider, url }: the provider's home page only
});

const camelProgress = (p) => ({
  courseSlug: p.course_slug,
  title: p.title || '',
  modulesDone: p.modules_done || [],
  modulesTotal: p.modules_total || 0,
  percent: p.percent || 0,
  completed: Boolean(p.completed),
});

// company styles used for pattern-inspired practice (not real past questions)
export const COMPANIES = ['TCS', 'Infosys', 'Wipro', 'Accenture', 'Cognizant', 'Capgemini', 'Amazon'];

export const learningService = {
  async getCourses(filters = {}) {
    const params = new URLSearchParams();
    if (filters.skill) params.append('skill', filters.skill);
    if (filters.level && filters.level !== 'All') params.append('level', filters.level);
    const query = params.toString();
    return (await api.get(query ? `/courses?${query}` : '/courses')).map(camelCourse);
  },

  async getCourse(slug) {
    return camelCourse(await api.get(`/courses/${encodeURIComponent(slug)}`));
  },

  async markModule(slug, moduleId, done = true) {
    return camelProgress(await api.post(`/courses/${encodeURIComponent(slug)}/progress`, { module_id: moduleId, done }));
  },

  async getMyCourses() {
    return (await api.get('/student/courses')).map(camelProgress);
  },

  async getRecommendations() {
    const d = await api.get('/recommendations/courses');
    const ps = d.next_practice_set;
    return {
      nextPracticeSet: ps ? { id: ps.id, title: ps.title, skill: ps.skill, difficulty: ps.difficulty, questionsCount: ps.questions_count, courseTitle: ps.course_title } : null,
      hasData: Boolean(d.has_data),
      careerPath: d.career_path || '',
      courses: (d.courses || []).map((c) => ({
        slug: c.slug, title: c.title, level: c.level, estimatedHours: c.estimated_hours, modulesCount: c.modules_count,
        reason: c.reason, reasons: c.reasons || [], progress: c.progress || { done: 0, total: 0, percent: 0 },
      })),
      plan: {
        hoursPerWeek: d.plan?.hours_per_week || 0,
        totalHours: d.plan?.total_hours || 0,
        modulesAfterWeek4: d.plan?.modules_after_week_4 || 0,
        weeks: (d.plan?.weeks || []).map((w) => ({
          week: w.week, hours: w.hours, focus: w.focus,
          modules: (w.modules || []).map((m) => ({ courseSlug: m.course_slug, courseTitle: m.course_title, moduleId: m.module_id, title: m.title, hours: m.hours })),
        })),
      },
    };
  },

  async getNotifications() {
    return (await api.get('/notifications')).map((n) => ({
      id: n.id, type: n.type, title: n.title, message: n.body || n.message, link: n.link, read: n.read, createdAt: n.created_at,
    }));
  },
  markNotificationRead: (id) => api.post(`/notifications/${encodeURIComponent(id)}/read`, {}),
  markAllNotificationsRead: () => api.post('/notifications/read-all', {}),

  async getResumeQuestions({ analysisId, company } = {}) {
    const params = new URLSearchParams();
    if (analysisId) params.append('analysis_id', analysisId);
    if (company) params.append('company', company);
    const query = params.toString();
    return api.get(query ? `/resume/questions?${query}` : '/resume/questions');
  },
};

export default learningService;
