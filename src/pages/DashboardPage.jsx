import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  TrendingUp,
  FileCheck2,
  Code2,
  FileText,
  Briefcase,
  HelpCircle,
  CheckCircle2,
  Clock,
  Layers,
  ChevronRight,
  Target,
  RefreshCw,
} from 'lucide-react';
import { Sidebar } from '../components/common/Sidebar';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { ProgressCircle } from '../components/common/ProgressCircle';
import { ProgressBar } from '../components/common/ProgressBar';
import { AIInsightCard } from '../components/shared/AIInsightCard';
import { LoadingState } from '../components/common/LoadingState';
import { NextSteps, ReadinessPanel, ScoreHistoryChart, StartHere } from '../components/dashboard/ReadinessPanel';
import { learningService } from '../services/learningService';
import { downloadFile } from '../utils/download';
import { useToast } from '../context/ToastContext';
import { RecommendationsCard } from '../components/learning/RecommendationsCard';
import { useAuth } from '../context/AuthContext';
import { studentService } from '../services/studentService';
import { api } from '../services/api';

const EmptyNote = ({ children }) => (
  <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-border-medium)', color: 'var(--color-charcoal-subtle)', fontSize: '0.875rem', textAlign: 'center' }}>
    {children}
  </div>
);

export const DashboardPage = () => {
  const { user, isAuthLoading } = useAuth();
  const [placements, setPlacements] = useState(null); // null = still loading
  const [questions, setQuestions] = useState(null);
  const [sideFailed, setSideFailed] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recs, setRecs] = useState(null);
  const [recsFailed, setRecsFailed] = useState(false);
  const [loadKey, setLoadKey] = useState(0); // bump to retry everything
  const { addToast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const downloadReport = async () => {
    setDownloading(true);
    try {
      await downloadFile('/student/report.pdf', 'skillsense-career-report.pdf');
      addToast('Your report was downloaded.', 'success');
    } catch (err) {
      addToast(err?.message || 'The report could not be downloaded. Please try again.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const fetchDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      setDashboardData(await studentService.getDashboard());
    } catch (err) {
      setError(err?.message || 'The dashboard could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecs = () => {
    setRecsFailed(false);
    learningService.getRecommendations().then(setRecs).catch(() => setRecsFailed(true));
  };

  useEffect(() => {
    fetchDashboard();
    fetchRecs();
  }, [user?.currentPath, loadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Real placement drives and previous questions (an empty list is shown as an empty state, never as sample data)
  useEffect(() => {
    if (isAuthLoading) return;
    let alive = true;
    setSideFailed(false);
    api.get('/placements').then((rows) => alive && setPlacements([...rows].sort((a, b) => (b.match_percentage || 0) - (a.match_percentage || 0)))).catch(() => alive && (setPlacements([]), setSideFailed(true)));
    api.get('/previous-questions').then((rows) => alive && setQuestions(rows)).catch(() => alive && (setQuestions([]), setSideFailed(true)));
    return () => { alive = false; };
  }, [isAuthLoading, loadKey]);

  const userName = user?.name ? user.name.split(' ')[0] : 'Student';
  const currentPath = dashboardData?.career_path || user?.currentPath || user?.careerInterest || '';
  // every number comes from the API (computed from this student's records); a new student gets zeros
  const readiness = dashboardData?.career_readiness ?? 0;
  const progress = dashboardData?.roadmap_progress ?? 0;
  const assessmentsCount = dashboardData?.assessments_completed ?? 0;
  const strengths = dashboardData?.strengths || [];
  const gaps = dashboardData?.skill_gaps || [];
  const parts = dashboardData?.readiness_parts || [];
  const isNew = dashboardData ? !dashboardData.has_data : false;
  const focusArea = gaps[0] || recs?.courses?.[0]?.title || '';

  return (
    <div className="dashboard-layout">
      <Sidebar />

      <main className="dashboard-main">
        <div className="dashboard-content animate-fade-in">
          {/* Welcome Header */}
          <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 'clamp(2rem, 3.5vw, 2.75rem)',
                  color: 'var(--color-deep-forest)',
                  margin: 0,
                  lineHeight: 1.15,
                }}
              >
                Good day, {userName}.
              </h1>
              <p
                style={{
                  fontSize: '1rem',
                  color: 'var(--color-charcoal-subtle)',
                  marginTop: '4px',
                  marginBottom: 0,
                }}
              >
                {currentPath ? <>Let's move your recruitment readiness forward on the <strong>{currentPath}</strong> track.</> : <>Choose a career path to get a roadmap and track your readiness.</>}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Button variant="outline" size="md" icon={FileText} onClick={downloadReport} loading={downloading} data-testid="download-report">
                Download report
              </Button>
              <Link to="/assessment">
                <Button variant="primary" size="md" icon={ArrowUpRight} iconPosition="right">
                  Take Assessment
                </Button>
              </Link>
              <Link to="/practice">
                <Button variant="lime" size="md" icon={Code2}>
                  Practice Coding
                </Button>
              </Link>
            </div>
          </div>

          {loading && !dashboardData && <LoadingState message="Loading your dashboard..." subtitle="One moment" />}
          {error && (
            <div role="alert" data-testid="dashboard-error" style={{ background: '#FEF2F2', border: '1.5px solid #F87171', borderRadius: 'var(--radius-xl)', padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', color: '#991B1B' }}>
              <span><strong>Your dashboard could not be loaded.</strong> {error}</span>
              <Button variant="outline" size="sm" icon={RefreshCw} onClick={() => setLoadKey((k) => k + 1)}>Try again</Button>
            </div>
          )}

          {dashboardData && <StartHere parts={parts} isNew={isNew} />}

          {/* =========================================================================
              4 TOP METRIC CARDS
              ========================================================================= */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1.25rem',
              marginBottom: '2rem',
            }}
          >
            {/* Card 1: Career Readiness */}
            <div
              className="card-floating"
              style={{
                padding: '1.5rem',
                backgroundColor: 'var(--color-white)',
                borderRadius: 'var(--radius-xl)',
                border: '1.5px solid rgba(15, 118, 110, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted-green)', letterSpacing: '0.04em' }}>
                  Career Readiness
                </div>
                <div data-testid="readiness-score" style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', color: 'var(--color-deep-forest)', lineHeight: 1.1, marginTop: '4px' }}>
                  {readiness}%
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-emerald)', fontWeight: 600, marginTop: '4px' }}>
                  {dashboardData?.has_data ? '✦ From your assessments, practice, resume and activity' : 'Nothing recorded yet: your score starts at 0'}
                </div>
              </div>
              <ProgressCircle value={readiness} size={64} strokeWidth={6} />
            </div>

            {/* Card 2: Current Career Path */}
            <div
              className="card-floating"
              style={{
                padding: '1.5rem',
                backgroundColor: 'var(--color-white)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted-green)', letterSpacing: '0.04em' }}>
                  Selected Career Path
                </div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.45rem', color: 'var(--color-deep-forest)', lineHeight: 1.2, marginTop: '4px' }}>
                  {currentPath || 'Not selected yet'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-muted-green)' }}>
                  {currentPath ? 'Active Pathway' : 'Pick one to get a roadmap'}
                </span>
                <Link to="/career-paths" style={{ fontSize: '0.8rem', color: 'var(--color-emerald)', fontWeight: 700 }}>
                  {currentPath ? 'Switch Path →' : 'Choose a Path →'}
                </Link>
              </div>
            </div>

            {/* Card 3: Skill Progress */}
            <div
              className="card-floating"
              style={{
                padding: '1.5rem',
                backgroundColor: 'var(--color-white)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted-green)', letterSpacing: '0.04em' }}>
                  Roadmap Progress
                </div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', color: 'var(--color-emerald)', lineHeight: 1.1, marginTop: '4px' }}>
                  {progress}%
                </div>
              </div>
              <div style={{ marginTop: '8px' }}>
                <ProgressBar value={progress} color="var(--color-emerald)" height="6px" />
                <div style={{ fontSize: '0.75rem', color: 'var(--color-muted-green)', marginTop: '4px' }}>
                  Roadmap milestones aligned
                </div>
              </div>
            </div>

            {/* Card 4: Assessments Completed */}
            <div
              className="card-floating"
              style={{
                padding: '1.5rem',
                backgroundColor: 'var(--color-white)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted-green)', letterSpacing: '0.04em' }}>
                  Assessments Completed
                </div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', color: 'var(--color-dark-emerald)', lineHeight: 1.1, marginTop: '4px' }}>
                  {assessmentsCount}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-emerald)', fontWeight: 600 }}>
                  Active Profile
                </span>
                <Link to="/assessment" style={{ fontSize: '0.8rem', color: 'var(--color-emerald)', fontWeight: 700 }}>
                  Take Next →
                </Link>
              </div>
            </div>
          </div>

          {/* =========================================================================
              AI INSIGHT & QUESTION INTELLIGENCE GRID
              ========================================================================= */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '1.5rem',
              marginBottom: '2.5rem',
            }}
          >
            {/* Section 9: AI Insight Card */}
            <AIInsightCard
              headline={strengths.length ? `You're strong in ${strengths.slice(0, 2).join(' and ')}.` : 'Take your first assessment to see your strengths.'}
              gap={gaps[0] || 'Take an assessment to find your skill gaps'}
              recommendation={currentPath ? `${currentPath} — Priority Skill Practice` : 'Choose a career path to get a roadmap'}
              actionText="View Adaptive Roadmap →"
              actionLink="/roadmap"
            />

            {/* Question Intelligence Card */}
            <div
              className="card-floating"
              style={{
                padding: '1.5rem 1.75rem',
                backgroundColor: 'var(--color-white)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid rgba(199, 243, 107, 0.6)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                boxShadow: '0 8px 24px -4px rgba(6, 46, 37, 0.08)',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '20px',
                        height: '20px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: 'var(--color-lime-soft)',
                        color: 'var(--color-deep-forest)',
                        fontSize: '0.75rem',
                      }}
                    >
                      ✦
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: 'var(--color-deep-forest)',
                      }}
                    >
                      Question Intelligence
                    </span>
                  </div>

                  <Badge variant="lime">Placement Database</Badge>
                </div>

                <h3
                  style={{
                    fontSize: '1.35rem',
                    fontFamily: 'var(--font-serif)',
                    color: 'var(--color-deep-forest)',
                    lineHeight: 1.25,
                    marginBottom: '0.75rem',
                  }}
                >
                  Real placement questions, searchable
                </h3>

                <p style={{ fontSize: '0.885rem', color: 'var(--color-charcoal-subtle)', marginBottom: '1.25rem' }}>
                  See which questions repeat across company assessments and practise them.
                </p>

                <div
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-ivory-surface)',
                    border: '1px solid var(--color-border-subtle)',
                    marginBottom: '1.25rem',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-muted-green)', fontWeight: 600 }}>
                    Top priority focus area:
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-deep-forest)', marginTop: '2px' }}>
                    {focusArea || 'Take an assessment to find your focus area'}
                  </div>
                </div>
              </div>

              <div>
                <Link to="/previous-questions">
                  <Button variant="lime" size="sm" icon={ArrowRight} iconPosition="right">
                    Explore Previous Questions →
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {dashboardData && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
              <ReadinessPanel overall={readiness} parts={parts} streak={dashboardData.streak_days || 0} activeDays={dashboardData.active_days_14 || 0} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0 }}>
                <ScoreHistoryChart history={dashboardData.score_history || []} />
                <NextSteps recs={recs} failed={recsFailed} onRetry={fetchRecs} />
              </div>
            </div>
          )}

          {/* Recommended courses and the 4-week study plan, from this student's own data */}
          <div style={{ marginBottom: '2rem' }}>
            <RecommendationsCard shared={{ data: recs, failed: recsFailed, retry: fetchRecs }} />
          </div>

          {/* =========================================================================
              QUICK PRACTICE & PLACEMENT MATCHES
              ========================================================================= */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {/* Target Placement Matches */}
            <div
              className="card-static"
              style={{
                padding: '1.75rem',
                backgroundColor: 'var(--color-white)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: 'var(--color-deep-forest)', margin: 0 }}>
                  High-Match Placement Drives
                </h3>
                <Link to="/placement-tracker" style={{ fontSize: '0.825rem', color: 'var(--color-emerald)', fontWeight: 700 }}>
                  View All →
                </Link>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {placements !== null && placements.length === 0 && <EmptyNote>{sideFailed ? 'Placement drives could not be loaded.' : 'No placement drives are open right now.'}</EmptyNote>}
                {(placements ?? []).slice(0, 3).map((job) => (
                  <Link
                    key={job.id}
                    to="/placement-tracker"
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-ivory-surface)',
                      border: '1px solid var(--color-border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      textDecoration: 'none',
                      transition: 'transform 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-lime-soft)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-ivory-surface)')}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.925rem', color: 'var(--color-deep-forest)' }}>
                        {job.company} — {job.role}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-muted-green)', marginTop: '2px' }}>
                        {[job.package, job.status].filter(Boolean).join(' · ')}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: 800,
                          color: 'var(--color-emerald)',
                        }}
                      >
                        {job.match_percentage ?? 0}% Match
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Recommended Questions to Practice */}
            <div
              className="card-static"
              style={{
                padding: '1.75rem',
                backgroundColor: 'var(--color-white)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: 'var(--color-deep-forest)', margin: 0 }}>
                  Recommended Placement Problems
                </h3>
                <Link to="/practice" style={{ fontSize: '0.825rem', color: 'var(--color-emerald)', fontWeight: 700 }}>
                  Open IDE →
                </Link>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {questions !== null && questions.length === 0 && <EmptyNote>{sideFailed ? 'Previous questions could not be loaded.' : 'No previous questions have been published yet.'}</EmptyNote>}
                {(questions ?? []).slice(0, 3).map((q) => (
                  <Link
                    key={q.id}
                    to={q.problem_slug ? `/practice?problem=${q.problem_slug}` : '/previous-questions'}
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-ivory-surface)',
                      border: '1px solid var(--color-border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      textDecoration: 'none',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-lime-soft)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-ivory-surface)')}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.925rem', color: 'var(--color-deep-forest)' }}>
                        {q.title}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-emerald)', marginTop: '2px' }}>
                        {[q.exam_origin, q.topic].filter(Boolean).join(' · ')}
                      </div>
                    </div>

                    <Badge variant="lime" size="sm">
                      {q.difficulty}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
