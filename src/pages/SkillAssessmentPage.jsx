import React, { useState, useEffect, useRef } from 'react';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Sidebar } from '../components/common/Sidebar';
import { Navbar } from '../components/common/Navbar';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { PreviousQuestionPopup } from '../components/shared/PreviousQuestionPopup';
import { PreviousQuestionModal } from '../components/shared/PreviousQuestionModal';
import { assessmentService } from '../services/assessmentService';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { QuestionBody } from '../components/learning/QuestionBody';
import { COMPANIES } from '../services/learningService';
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

const ACTIVE_KEY = 'skillsense.activeAssessment'; // the open session's assessment id, so a refresh reopens the same session
const readActive = () => { try { return sessionStorage.getItem(ACTIVE_KEY); } catch { return null; } };
const writeActive = (id) => { try { if (id) sessionStorage.setItem(ACTIVE_KEY, id); else sessionStorage.removeItem(ACTIVE_KEY); } catch { /* storage blocked: a refresh then returns to the catalog */ } };

export const SkillAssessmentPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAuthenticated, requireAuth, updateUserProfile } = useAuth();
  const { showPreviousQuestionInsights } = useSettings();
  const { addToast } = useToast();

  // Mode: 'catalog' | 'testing' | 'practice'
  const [activeTab, setActiveTab] = useState('catalog');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [selectedCompany, setSelectedCompany] = useState('All'); // pattern-inspired practice style, practice mode only
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
  const [timeLeft, setTimeLeft] = useState(0);
  const [session, setSession] = useState(null); // { sessionId, assessmentId, title, difficulty, expiresAt }
  const [sessionProblem, setSessionProblem] = useState(null); // 'expired' | 'submitted' | 'failed'
  const [problemText, setProblemText] = useState('');
  const deadlineRef = useRef(0);
  const autoSubmitRef = useRef(false);
  const finishRef = useRef(null);
  const [dismissedPopups, setDismissedPopups] = useState({});
  const [activeModalMatch, setActiveModalMatch] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Skill Practice Mode State
  const [practiceQuestions, setPracticeQuestions] = useState([]);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceSelectedOpt, setPracticeSelectedOpt] = useState(null);
  const [practiceFeedback, setPracticeFeedback] = useState(null);
  const [loadingPractice, setLoadingPractice] = useState(false);
  const [practiceError, setPracticeError] = useState('');

  const careerTitle = user?.currentPath || '';
  const [loadError, setLoadError] = useState('');

  // Fetch Assessment Catalog
  const fetchCatalog = async () => {
    setLoadingCatalog(true);
    setLoadError('');
    try {
      const data = await assessmentService.getAssessments(careerTitle, selectedDifficulty, selectedSkill);
      setAssessmentsList(data || []);
    } catch (err) {
      setLoadError(err?.message || 'Please try again.');
    } finally {
      setLoadingCatalog(false);
    }
  };

  useEffect(() => {
    fetchCatalog();
  }, [careerTitle, selectedDifficulty, selectedSkill]);

  // Countdown to the deadline the server set (seconds_remaining at start, so the browser clock does not matter); submits itself at zero
  useEffect(() => {
    if (activeTab !== 'testing' || !session || sessionProblem) return undefined;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setTimeLeft(left);
      if (left === 0 && !autoSubmitRef.current) {
        autoSubmitRef.current = true;
        finishRef.current?.(true);
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeTab, session, sessionProblem]);

  // Open a session (or reopen the unexpired one: same questions, saved answers, same deadline)
  const beginSession = async (asm) => {
    setLoadingTest(true);
    setActiveAssessment(asm);
    setActiveTab('testing');
    setSessionProblem(null);
    setCurrentIndex(0);
    autoSubmitRef.current = false;
    try {
      const started = await assessmentService.startSession(asm.id);
      if (!started.questions.length) throw new Error('This assessment has no questions yet.');
      deadlineRef.current = Date.now() + started.secondsRemaining * 1000;
      setTimeLeft(started.secondsRemaining);
      setSession(started);
      setQuestionsList(started.questions);
      setSelectedAnswers(started.answers);
      const firstOpen = started.questions.findIndex((q) => started.answers[q.id] === undefined);
      setCurrentIndex(firstOpen === -1 ? 0 : firstOpen); // carry on at the first unanswered question
      writeActive(asm.id);
      if (started.resumed) addToast('Welcome back. Your answers and the timer were restored.', 'info');
    } catch (err) {
      writeActive(null);
      setSession(null);
      addToast(err.message || 'Could not start this assessment. Please try again.', 'error');
      setActiveTab('catalog');
      setActiveAssessment(null);
    } finally {
      setLoadingTest(false);
    }
  };

  const handleStartAssessment = (asm) => {
    requireAuth(() => beginSession(asm), '/assessment'); // a timed session belongs to a signed-in student
  };

  // Come back to the open session after a refresh, or open the set a link points at (?start=asm-id)
  useEffect(() => {
    if (!isAuthenticated) return;
    const wanted = searchParams.get('start') || readActive();
    if (!wanted) return;
    if (searchParams.get('start')) setSearchParams({}, { replace: true });
    beginSession({ id: wanted });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Start Practice Mode
  const handleStartPracticeMode = () => requireAuth(startPracticeMode, '/assessment');

  const startPracticeMode = async () => {
    setActiveTab('practice');
    setPracticeError('');
    setLoadingPractice(true);
    setPracticeIndex(0);
    setPracticeSelectedOpt(null);
    setPracticeFeedback(null);

    try {
      const questions = await assessmentService.getPracticeQuestions(
        selectedSkill !== 'All' ? selectedSkill : null,
        selectedDifficulty !== 'All' ? selectedDifficulty : null,
        null,
        selectedCompany !== 'All' ? selectedCompany : null
      );
      setPracticeQuestions(questions || []);
    } catch (err) {
      setPracticeQuestions([]);
      setPracticeError(err?.message || 'Please try again.');
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
    if (!currentQ || !session) return;
    const next = { ...selectedAnswers, [currentQ.id]: optIdx };
    setSelectedAnswers(next);
    assessmentService.saveAnswers(session.sessionId, next).catch((err) => {
      // a network hiccup is fine (the final submit carries every answer); a finished session is not
      if (err?.status === 410 || err?.status === 404) { setSessionProblem('expired'); setProblemText(err.message); }
      if (err?.status === 409) { setSessionProblem('submitted'); setProblemText(err.message); }
    });
  };

  const handleFinishAssessment = async (timeIsUp = false) => {
    if (!session) {
      addToast('Pick an assessment to submit.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await assessmentService.submitSession(session.sessionId, session.assessmentId, selectedAnswers);
      writeActive(null);
      addToast(timeIsUp === true ? 'Time is up. Your answers were submitted.' : 'Assessment submitted. Your results are ready.', 'success');
      navigate('/assessment-results');
    } catch (err) {
      // Nothing was recorded unless the server said so: never pretend a failed submit worked or show a made-up score.
      if (err?.status === 409) {
        writeActive(null);
        setSessionProblem('submitted');
        setProblemText(err.message);
      } else if (err?.status === 410 || err?.status === 404) {
        writeActive(null);
        setSessionProblem('expired');
        setProblemText(err.message);
      } else {
        addToast(err?.message ? `Your assessment could not be submitted: ${err.message}` : 'Your assessment could not be submitted. Please try again.', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };
  finishRef.current = handleFinishAssessment;

  const leaveSession = () => {
    writeActive(null);
    setSession(null);
    setSessionProblem(null);
    setQuestionsList([]);
    setSelectedAnswers({});
    setActiveAssessment(null);
    setActiveTab('catalog');
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
          {loadError && <ErrorBanner title="Assessments could not be loaded." message={loadError} onRetry={fetchCatalog} />}
          
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
                    <option value="C">C</option>
                    <option value="C++">C++</option>
                    <option value="Python">Python</option>
                    <option value="JavaScript">JavaScript</option>
                    <option value="React">React</option>
                    <option value="Java">Java</option>
                    <option value="SQL & Databases">SQL & Databases</option>
                    <option value="DSA">DSA / Algorithms</option>
                    <option value="Machine Learning">Machine Learning</option>
                    <option value="Deep Learning & AI">Deep Learning & AI</option>
                    <option value="AI / Machine Learning">AI / Machine Learning</option>
                    <option value="Cloud / DevOps">Cloud / DevOps</option>
                  </select>
                </div>

                {/* Company style (practice mode): original questions in a company's style, not real past questions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.825rem', fontWeight: 800, color: 'var(--color-deep-forest)', textTransform: 'uppercase' }}>
                    Practice style:
                  </span>
                  <select
                    aria-label="Practice style"
                    data-testid="practice-style"
                    value={selectedCompany}
                    onChange={(e) => setSelectedCompany(e.target.value)}
                    title="Pattern-inspired practice: original questions in the style of a company's online tests. Not real past questions."
                    style={{ padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-medium)', backgroundColor: 'var(--color-white)', color: 'var(--color-deep-forest)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
                  >
                    <option value="All">Any style</option>
                    {COMPANIES.map((c) => <option key={c} value={c}>{c}-style</option>)}
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
              ) : sessionProblem ? (
                <div
                  role="alert"
                  data-testid="session-problem"
                  className="card-static"
                  style={{ padding: '2.5rem', textAlign: 'center', backgroundColor: 'var(--color-white)', borderRadius: 'var(--radius-2xl)', border: '1.5px solid #FCA5A5' }}
                >
                  <AlertCircle size={36} color="#B91C1C" />
                  <h2 style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-deep-forest)', margin: '0.75rem 0 0.5rem' }}>
                    {sessionProblem === 'submitted' ? 'This assessment was already submitted' : 'This session has expired'}
                  </h2>
                  <p style={{ color: 'var(--color-charcoal-subtle)', maxWidth: '520px', margin: '0 auto 1.5rem' }}>
                    {sessionProblem === 'submitted'
                      ? 'Your answers were scored the first time. A session can only be submitted once.'
                      : 'The time for this session ran out, so it could not be scored.'}
                    {problemText ? ` (${problemText})` : ''}
                  </p>
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    {sessionProblem === 'submitted' && (
                      <Link to="/assessment-results"><Button variant="primary" size="md">View my results</Button></Link>
                    )}
                    <Button variant={sessionProblem === 'submitted' ? 'outline' : 'primary'} size="md" onClick={leaveSession}>
                      Back to the catalog
                    </Button>
                  </div>
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
                        {activeAssessment?.skill ? `${activeAssessment.skill} · ` : ''}{session?.difficulty || activeAssessment?.difficulty || 'Medium'}
                      </div>
                      <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', color: 'var(--color-deep-forest)' }}>
                        {session?.title || activeAssessment?.title || 'Formal Diagnostic Assessment'}
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
                      data-testid="assessment-timer"
                      aria-live="off"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        backgroundColor: 'var(--color-ivory-surface)',
                        padding: '6px 14px',
                        borderRadius: 'var(--radius-full)',
                        border: '1px solid var(--color-border-subtle)',
                        color: timeLeft <= 60 ? '#B91C1C' : 'var(--color-deep-forest)',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                      }}
                    >
                      <Clock size={16} color={timeLeft <= 60 ? '#B91C1C' : 'var(--color-emerald)'} />
                      <span>{formatTimer(timeLeft)}</span>
                      <span style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--color-charcoal-subtle)' }} data-testid="answered-count">
                        · {Object.keys(selectedAnswers).length}/{questionsList.length} answered
                      </span>
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

                    <QuestionBody
                      question={currentQ}
                      headingStyle={{
                        fontFamily: 'var(--font-serif)',
                        fontSize: 'clamp(1.2rem, 2.5vw, 1.5rem)',
                        color: 'var(--color-deep-forest)',
                        lineHeight: 1.4,
                        marginBottom: '1.75rem',
                      }}
                    />

                    {/* Options List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '2rem' }}>
                      {(Array.isArray(currentQ.options) ? currentQ.options : []).map((option, optIdx) => {
                        const isSelected = selectedAnswers[currentQ.id] === optIdx;
                        const optText = typeof option === 'string' ? option : option?.text || `Option ${optIdx + 1}`;

                        return (
                          <button
                            key={optIdx}
                            data-testid="assessment-option" onClick={() => handleSelectOption(optIdx)}
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
                            <span style={{ whiteSpace: "pre-wrap" }}>{optText}</span>
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
                          onClick={() => handleFinishAssessment()}
                          icon={ArrowRight}
                          iconPosition="right"
                          data-testid="submit-assessment"
                        >
                          Submit Assessment
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
              ) : practiceError ? (
                <ErrorBanner title="Practice questions could not be loaded." message={practiceError} onRetry={startPracticeMode} />
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

                  <QuestionBody
                    question={currentPracticeQ}
                    headingStyle={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: 'clamp(1.2rem, 2.5vw, 1.5rem)',
                      color: 'var(--color-deep-forest)',
                      lineHeight: 1.4,
                      marginBottom: '1.75rem',
                    }}
                  />

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
                          <span style={{ whiteSpace: 'pre-wrap' }}>{typeof opt === 'string' ? opt : opt?.text}</span>
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
              ) : (
                <div className="card-static" style={{ padding: '2rem', textAlign: 'center', backgroundColor: 'var(--color-white)', borderRadius: 'var(--radius-xl)', color: 'var(--color-deep-forest)' }}>
                  No practice questions match these filters. Change the domain, difficulty or practice style and try again.
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default SkillAssessmentPage;
