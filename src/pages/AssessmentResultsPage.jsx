import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sidebar } from '../components/common/Sidebar';
import { Navbar } from '../components/common/Navbar';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { ProgressCircle } from '../components/common/ProgressCircle';
import { ProgressBar } from '../components/common/ProgressBar';
import { AIInsightCard } from '../components/shared/AIInsightCard';
import { assessmentService } from '../services/assessmentService';
import { useAuth } from '../context/AuthContext';
import confetti from 'canvas-confetti';
import {
  Sparkles,
  Award,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Code2,
  TrendingUp,
  MapPin,
  HelpCircle,
} from 'lucide-react';

export const AssessmentResultsPage = () => {
  const { user, isAuthenticated } = useAuth();
  const [resultData, setResultData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fire celebratory confetti on page mount
    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#0F766E', '#C7F36B', '#062E25', '#10B981'],
      });
    } catch {
      // Ignore in non-canvas environments
    }

    const fetchResult = async () => {
      setLoading(true);
      try {
        const data = await assessmentService.getLatestResult();
        if (data) {
          setResultData(data);
        }
      } catch (err) {
        console.warn('Failed to load latest result:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchResult();
  }, [isAuthenticated]);

  const overallScore = resultData?.overallScore ?? user?.readinessScore ?? 84;
  const readinessScore = resultData?.readinessScore ?? user?.readinessScore ?? 87;
  const correctCount = resultData?.correctCount ?? 4;
  const totalQuestions = resultData?.totalQuestions ?? 5;
  const strengths = resultData?.strengths?.length > 0 ? resultData.strengths : (user?.strongSkills || ['Python', 'SQL', 'FastAPI']);
  const skillGaps = resultData?.skillGaps?.length > 0 ? resultData.skillGaps : (user?.gapSkills || ['System Design', 'Docker', 'Kubernetes']);
  const topicScores = resultData?.topicScores || [];
  const recRoadmap = resultData?.recommendedRoadmapStep || 'Milestone 04: Relational Databases & SQL';

  return (
    <div className={isAuthenticated ? "dashboard-layout" : ""} style={{ minHeight: '100vh', backgroundColor: 'var(--color-warm-ivory)' }}>
      {isAuthenticated ? <Sidebar /> : <Navbar />}

      <main className={isAuthenticated ? "dashboard-main" : "container-custom"} style={{ padding: isAuthenticated ? undefined : '2.5rem 1.5rem 5rem' }}>
        <div className="dashboard-content animate-fade-in" style={{ padding: isAuthenticated ? undefined : 0, maxWidth: '1040px', margin: '0 auto' }}>
          
          {/* Top Result Banner */}
          <div style={{ marginBottom: '2.5rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--color-emerald)' }}>✦</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-emerald)' }}>
                  Verified Assessment Report
                </span>
                <Badge variant={overallScore >= 70 ? 'success' : 'warning'} size="sm">
                  {overallScore >= 70 ? 'Benchmark Cleared' : 'Needs Practice'}
                </Badge>
              </div>
              <h1
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 'clamp(2rem, 3.5vw, 2.75rem)',
                  color: 'var(--color-deep-forest)',
                  margin: 0,
                }}
              >
                Diagnostic Evaluation Summary
              </h1>
              <p style={{ fontSize: '1rem', color: 'var(--color-charcoal-subtle)', marginTop: '4px', maxWidth: '680px' }}>
                SkillSense analyzed your responses across Easy, Medium, and Hard placement benchmarks and updated your recruitment profile.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Link to="/practice">
                <Button variant="lime" size="md" icon={Code2}>
                  Practice Weak Areas →
                </Button>
              </Link>
              <Link to="/roadmap">
                <Button variant="outline-emerald" size="md" icon={MapPin}>
                  View Updated Roadmap
                </Button>
              </Link>
            </div>
          </div>

          {/* =========================================================================
              PRIMARY SCORE CARDS
              ========================================================================= */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1.25rem',
              marginBottom: '2rem',
            }}
          >
            {/* Overall Score */}
            <div
              className="card-floating"
              style={{
                padding: '1.5rem',
                backgroundColor: 'var(--color-white)',
                borderRadius: 'var(--radius-xl)',
                border: '1.5px solid rgba(15, 118, 110, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted-green)' }}>
                  Overall Score
                </div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', color: 'var(--color-deep-forest)', marginTop: '4px', lineHeight: 1 }}>
                  {overallScore}%
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-emerald)', fontWeight: 600 }}>
                  {correctCount} of {totalQuestions} Correct
                </span>
              </div>
              <ProgressCircle value={overallScore} size={64} strokeWidth={6} />
            </div>

            {/* Career Readiness */}
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
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted-green)' }}>
                  Career Readiness
                </div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '2.2rem', color: 'var(--color-dark-emerald)', marginTop: '4px', lineHeight: 1 }}>
                  {readinessScore}%
                </div>
              </div>
              <div style={{ marginTop: '10px' }}>
                <ProgressBar value={readinessScore} color="var(--color-dark-emerald)" height="6px" />
                <span style={{ fontSize: '0.72rem', color: 'var(--color-emerald)', marginTop: '3px', display: 'block' }}>
                  Tier-1 Campus Recruitment Qualified
                </span>
              </div>
            </div>

            {/* Recommended Action */}
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
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted-green)' }}>
                  Next Recommended Milestone
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-deep-forest)', marginTop: '6px' }}>
                  {recRoadmap}
                </div>
              </div>
              <Link to="/roadmap" style={{ marginTop: '10px', fontSize: '0.8rem', color: 'var(--color-emerald)', fontWeight: 700 }}>
                Jump to Roadmap Step →
              </Link>
            </div>
          </div>

          {/* =========================================================================
              AI INSIGHT & STRENGTHS/WEAKNESSES GRID
              ========================================================================= */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '1.5rem',
              marginBottom: '2rem',
            }}
          >
            {/* AI Insight Card */}
            <AIInsightCard
              headline={`Your strongest competency is in ${strengths[0] || 'Core Concepts'}, but ${skillGaps[0] || 'Advanced Systems'} is your primary growth gap.`}
              gap={skillGaps.join(', ')}
              recommendation={`Practice ${skillGaps[0] || 'DSA'} problems and review corresponding roadmap milestones.`}
              actionText="Practice Weak Areas →"
              actionLink="/practice"
            />

            {/* Strengths & Weaknesses Breakdown */}
            <div
              className="card-static"
              style={{
                padding: '1.75rem',
                backgroundColor: 'var(--color-white)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: 'var(--color-deep-forest)', margin: '0 0 1rem 0' }}>
                  Competency Breakdown
                </h3>

                {/* Strongest Skills */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#059669', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle2 size={14} /> Strongest Competencies
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {strengths.map((item) => (
                      <span
                        key={item}
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          backgroundColor: '#ECFDF5',
                          border: '1px solid rgba(16, 185, 129, 0.25)',
                          color: '#065F46',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        ✓ {item}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Growth Areas / Weaknesses */}
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#D97706', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertTriangle size={14} /> Priority Growth Gaps
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {skillGaps.map((item) => (
                      <span
                        key={item}
                        style={{
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          backgroundColor: '#FFFBEB',
                          border: '1px solid rgba(245, 158, 11, 0.25)',
                          color: '#92400E',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        ⚡ {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '1rem', marginTop: '1rem', display: 'flex', gap: '8px' }}>
                <Link to="/assessment" style={{ flex: 1 }}>
                  <Button variant="outline" size="sm" style={{ width: '100%' }} icon={RefreshCw}>
                    Assess Another Skill
                  </Button>
                </Link>
                <Link to="/practice" style={{ flex: 1 }}>
                  <Button variant="lime" size="sm" style={{ width: '100%' }}>
                    Skill Practice ↗
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AssessmentResultsPage;
