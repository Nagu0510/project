import React, { useState, useEffect } from 'react';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { Link, useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/common/Sidebar';
import { Navbar } from '../components/common/Navbar';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingState } from '../components/common/LoadingState';
import { ProgressCircle } from '../components/common/ProgressCircle';
import { ProgressBar } from '../components/common/ProgressBar';
import { QuestionBody } from '../components/learning/QuestionBody';
import { assessmentService } from '../services/assessmentService';
import { useAuth } from '../context/AuthContext';
import confetti from 'canvas-confetti';
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Code2,
  MapPin,
  BookOpen,
  ArrowRight,
  Check,
  X,
  Clock,
} from 'lucide-react';

// One look per band; the label is always written out, colour is never the only signal.
const BAND = {
  strong: { label: 'Strong', note: '80% and above', color: '#047857', bg: '#ECFDF5', border: 'rgba(16, 185, 129, 0.35)' },
  developing: { label: 'Developing', note: '60-79%', color: '#92400E', bg: '#FFFBEB', border: 'rgba(245, 158, 11, 0.4)' },
  gap: { label: 'Gap', note: 'under 60%', color: '#991B1B', bg: '#FEF2F2', border: 'rgba(248, 113, 113, 0.5)' },
};

const formatDuration = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

const stepLink = (step) => {
  if (step.kind === 'course') return { to: `/courses/${step.course_slug}`, label: 'Open the course', icon: BookOpen };
  if (step.kind === 'assessment') return { to: `/assessment?start=${step.assessment_id}`, label: 'Start this assessment', icon: ArrowRight };
  return { to: '/roadmap', label: 'Open the roadmap', icon: MapPin };
};

const cardStyle = { backgroundColor: 'var(--color-white)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border-subtle)' };

export const AssessmentResultsPage = () => {
  const { isAuthenticated, isAuthLoading } = useAuth();
  const navigate = useNavigate();
  const [resultData, setResultData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [onlyWrong, setOnlyWrong] = useState(false);

  useEffect(() => {
    if (isAuthLoading) return;
    const fetchResult = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const data = await assessmentService.getLatestResult(); // null = 404 = nothing taken yet
        setResultData(data);
        if (data && data.overallScore >= 70) { // celebrate a result that earned it
          try {
            confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ['#0F766E', '#C7F36B', '#062E25', '#10B981'] });
          } catch {
            // Ignore in non-canvas environments
          }
        }
      } catch (err) {
        setLoadError(err?.message || 'Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchResult();
  }, [isAuthenticated, isAuthLoading, reloadKey]);

  if (loading || !resultData) {
    return (
      <div className={isAuthenticated ? 'dashboard-layout' : ''} style={{ minHeight: '100vh', backgroundColor: 'var(--color-warm-ivory)' }}>
        {isAuthenticated ? <Sidebar /> : <Navbar />}
        <main className={isAuthenticated ? 'dashboard-main' : 'container-custom'} style={{ padding: isAuthenticated ? undefined : '2.5rem 1.5rem 5rem' }}>
          <div className="dashboard-content" style={{ padding: isAuthenticated ? undefined : 0, maxWidth: '1040px', margin: '0 auto' }}>
            {loadError && <ErrorBanner title="Your results could not be loaded." message={loadError} onRetry={() => setReloadKey((k) => k + 1)} />}
            {loading ? (
              <LoadingState message="Loading your latest assessment..." subtitle="One moment" />
            ) : !loadError && (
              <EmptyState
                title="No assessment taken yet"
                description={isAuthenticated ? 'Take your first assessment and your score, topic bands, skill gaps and answer review will appear here.' : 'Sign in and take a skill assessment to see your results here.'}
                actionText={isAuthenticated ? 'Take your first assessment' : 'Sign in'}
                onAction={() => navigate(isAuthenticated ? '/assessment' : '/login')}
              />
            )}
          </div>
        </main>
      </div>
    );
  }

  const { overallScore, correctCount, totalQuestions, topicScores, gapTopics, nextSteps, review } = resultData;
  const counts = { strong: 0, developing: 0, gap: 0 };
  topicScores.forEach((t) => { counts[t.band] += 1; });
  const shown = onlyWrong ? review.filter((r) => !r.isCorrect) : review;

  return (
    <div className={isAuthenticated ? 'dashboard-layout' : ''} style={{ minHeight: '100vh', backgroundColor: 'var(--color-warm-ivory)' }}>
      {isAuthenticated ? <Sidebar /> : <Navbar />}

      <main className={isAuthenticated ? 'dashboard-main' : 'container-custom'} style={{ padding: isAuthenticated ? undefined : '2.5rem 1.5rem 5rem' }}>
        <div className="dashboard-content animate-fade-in" style={{ padding: isAuthenticated ? undefined : 0, maxWidth: '1040px', margin: '0 auto' }}>

          {/* Header */}
          <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-emerald)' }}>
                  Assessment report
                </span>
                <Badge variant={overallScore >= 70 ? 'success' : 'warning'} size="sm">
                  {overallScore >= 70 ? 'Passed (70% or more)' : 'Below the 70% pass mark'}
                </Badge>
              </div>
              <h1 data-testid="result-title" style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(1.8rem, 3.5vw, 2.5rem)', color: 'var(--color-deep-forest)', margin: 0 }}>
                {resultData.assessmentTitle}
              </h1>
              {resultData.submittedAt && (
                <p style={{ fontSize: '0.9rem', color: 'var(--color-charcoal-subtle)', marginTop: '4px' }}>
                  Submitted {new Date(`${resultData.submittedAt}Z`).toLocaleString()}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Link to="/roadmap"><Button variant="outline-emerald" size="md" icon={MapPin}>View roadmap</Button></Link>
              <Link to="/assessment"><Button variant="lime" size="md" icon={RefreshCw}>Take another assessment</Button></Link>
            </div>
          </div>

          {/* Score cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
            <div className="card-floating" style={{ ...cardStyle, padding: '1.5rem', border: '1.5px solid rgba(15, 118, 110, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted-green)' }}>Score</div>
                <div data-testid="overall-score" style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', color: 'var(--color-deep-forest)', marginTop: '4px', lineHeight: 1 }}>
                  {overallScore}%
                </div>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-emerald)', fontWeight: 600 }}>{correctCount} of {totalQuestions} correct</span>
              </div>
              <ProgressCircle value={overallScore} size={64} strokeWidth={6} />
            </div>

            <div className="card-floating" style={{ ...cardStyle, padding: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted-green)' }}>Topic bands</div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                {['strong', 'developing', 'gap'].map((b) => (
                  <span key={b} style={{ fontSize: '0.8rem', fontWeight: 700, color: BAND[b].color, background: BAND[b].bg, border: `1px solid ${BAND[b].border}`, padding: '3px 9px', borderRadius: 'var(--radius-sm)' }}>
                    {counts[b]} {BAND[b].label.toLowerCase()}
                  </span>
                ))}
              </div>
            </div>

            <div className="card-floating" style={{ ...cardStyle, padding: '1.5rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted-green)' }}>Time taken</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', color: 'var(--color-deep-forest)', fontFamily: 'var(--font-serif)', fontSize: '2rem', lineHeight: 1 }}>
                <Clock size={22} color="var(--color-emerald)" /> {formatDuration(resultData.timeTakenSeconds)}
              </div>
            </div>
          </div>

          {/* Topic bands */}
          <div className="card-static" data-testid="topic-bands" style={{ ...cardStyle, padding: '1.75rem', marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: 'var(--color-deep-forest)', margin: '0 0 0.25rem' }}>Score by topic</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-charcoal-subtle)', margin: '0 0 1.25rem' }}>
              Gap is under 60%, developing is 60-79%, strong is 80% and above.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {topicScores.map((t) => (
                <div key={t.topic} data-testid="topic-row" data-band={t.band}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '5px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, color: 'var(--color-deep-forest)', fontSize: '0.92rem' }}>{t.topic}</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: BAND[t.band].color, background: BAND[t.band].bg, border: `1px solid ${BAND[t.band].border}`, padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}>
                      {BAND[t.band].label} · {t.score}% ({t.total} {t.total === 1 ? 'question' : 'questions'})
                    </span>
                  </div>
                  <ProgressBar value={t.score} color={BAND[t.band].color} height="8px" />
                </div>
              ))}
            </div>
          </div>

          {/* Gap list + next steps */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            <div className="card-static" data-testid="gap-list" style={{ ...cardStyle, padding: '1.75rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: 'var(--color-deep-forest)', margin: '0 0 1rem' }}>
                <AlertTriangle size={18} color="#B45309" style={{ verticalAlign: '-3px', marginRight: '6px' }} />Your gap topics
              </h2>
              {gapTopics.length === 0 ? (
                <p style={{ margin: 0, color: 'var(--color-deep-forest)', fontSize: '0.92rem' }}>
                  <CheckCircle2 size={16} color="#047857" style={{ verticalAlign: '-3px', marginRight: '6px' }} />
                  No gap topics. Every topic in this assessment is at 60% or higher.
                </p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {gapTopics.map((t) => (
                    <span key={t} style={{ fontSize: '0.85rem', fontWeight: 700, color: BAND.gap.color, background: BAND.gap.bg, border: `1px solid ${BAND.gap.border}`, padding: '4px 10px', borderRadius: 'var(--radius-sm)' }}>
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="card-static" data-testid="next-steps" style={{ ...cardStyle, padding: '1.75rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: 'var(--color-deep-forest)', margin: '0 0 1rem' }}>
                <Code2 size={18} color="var(--color-emerald)" style={{ verticalAlign: '-3px', marginRight: '6px' }} />Next steps
              </h2>
              {nextSteps.length === 0 ? (
                <p style={{ margin: 0, color: 'var(--color-charcoal-subtle)', fontSize: '0.92rem' }}>
                  Choose a career path to see roadmap steps, or take another assessment.
                </p>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {nextSteps.map((step) => {
                    const link = stepLink(step);
                    return (
                      <li key={`${step.kind}-${step.title}`} data-testid="next-step" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--color-deep-forest)', fontSize: '0.92rem' }}>{step.title}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-charcoal-subtle)' }}>{step.reason}</div>
                        </div>
                        <Link to={link.to}><Button variant="outline-emerald" size="sm" icon={link.icon} iconPosition="right">{link.label}</Button></Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Review: your answer against the correct one, with the explanation */}
          <div className="card-static" data-testid="review" style={{ ...cardStyle, padding: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: 'var(--color-deep-forest)', margin: 0 }}>Review your answers</h2>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', color: 'var(--color-deep-forest)', fontWeight: 600, cursor: 'pointer' }}>
                <input type="checkbox" checked={onlyWrong} onChange={(e) => setOnlyWrong(e.target.checked)} data-testid="only-wrong" />
                Show only the ones I got wrong
              </label>
            </div>

            {shown.length === 0 && <p style={{ margin: 0, color: 'var(--color-deep-forest)' }}>You got every question right.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {shown.map((item) => (
                <div key={item.questionId} data-testid="review-item" data-correct={item.isCorrect} style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '1.25rem' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
                    <Badge variant={item.isCorrect ? 'success' : 'warning'} size="sm">
                      Question {item.number} · {item.isCorrect ? 'Correct' : item.yourAnswerIndex === null ? 'Not answered' : 'Incorrect'}
                    </Badge>
                    {item.topic && <span style={{ fontSize: '0.78rem', color: 'var(--color-muted-green)', fontWeight: 600 }}>{item.topic}</span>}
                  </div>
                  <QuestionBody
                    question={item}
                    headingStyle={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', color: 'var(--color-deep-forest)', lineHeight: 1.4, margin: '0 0 1rem' }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1rem' }}>
                    {item.options.map((opt, i) => {
                      const isCorrect = i === item.correctIndex;
                      const isYours = i === item.yourAnswerIndex;
                      const look = isCorrect ? BAND.strong : isYours ? BAND.gap : null;
                      return (
                        <div
                          key={i}
                          data-testid={isCorrect ? 'review-correct' : isYours ? 'review-yours' : 'review-option'}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '10px', padding: '0.7rem 1rem', borderRadius: 'var(--radius-lg)',
                            border: `1.5px solid ${look ? look.border : 'var(--color-border-medium)'}`,
                            background: look ? look.bg : 'var(--color-ivory-surface)', color: look ? look.color : 'var(--color-deep-forest)',
                            fontWeight: look ? 700 : 500, fontSize: '0.9rem',
                          }}
                        >
                          <span style={{ width: '22px', height: '22px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '0.75rem', border: '1.5px solid currentColor' }}>
                            {isCorrect ? <Check size={13} /> : isYours ? <X size={13} /> : String.fromCharCode(65 + i)}
                          </span>
                          <span style={{ whiteSpace: 'pre-wrap', flex: 1 }}>{opt}</span>
                          {isCorrect && <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>Correct answer</span>}
                          {isYours && !isCorrect && <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>Your answer</span>}
                          {isYours && isCorrect && <span style={{ fontSize: '0.75rem', fontWeight: 800 }}>(your answer)</span>}
                        </div>
                      );
                    })}
                  </div>
                  {item.explanation && (
                    <p style={{ margin: 0, padding: '0.9rem 1rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-ivory-surface)', color: 'var(--color-deep-forest)', fontSize: '0.9rem', lineHeight: 1.55 }}>
                      <strong>Why: </strong>{item.explanation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AssessmentResultsPage;
