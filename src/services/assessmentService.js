import { api } from './api';
import { mockAssessmentQuestions } from '../data/mockAssessmentMatches';
import { normalizeAssessmentQuestionsList, normalizeAssessmentQuestion } from '../utils/normalizers';

export const assessmentService = {
  async getAssessments(careerPath = null, difficulty = null, skill = null) {
    try {
      const params = new URLSearchParams();
      if (careerPath && careerPath !== 'All') params.append('career_path', careerPath);
      if (difficulty && difficulty !== 'All') params.append('difficulty', difficulty);
      if (skill && skill !== 'All') params.append('skill', skill);
      
      const queryStr = params.toString() ? `?${params.toString()}` : '';
      return await api.get(`/assessments${queryStr}`);
    } catch (err) {
      console.warn('Failed to fetch assessments catalog:', err.message);
      return [];
    }
  },

  async getAssessmentById(assessmentId) {
    try {
      const data = await api.get(`/assessments/${assessmentId}`);
      if (data && data.questions) {
        return {
          ...data,
          questions: normalizeAssessmentQuestionsList(data.questions),
        };
      }
      return data;
    } catch (err) {
      console.warn(`Failed to fetch assessment ${assessmentId}:`, err.message);
      return {
        id: assessmentId,
        title: 'Diagnostic Technical Assessment',
        questions: normalizeAssessmentQuestionsList(mockAssessmentQuestions),
        questions_count: mockAssessmentQuestions.length,
        duration_minutes: 15,
        difficulty: 'Medium',
      };
    }
  },

  async getPracticeQuestions(skill = null, difficulty = null, topic = null) {
    try {
      const params = new URLSearchParams();
      if (skill && skill !== 'All') params.append('skill', skill);
      if (difficulty && difficulty !== 'All') params.append('difficulty', difficulty);
      if (topic && topic !== 'All') params.append('topic', topic);

      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const data = await api.get(`/assessments/practice/questions${queryStr}`);
      return normalizeAssessmentQuestionsList(data);
    } catch (err) {
      console.warn('Failed to fetch practice questions:', err.message);
      return normalizeAssessmentQuestionsList(mockAssessmentQuestions);
    }
  },

  async verifyPracticeAnswer(questionId, selectedOptionIndex) {
    return await api.post('/assessments/practice/verify', {
      question_id: questionId,
      selected_option_index: selectedOptionIndex,
    });
  },

  async submitAssessment(assessmentId, answers, timeTakenSeconds) {
    const data = await api.post('/assessments/submit', {
      assessment_id: assessmentId,
      answers,
      time_taken_seconds: timeTakenSeconds,
    });
    return {
      attemptId: data.attempt_id || data.attemptId,
      overallScore: data.overall_score ?? data.overallScore ?? 80,
      readinessScore: data.readiness_score ?? data.readinessScore ?? 85,
      correctCount: data.correct_count ?? data.correctCount ?? 4,
      totalQuestions: data.total_questions ?? data.totalQuestions ?? 5,
      topicScores: data.topic_scores || data.topicScores || [],
      strengths: data.strengths || ['Python', 'SQL'],
      skillGaps: data.skill_gaps || data.skillGaps || ['System Design'],
      recommendedPractice: data.recommended_practice || data.recommendedPractice || 'Python Practice Set',
      recommendedRoadmapStep: data.recommended_roadmap_step || data.recommendedRoadmapStep || 'Milestone 04: Advanced APIs',
    };
  },

  async getLatestResult() {
    try {
      const data = await api.get('/assessments/result/latest');
      return {
        attemptId: data.attempt_id || data.attemptId,
        overallScore: data.overall_score ?? data.overallScore ?? 80,
        readinessScore: data.readiness_score ?? data.readinessScore ?? 85,
        correctCount: data.correct_count ?? data.correctCount ?? 4,
        totalQuestions: data.total_questions ?? data.totalQuestions ?? 5,
        topicScores: data.topic_scores || data.topicScores || [],
        strengths: data.strengths || ['Python', 'SQL'],
        skillGaps: data.skill_gaps || data.skillGaps || ['System Design'],
        recommendedPractice: data.recommended_practice || data.recommendedPractice || 'Python Practice Set',
        recommendedRoadmapStep: data.recommended_roadmap_step || data.recommendedRoadmapStep || 'Milestone 04: Advanced APIs',
      };
    } catch {
      return null;
    }
  },
};

export default assessmentService;
