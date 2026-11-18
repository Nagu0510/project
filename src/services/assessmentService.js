import { api } from './api';
import { normalizeAssessmentQuestionsList } from '../utils/normalizers';

// Same band rule as the server (services/assessment_service.py): under 60 gap, 60-79 developing, 80+ strong.
export const bandFor = (score) => (score >= 80 ? 'strong' : score >= 60 ? 'developing' : 'gap');

const normalizeResult = (data) => ({
  attemptId: data.attempt_id || data.attemptId,
  sessionId: data.session_id || null,
  assessmentId: data.assessment_id || '',
  assessmentTitle: data.assessment_title || 'Assessment',
  difficulty: data.difficulty || '',
  overallScore: data.overall_score ?? 0,
  readinessScore: data.readiness_score ?? 0,
  correctCount: data.correct_count ?? 0,
  totalQuestions: data.total_questions ?? 0,
  timeTakenSeconds: data.time_taken_seconds ?? 0,
  submittedAt: data.submitted_at || null,
  topicScores: (data.topic_scores || []).map((t) => ({ ...t, band: t.band || bandFor(t.score) })),
  gapTopics: data.gap_topics || [],
  strengths: data.strengths || [],
  skillGaps: data.skill_gaps || [],
  recommendedPractice: data.recommended_practice || '',
  recommendedRoadmapStep: data.recommended_roadmap_step || '',
  nextSteps: data.next_steps || [],
  review: (data.review || []).map((r) => ({
    questionId: r.question_id,
    number: r.number,
    topic: r.topic || '',
    questionText: r.question_text || '',
    code: r.code || null,
    options: r.options || [],
    yourAnswerIndex: r.your_answer_index ?? null,
    correctIndex: r.correct_option_index,
    correctAnswer: r.correct_answer || '',
    isCorrect: Boolean(r.is_correct),
    explanation: r.explanation || '',
  })),
});

export const assessmentService = {
  async getAssessments(careerPath = null, difficulty = null, skill = null) {
    const params = new URLSearchParams();
    if (careerPath && careerPath !== 'All') params.append('career_path', careerPath);
    if (difficulty && difficulty !== 'All') params.append('difficulty', difficulty);
    if (skill && skill !== 'All') params.append('skill', skill);
    const queryStr = params.toString() ? `?${params.toString()}` : '';
    return await api.get(`/assessments${queryStr}`); // throws: the page shows an error banner with a retry
  },

  /** Open a timed session (or reopen the unexpired one). Questions come shuffled and without answer keys. */
  async startSession(assessmentId) {
    const data = await api.post(`/assessments/${encodeURIComponent(assessmentId)}/start`, {});
    return {
      sessionId: data.session_id,
      assessmentId: data.assessment_id,
      title: data.title,
      difficulty: data.difficulty,
      expiresAt: data.expires_at,
      durationSeconds: data.duration_seconds,
      secondsRemaining: data.seconds_remaining,
      resumed: Boolean(data.resumed),
      answers: data.answers || {},
      questions: normalizeAssessmentQuestionsList(data.questions),
    };
  },

  /** Autosave, so a refresh keeps the answers. Resolves quietly on a network hiccup; rejects when the session is over. */
  async saveAnswers(sessionId, answers) {
    return await api.put(`/assessments/sessions/${encodeURIComponent(sessionId)}/answers`, { answers });
  },

  async submitSession(sessionId, assessmentId, answers) {
    const data = await api.post(`/assessments/${encodeURIComponent(assessmentId)}/submit`, {
      session_id: sessionId,
      assessment_id: assessmentId,
      answers,
    });
    return normalizeResult(data);
  },

  async getPracticeQuestions(skill = null, difficulty = null, topic = null, company = null) {
    const params = new URLSearchParams();
    if (skill && skill !== 'All') params.append('skill', skill);
    if (difficulty && difficulty !== 'All') params.append('difficulty', difficulty);
    if (topic && topic !== 'All') params.append('topic', topic);
    if (company && company !== 'All') params.append('company', company);
    const queryStr = params.toString() ? `?${params.toString()}` : '';
    return normalizeAssessmentQuestionsList(await api.get(`/assessments/practice/questions${queryStr}`));
  },

  async verifyPracticeAnswer(questionId, selectedOptionIndex) {
    return await api.post('/assessments/practice/verify', {
      question_id: questionId,
      selected_option_index: selectedOptionIndex,
    });
  },

  /** The latest graded result with its review, or null when the student has not taken an assessment yet (404). */
  async getLatestResult() {
    try {
      return normalizeResult(await api.get('/assessments/result/latest'));
    } catch (err) {
      if (err?.status === 404) return null;
      throw err; // any other failure is shown as an error with a retry, not as "no assessment yet"
    }
  },
};

export default assessmentService;
