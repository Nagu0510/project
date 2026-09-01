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
import { useAuth } from '../context/AuthContext';
import { studentService } from '../services/studentService';
import { mockPlacementJobs } from '../data/mockPlacementJobs';
import { mockPreviousQuestionsList } from '../data/mockPreviousQuestions';

export const DashboardPage = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const data = await studentService.getDashboard();
      if (data) {
        setDashboardData(data);
      }
    } catch (err) {
      console.warn('Dashboard fetch notice:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [user?.currentPath]);

  const userName = user?.name ? user.name.split(' ')[0] : 'Student';
  const currentPath = dashboardData?.career_path || user?.currentPath || user?.careerInterest || 'Backend Developer';
  const readiness = dashboardData?.career_readiness ?? user?.readinessScore ?? 87;
  const progress = dashboardData?.roadmap_progress ?? user?.skillProgress ?? 74;
  const assessmentsCount = dashboardData?.assessments_completed ?? user?.assessmentsCompleted ?? 1;
  const strengths = dashboardData?.strengths || user?.strongSkills || ['Python', 'SQL', 'FastAPI'];
  const gaps = dashboardData?.skill_gaps || user?.gapSkills || ['System Design', 'Docker', 'Kubernetes'];

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
                Let's move your recruitment readiness forward on the <strong>{currentPath}</strong> track.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
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
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', color: 'var(--color-deep-forest)', lineHeight: 1.1, marginTop: '4px' }}>
                  {readiness}%
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--color-emerald)', fontWeight: 600, marginTop: '4px' }}>
                  ✦ Top 12% Candidate
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
                  {currentPath}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-muted-green)' }}>
                  Active Pathway
                </span>
                <Link to="/career-paths" style={{ fontSize: '0.8rem', color: 'var(--color-emerald)', fontWeight: 700 }}>
                  Switch Path →
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
              headline={`You're strong in ${strengths.slice(0, 2).join(' and ')}.`}
              gap={gaps[0] || 'System Design & Architecture'}
              recommendation={`${currentPath} — Priority Skill Practice`}
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
                  2,840 previous questions analyzed
                </h3>

                <p style={{ fontSize: '0.885rem', color: 'var(--color-charcoal-subtle)', marginBottom: '1.25rem' }}>
                  <strong style={{ color: 'var(--color-emerald)' }}>367 frequently repeated</strong> across TCS, Infosys, Accenture and Cognizant assessments.
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
                    {gaps[0] || 'DSA & Problem Solving'}
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
                {mockPlacementJobs.slice(0, 3).map((job) => (
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
                        {job.package} · {job.status}
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
                        {job.matchPercentage}% Match
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
                {mockPreviousQuestionsList.slice(0, 3).map((q) => (
                  <Link
                    key={q.id}
                    to={`/practice?problem=${q.problemSlug}`}
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
                        {q.examOrigin} · {q.topic}
                      </div>
                    </div>

                    <Badge variant={q.badgeType === 'lime' ? 'lime' : 'emerald'} size="sm">
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
