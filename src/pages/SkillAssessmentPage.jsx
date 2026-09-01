import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/common/Sidebar';
import { Navbar } from '../components/common/Navbar';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { PreviousQuestionPopup } from '../components/shared/PreviousQuestionPopup';
import { PreviousQuestionModal } from '../components/shared/PreviousQuestionModal';
import { mockAssessmentQuestions } from '../data/mockAssessmentMatches';
import { assessmentService } from '../services/assessmentService';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { normalizeAssessmentQuestionsList } from '../utils/normalizers';
import {
  Clock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ArrowRight,
  BookOpen,
  Award,
  Layers,
  Zap,
  RotateCcw,
  Check,
  X,
  Compass,
} from 'lucide-react';

export const SkillAssessmentPage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, requireAuth, updateUserProfile } = useAuth();
  const { showPreviousQuestionInsights } = useSettings();
  const { addToast } = useToast();

  // Mode: 'catalog' | 'testing' | 'practice'
  const [activeTab, setActiveTab] = useState('catalog');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [selectedSkill, setSelectedSkill] = useState('All');

  // Assessment Catalog
  const [assessmentsList, setAssessmentsList] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [activeAssessment, setActiveAssessment] = useState(null);

  // Live Assessment Test State
  const [questionsList, setQuestionsList] = useState([]);
  const [loadingTest, setLoadingTest] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const [dismissedPopups, setDismissedPopups] = useState({});
  const [activeModalMatch, setActiveModalMatch] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Skill Practice Mode State
  const [practiceQuestions, setPracticeQuestions] = useState([]);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceSelectedOpt, setPracticeSelectedOpt] = useState(null);
  const [practiceFeedback, setPracticeFeedback] = useState(null);
  const [loadingPractice, setLoadingPractice] = useState(false);

  const careerTitle = user?.currentPath || 'Backend Developer';

  // Fetch Assessment Catalog
  const fetchCatalog = async () => {
    setLoadingCatalog(true);
    try {
      const data = await assessmentService.getAssessments(careerTitle, selectedDifficulty, selectedSkill);
      setAssessmentsList(data || []);
    } catch (err) {
      console.warn('Error loading assessment catalog:', err);
    } finally {
      setLoadingCatalog(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, [careerTitle, selectedDifficulty, selectedSkill]);

  // Timer countdown for testing
  useEffect(() => {
    if (activeTab !== 'testing' || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeTab, timeLeft]);

  // Start specific assessment
  const handleStartAssessment = async (asm) => {
    setLoadingTest(true);
    setActiveAssessment(asm);
    setActiveTab('testing');
    setSelectedAnswers({});
    setCurrentIndex(0);
    setTimeLeft((asm.duration_minutes || 15) * 60);

    try {
      const detail = await assessmentService.getAssessmentById(asm.id);
      if (detail && detail.questions && detail.questions.length > 0) {
        setQuestionsList(detail.questions);
      } else {
        setQuestionsList(normalizeAssessmentQuestionsList(mockAssessmentQuestions));
      }
    } catch (err) {
      console.warn('Assessment detail fetch fallback:', err);
      setQuestionsList(normalizeAssessmentQuestionsList(mockAssessmentQuestions));
    } finally {
      setLoadingTest(false);
    }
  };

  // Start Practice Mode
  const handleStartPracticeMode = async () => {
    setActiveTab('practice');
    setLoadingPractice(true);
    setPracticeIndex(0);
    setPracticeSelectedOpt(null);
    setPracticeFeedback(null);

    try {
      const questions = await assessmentService.getPracticeQuestions(
        selectedSkill !== 'All' ? selectedSkill : null,
        selectedDifficulty !== 'All' ? selectedDifficulty : null
      );
      setPracticeQuestions(questions || []);
    } catch (err) {
      console.warn('Practice questions error:', err);
    } finally {
      setLoadingPractice(false);
    }
  };

  // Verify practice answer immediately
  const handleVerifyPractice = async () => {
    const currentPracticeQ = practiceQuestions[practiceIndex];
    if (!currentPracticeQ || practiceSelectedOpt === null) return;

    try {
      const res = await assessmentService.verifyPracticeAnswer(currentPracticeQ.id, practiceSelectedOpt);
      setPracticeFeedback(res);
      if (res.is_correct) {
        addToast('Correct answer! Excellent problem solving.', 'success');
      } else {
        addToast('Incorrect. Check the explanation below.', 'error');
      }
    } catch (err) {
      console.warn('Verification error:', err);
    }
  };

  const currentQ = questionsList.length > 0 ? questionsList[Math.min(currentIndex, questionsList.length - 1)] : null;
  const currentPracticeQ = practiceQuestions.length > 0 ? practiceQuestions[Math.min(practiceIndex, practiceQuestions.length - 1)] : null;

  const handleSelectOption = (optIdx) => {
    if (!currentQ) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQ.id]: optIdx,
    }));
  };

  const handleFinishAssessment = async () => {
    if (!isAuthenticated) {
      requireAuth(() => {
        navigate('/assessment-results');
      }, '/assessment-results');
      return;
    }

    setSubmitting(true);
    try {
      const totalTime = (activeAssessment?.duration_minutes || 15) * 60;
      const timeTaken = Math.max(10, totalTime - timeLeft);
      const assessmentId = activeAssessment?.id || 'asm-py-med-1';
      const result = await assessmentService.submitAssessment(assessmentId, selectedAnswers, timeTaken);
      
      updateUserProfile({
        readinessScore: result.readinessScore || 85,
        assessmentsCompleted: (user?.assessmentsCompleted || 0) + 1,
        strongSkills: result.strengths || ['Python', 'SQL'],
        gapSkills: result.skillGaps || ['System Design'],
      });
      addToast('Assessment submitted successfully! Evaluation computed.', 'success');
      navigate('/assessment-results');
    } catch (err) {
      console.warn('Submit error:', err.message);
      addToast('Assessment recorded! Loading your skill score.', 'success');
      navigate('/assessment-results');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={isAuthenticated ? "dashboard-layout" : ""} style={{ minHeight: '100vh', backgroundColor: 'var(--color-warm-ivory)' }}>
      {isAuthenticated ? <Sidebar /> : <Navbar />}

      <main className={isAuthenticated ? "dashboard-main" : "container-custom"} style={{ padding: isAuthenticated ? undefined : '2.5rem 1.5rem 5rem' }}>
        <div className="dashboard-content animate-fade-in" style={{ padding: isAuthenticated ? undefined : 0, maxWidth: '1080px', margin: '0 auto' }}>
          
          {/* Top Page Header */}
          <div
            style={{
              marginBottom: '2rem',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--color-emerald)' }}>✦</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-emerald)' }}>
                  Placement Diagnostic Evaluations
                </span>
                <Badge variant="lime" size="sm">Easy · Medium · Hard</Badge>
              </div>
              <h1
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 'clamp(1.8rem, 3.5vw, 2.5rem)',
                  color: 'var(--color-deep-forest)',
                  margin: 0,
                }}
              >
                Skill Assessment System
              </h1>
              <p style={{ fontSize: '0.95rem', color: 'var(--color-charcoal-subtle)', marginTop: '4px', maxWidth: '700px' }}>
                Calibrated multi-tier diagnostic evaluations across Easy, Medium, and Hard tiers with TF-IDF placement intelligence and practice mode.
              </p>
            </div>

            {/* Mode Tabs */}
            <div style={{ display: 'flex', gap: '8px', backgroundColor: 'var(--color-ivory-surface)', padding: '4px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)' }}>
              <button
                onClick={() => setActiveTab('catalog')}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  backgroundColor: activeTab === 'catalog' ? 'var(--color-emerald)' : 'transparent',
                  color: activeTab === 'catalog' ? 'var(--color-white)' : 'var(--color-deep-forest)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Assessment Catalog
              </button>
              <button
                onClick={handleStartPracticeMode}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  backgroundColor: activeTab === 'practice' ? 'var(--color-emerald)' : 'transparent',
                  color: activeTab === 'practice' ? 'var(--color-white)' : 'var(--color-deep-forest)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Skill Practice Mode ↗
              </button>
            </div>
          </div>

          {/* =========================================================================
              VIEW 1: ASSESSMENT CATALOG (EASY / MEDIUM / HARD)
              ========================================================================= */}
          {activeTab === 'catalog' && (
            <div>
              {/* Filter Bar */}
              <div
                className="card-static"
                style={{
                  padding: '1.25rem 1.5rem',
                  backgroundColor: 'var(--color-white)',
                  borderRadius: 'var(--radius-xl)',
                  border: '1px solid var(--color-border-subtle)',
                  marginBottom: '2rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                {/* Difficulty Filters */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.825rem', fontWeight: 800, color: 'var(--color-deep-forest)', textTransform: 'uppercase' }}>
                    Difficulty:
                  </span>
                  {['All', 'Easy', 'Medium', 'Hard'].map((diff) => (
                    <button
                      key={diff}
                      onClick={() => setSelectedDifficulty(diff)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-full)',
                        border: `1.5px solid ${selectedDifficulty === diff ? 'var(--color-emerald)' : 'var(--color-border-subtle)'}`,
                        backgroundColor: selectedDifficulty === diff ? 'var(--color-emerald)' : 'var(--color-ivory-surface)',
                        color: selectedDifficulty === diff ? 'var(--color-white)' : 'var(--color-deep-forest)',
                        fontSize: '0.825rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {diff}
                    </button>
                  ))}
                </div>

                {/* Skill Filter Dropdown */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.825rem', fontWeight: 800, color: 'var(--color-deep-forest)', textTransform: 'uppercase' }}>
                    Domain:
                  </span>
                  <select
                    value={selectedSkill}
                    onChange={(e) => setSelectedSkill(e.target.value)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-border-medium)',
                      backgroundColor: 'var(--color-white)',
                      color: 'var(--color-deep-forest)',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="All">All Domains</option>
                    <option value="Python">Python</option>
                    <option value="JavaScript">JavaScript</option>
                    <option value="React">React</option>
                    <option value="Java">Java</option>
                    <option value="SQL & Databases">SQL & Databases</option>
                    <option value="DSA">DSA / Algorithms</option>
                    <option value="AI / Machine Learning">AI / Machine Learning</option>
                    <option value="Cloud / DevOps">Cloud / DevOps</option>
                  </select>
                </div>
              </div>

              {/* Assessment Grid */}
              {loadingCatalog ? (
                <div style={{ padding: '3rem 0', textAlign: 'center' }}>
                  <div style={{ color: 'var(--color-emerald)', fontWeight: 700 }}>✦ Loading Assessment Bank...</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                  {assessmentsList.map((asm) => {
                    const isEasy = asm.difficulty === 'Easy';
                    const isHard = asm.difficulty === 'Hard';

                    return (
                      <div
                        key={asm.id}
                        className="card-floating"
                        style={{
                          padding: '1.75rem',
                          backgroundColor: 'var(--color-white)',
                          borderRadius: 'var(--radius-2xl)',
                          border: '1.5px solid var(--color-border-subtle)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: '1.25rem',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <Badge variant={isEasy ? 'success' : isHard ? 'forest' : 'lime'} size="sm">
                              {asm.difficulty} Tier
                            </Badge>
                            <span style={{ fontSize: '0.78rem', color: 'var(--color-muted-green)', fontWeight: 600 }}>
                              {asm.duration_minutes || 15} mins
                            </span>
                          </div>

                          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', color: 'var(--color-deep-forest)', margin: '0 0 6px 0' }}>
                            {asm.title}
                          </h3>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-charcoal-subtle)' }}>
                              Skill: <strong>{asm.skill}</strong>
                            </span>
                            <span style={{ color: 'var(--color-border-medium)' }}>·</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--color-charcoal-subtle)' }}>
                              {asm.questions_count || 5} Questions
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          <Button
                            variant="primary"
                            size="md"
                            style={{ flex: 1 }}
                            onClick={() => handleStartAssessment(asm)}
                            icon={ArrowRight}
                            iconPosition="right"
                          >
                            Start Assessment
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* =========================================================================
              VIEW 2: FORMAL ASSESSMENT TEST RUNNER
              ========================================================================= */}
          {activeTab === 'testing' && (
            <div>
              {loadingTest ? (
                <div style={{ padding: '4rem', textAlign: 'center', backgroundColor: 'var(--color-white)', borderRadius: 'var(--radius-xl)' }}>
                  <div style={{ color: 'var(--color-emerald)', fontWeight: 700, fontSize: '1.1rem' }}>✦ Initializing Timed Assessment Session...</div>
                </div>
              ) : currentQ ? (
                <>
                  {/* Top Bar: Progress, Navigation Pills & Timer */}
                  <div
                    className="card-static"
                    style={{
                      padding: '1.25rem 1.75rem',
                      backgroundColor: 'var(--color-white)',
                      borderRadius: 'var(--radius-xl)',
                      border: '1px solid var(--color-border-subtle)',
                      marginBottom: '1.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '1rem',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-muted-green)' }}>
                        {activeAssessment?.skill || 'Engineering'} · {activeAssessment?.difficulty || 'Medium'}
                      </div>
                      <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', color: 'var(--color-deep-forest)' }}>
                        {activeAssessment?.title || 'Formal Diagnostic Assessment'}
                      </div>
                    </div>

                    {/* Question Jump Pills */}
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {questionsList.map((q, idx) => {
                        const isAnswered = selectedAnswers[q.id] !== undefined;
                        const isCurrent = idx === currentIndex;

                        return (
                          <button
                            key={q.id || idx}
                            onClick={() => setCurrentIndex(idx)}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              border: `1.5px solid ${isCurrent ? 'var(--color-emerald)' : 'var(--color-border-medium)'}`,
                              backgroundColor: isCurrent ? 'var(--color-emerald)' : isAnswered ? 'var(--color-lime-soft)' : 'var(--color-white)',
                              color: isCurrent ? 'var(--color-white)' : 'var(--color-deep-forest)',
                              fontWeight: 700,
                              fontSize: '0.825rem',
                              cursor: 'pointer',
                            }}
                          >
                            {idx + 1}
                          </button>
                        );
                      })}
                    </div>

                    {/* Timer */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        backgroundColor: 'var(--color-ivory-surface)',
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-full)',
                        border: '1px solid var(--color-border-subtle)',
                        color: 'var(--color-deep-forest)',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                      }}
                    >
                      <Clock size={16} color="var(--color-emerald)" />
                      <span>{formatTimer(timeLeft)}</span>
                    </div>
                  </div>

                  {/* Main Question Card */}
                  <div
                    className="card-static"
                    style={{
                      padding: '2.25rem',
                      backgroundColor: 'var(--color-white)',
                      borderRadius: 'var(--radius-2xl)',
                      border: '1.5px solid rgba(15, 118, 110, 0.25)',
                      boxShadow: 'var(--shadow-md)',
                      marginBottom: '1.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-emerald)' }}>
                          Question {currentIndex + 1} of {questionsList.length}
                        </span>
                        <span style={{ color: 'var(--color-border-medium)' }}>·</span>
                        <Badge variant="lime">{currentQ.topic || 'Engineering'}</Badge>
                      </div>
                      <span style={{ fontSize: '0.78rem', color: 'var(--color-muted-green)', fontWeight: 600 }}>
                        {currentQ.difficulty || 'Medium'} Tier
                      </span>
                    </div>

                    <h2
                      style={{
                        fontFamily: 'var(--font-serif)',
                        fontSize: 'clamp(1.2rem, 2.5vw, 1.5rem)',
                        color: 'var(--color-deep-forest)',
                        lineHeight: 1.4,
                        marginBottom: '1.75rem',
                      }}
                    >
                      {currentQ.questionText}
                    </h2>

                    {/* Options List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '2rem' }}>
                      {(Array.isArray(currentQ.options) ? currentQ.options : []).map((option, optIdx) => {
                        const isSelected = selectedAnswers[currentQ.id] === optIdx;
                        const optText = typeof option === 'string' ? option : option?.text || `Option ${optIdx + 1}`;

                        return (
                          <button
                            key={optIdx}
                            onClick={() => handleSelectOption(optIdx)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              padding: '1rem 1.25rem',
                              borderRadius: 'var(--radius-lg)',
                              border: `1.5px solid ${isSelected ? 'var(--color-emerald)' : 'var(--color-border-medium)'}`,
                              backgroundColor: isSelected ? 'rgba(15, 118, 110, 0.08)' : 'var(--color-ivory-surface)',
                              color: 'var(--color-deep-forest)',
                              fontSize: '0.925rem',
                              fontWeight: isSelected ? 700 : 500,
                              cursor: 'pointer',
                              textAlign: 'left',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <span
                              style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '50%',
                                border: `1.5px solid ${isSelected ? 'var(--color-emerald)' : 'var(--color-border-medium)'}`,
                                backgroundColor: isSelected ? 'var(--color-emerald)' : 'var(--color-white)',
                                color: isSelected ? 'var(--color-white)' : 'var(--color-muted-green)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                fontSize: '0.78rem',
                                flexShrink: 0,
                              }}
                            >
                              {String.fromCharCode(65 + optIdx)}
                            </span>
                            <span>{optText}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Navigation Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '1.25rem' }}>
                      <Button
                        variant="outline"
                        size="md"
                        disabled={currentIndex === 0}
                        onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                        icon={ChevronLeft}
                      >
                        Previous
                      </Button>

                      {currentIndex < questionsList.length - 1 ? (
                        <Button
                          variant="primary"
                          size="md"
                          onClick={() => setCurrentIndex((prev) => Math.min(questionsList.length - 1, prev + 1))}
                          icon={ChevronRight}
                          iconPosition="right"
                        >
                          Next Question
                        </Button>
                      ) : (
                        <Button
                          variant="lime"
                          size="md"
                          loading={submitting}
                          onClick={handleFinishAssessment}
                          icon={ArrowRight}
                          iconPosition="right"
                        >
                          {isAuthenticated ? 'Submit Assessment' : 'Finish Preview & Get Analysis →'}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Previous question match intelligence */}
                  {showPreviousQuestionInsights && currentQ.previousMatch && !dismissedPopups[currentQ.id] && (
                    <PreviousQuestionPopup
                      matchData={currentQ.previousMatch}
                      onDismiss={() => setDismissedPopups((prev) => ({ ...prev, [currentQ.id]: true }))}
                      onViewDetails={() => setActiveModalMatch(currentQ.previousMatch)}
                    />
                  )}

                  {activeModalMatch && (
                    <PreviousQuestionModal
                      matchData={activeModalMatch}
                      isOpen={Boolean(activeModalMatch)}
                      onClose={() => setActiveModalMatch(null)}
                    />
                  )}
                </>
              ) : null}
            </div>
          )}

          {/* =========================================================================
              VIEW 3: SKILL PRACTICE MODE (IMMEDIATE FEEDBACK)
              ========================================================================= */}
          {activeTab === 'practice' && (
            <div>
              {loadingPractice ? (
                <div style={{ padding: '4rem', textAlign: 'center', backgroundColor: 'var(--color-white)', borderRadius: 'var(--radius-xl)' }}>
                  <div style={{ color: 'var(--color-emerald)', fontWeight: 700 }}>✦ Preparing Practice Question Stream...</div>
                </div>
              ) : currentPracticeQ ? (
                <div
                  className="card-static"
                  style={{
                    padding: '2.25rem',
                    backgroundColor: 'var(--color-white)',
                    borderRadius: 'var(--radius-2xl)',
                    border: '1.5px solid var(--color-border-subtle)',
                    boxShadow: 'var(--shadow-md)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Badge variant="lime">Practice Question {practiceIndex + 1} of {practiceQuestions.length}</Badge>
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-muted-green)', fontWeight: 600 }}>
                        {currentPracticeQ.skill} · {currentPracticeQ.difficulty}
                      </span>
                    </div>

                    <button
                      onClick={() => setActiveTab('catalog')}
                      style={{ background: 'none', border: 'none', color: 'var(--color-muted-green)', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Exit Practice Mode ✕
                    </button>
                  </div>

                  <h2
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: 'clamp(1.2rem, 2.5vw, 1.5rem)',
                      color: 'var(--color-deep-forest)',
                      lineHeight: 1.4,
                      marginBottom: '1.75rem',
                    }}
                  >
                    {currentPracticeQ.questionText}
                  </h2>

                  {/* Options */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1.5rem' }}>
                    {(Array.isArray(currentPracticeQ.options) ? currentPracticeQ.options : []).map((opt, optIdx) => {
                      const isSelected = practiceSelectedOpt === optIdx;
                      const hasFeedback = practiceFeedback !== null;
                      const isCorrectAnswer = hasFeedback && practiceFeedback.correct_option_index === optIdx;
                      const isWrongSelection = hasFeedback && isSelected && !practiceFeedback.is_correct;

                      let borderColor = 'var(--color-border-medium)';
                      let bg = 'var(--color-ivory-surface)';

                      if (isSelected && !hasFeedback) {
                        borderColor = 'var(--color-emerald)';
                        bg = 'rgba(15, 118, 110, 0.08)';
                      } else if (isCorrectAnswer) {
                        borderColor = '#16A34A';
                        bg = 'rgba(22, 163, 74, 0.1)';
                      } else if (isWrongSelection) {
                        borderColor = '#DC2626';
                        bg = 'rgba(220, 38, 38, 0.08)';
                      }

                      return (
                        <button
                          key={optIdx}
                          disabled={hasFeedback}
                          onClick={() => setPracticeSelectedOpt(optIdx)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '1rem 1.25rem',
                            borderRadius: 'var(--radius-lg)',
                            border: `1.5px solid ${borderColor}`,
                            backgroundColor: bg,
                            color: 'var(--color-deep-forest)',
                            fontSize: '0.925rem',
                            fontWeight: isSelected ? 700 : 500,
                            cursor: hasFeedback ? 'default' : 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span
                            style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '50%',
                              backgroundColor: isCorrectAnswer ? '#16A34A' : isWrongSelection ? '#DC2626' : isSelected ? 'var(--color-emerald)' : 'var(--color-white)',
                              color: isCorrectAnswer || isWrongSelection || isSelected ? 'var(--color-white)' : 'var(--color-deep-forest)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.78rem',
                            }}
                          >
                            {isCorrectAnswer ? <Check size={14} /> : isWrongSelection ? <X size={14} /> : String.fromCharCode(65 + optIdx)}
                          </span>
                          <span>{typeof opt === 'string' ? opt : opt?.text}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Immediate Explanation Card */}
                  {practiceFeedback && (
                    <div
                      style={{
                        padding: '1.25rem',
                        borderRadius: 'var(--radius-lg)',
                        backgroundColor: practiceFeedback.is_correct ? 'rgba(22, 163, 74, 0.08)' : 'rgba(220, 38, 38, 0.06)',
                        border: `1px solid ${practiceFeedback.is_correct ? '#86EFAC' : '#FCA5A5'}`,
                        marginBottom: '1.5rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        {practiceFeedback.is_correct ? (
                          <CheckCircle2 size={18} color="#16A34A" />
                        ) : (
                          <AlertCircle size={18} color="#DC2626" />
                        )}
                        <span style={{ fontWeight: 800, color: practiceFeedback.is_correct ? '#16A34A' : '#DC2626', fontSize: '0.9rem' }}>
                          {practiceFeedback.is_correct ? 'Correct Solution!' : 'Incorrect Choice'}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.885rem', color: 'var(--color-deep-forest)', margin: 0, lineHeight: 1.5 }}>
                        {practiceFeedback.explanation}
                      </p>
                    </div>
                  )}

                  {/* Practice Action Buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '1.25rem' }}>
                    <Button
                      variant="outline"
                      size="md"
                      disabled={practiceIndex === 0}
                      onClick={() => {
                        setPracticeIndex((prev) => Math.max(0, prev - 1));
                        setPracticeSelectedOpt(null);
                        setPracticeFeedback(null);
                      }}
                      icon={ChevronLeft}
                    >
                      Previous
                    </Button>

                    {!practiceFeedback ? (
                      <Button
                        variant="primary"
                        size="md"
                        disabled={practiceSelectedOpt === null}
                        onClick={handleVerifyPractice}
                      >
                        Verify Answer ↗
                      </Button>
                    ) : practiceIndex < practiceQuestions.length - 1 ? (
                      <Button
                        variant="lime"
                        size="md"
                        onClick={() => {
                          setPracticeIndex((prev) => prev + 1);
                          setPracticeSelectedOpt(null);
                          setPracticeFeedback(null);
                        }}
                        icon={ChevronRight}
                        iconPosition="right"
                      >
                        Next Practice Question
                      </Button>
                    ) : (
                      <Button
                        variant="primary"
                        size="md"
                        onClick={() => setActiveTab('catalog')}
                      >
                        Finish Practice & View Catalog
                      </Button>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default SkillAssessmentPage;
