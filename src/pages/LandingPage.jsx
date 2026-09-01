import React from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  TrendingUp,
  Brain,
  Layers,
  Compass,
  FileCheck2,
  FileSpreadsheet,
  Award,
  ShieldCheck,
} from 'lucide-react';
import { Navbar } from '../components/common/Navbar';
import { Button } from '../components/common/Button';
import { mockCareerPaths } from '../data/mockCareerPaths';
import { mockTopicFrequencies } from '../data/mockPreviousQuestions';
import { mockQuestionPaperStats } from '../data/mockQuestionPapers';
import { SkillSenseCore3D } from '../components/three/SkillSenseCore3D';
import { QuestionNetwork3D } from '../components/three/QuestionNetwork3D';

export const LandingPage = () => {
  const orbitalSkills = [
    { name: 'Python', top: '12%', left: '15%', delay: '0s' },
    { name: 'Java', top: '18%', right: '12%', delay: '1s' },
    { name: 'React', bottom: '22%', left: '10%', delay: '2s' },
    { name: 'DSA', bottom: '15%', right: '18%', delay: '1.5s' },
    { name: 'AI', top: '48%', left: '4%', delay: '0.8s' },
    { name: 'SQL', top: '52%', right: '6%', delay: '2.2s' },
    { name: 'Cloud', top: '5%', left: '50%', delay: '1.2s' },
    { name: 'MongoDB', bottom: '8%', left: '45%', delay: '2.5s' },
  ];

  return (
    <div style={{ backgroundColor: 'var(--color-warm-ivory)', minHeight: '100vh', overflowX: 'hidden' }}>
      <Navbar />

      {/* =========================================================================
          HERO SECTION with AI Core Visualization & Floating Career Readiness Card
          ========================================================================= */}
      <section style={{ padding: '4.5rem 0 3.5rem', position: 'relative' }}>
        <div className="container-custom" style={{ textAlign: 'center', position: 'relative', zIndex: 2 }}>
          {/* Badge */}
          <div
            className="animate-fade-in"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--color-white)',
              border: '1px solid rgba(15, 118, 110, 0.2)',
              borderRadius: 'var(--radius-full)',
              padding: '6px 16px',
              boxShadow: 'var(--shadow-sm)',
              marginBottom: '1.75rem',
            }}
          >
            <span style={{ color: 'var(--color-emerald)', fontSize: '0.85rem' }}>✦</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-deep-forest)' }}>
              Next-Gen Skill Assessment & Career Intelligence
            </span>
          </div>

          {/* Editorial Headline */}
          <h1
            className="animate-fade-in"
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(2.75rem, 6.5vw, 4.75rem)',
              color: 'var(--color-deep-forest)',
              maxWidth: '920px',
              margin: '0 auto 1.25rem',
              lineHeight: 1.08,
              letterSpacing: '-0.025em',
            }}
          >
            Turn your skills into your career.
          </h1>

          {/* Subtitle */}
          <p
            className="animate-fade-in"
            style={{
              fontSize: 'clamp(1.05rem, 2vw, 1.25rem)',
              color: 'var(--color-charcoal-subtle)',
              maxWidth: '680px',
              margin: '0 auto 2.25rem',
              lineHeight: 1.6,
            }}
          >
            SkillSense AI analyzes your competencies, pinpoints your critical skill gaps, and architects a personalized winding roadmap tailored to placement success.
          </p>

          {/* CTA Buttons */}
          <div
            className="animate-fade-in"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              flexWrap: 'wrap',
              marginBottom: '3.5rem',
            }}
          >
            <Link to="/assessment">
              <Button variant="primary" size="lg" icon={ArrowUpRight} iconPosition="right">
                Start Free Assessment
              </Button>
            </Link>
            <Link to="/career-paths">
              <Button variant="outline-emerald" size="lg">
                Explore Career Paths
              </Button>
            </Link>
          </div>

          {/* =========================================================================
              Priority 1: 3D SkillSense AI Core Visualization & Floating Nodes
              ========================================================================= */}
          <div
            style={{
              position: 'relative',
              maxWidth: '920px',
              margin: '0 auto',
              padding: '1rem 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '480px',
            }}
          >
            {/* Ambient Background Glow */}
            <div
              style={{
                position: 'absolute',
                width: '460px',
                height: '460px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(199, 243, 107, 0.45) 0%, rgba(15, 118, 110, 0.18) 50%, transparent 75%)',
                filter: 'blur(50px)',
                zIndex: 0,
                pointerEvents: 'none',
              }}
            />

            {/* 3D Three.js SkillSense AI Core */}
            <div style={{ width: '100%', height: '480px', position: 'relative', zIndex: 1 }}>
              <SkillSenseCore3D />
            </div>

            {/* Master Reference: Career Readiness 87% Floating Card */}
            <div
              className="animate-float"
              style={{
                position: 'absolute',
                bottom: '12px',
                right: '4%',
                zIndex: 4,
                backgroundColor: 'var(--color-white)',
                border: '1.5px solid rgba(15, 118, 110, 0.3)',
                borderRadius: 'var(--radius-xl)',
                padding: '1.15rem 1.4rem',
                boxShadow: '0 18px 36px -6px rgba(6, 46, 37, 0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--color-lime-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-deep-forest)',
                  fontSize: '1.15rem',
                  fontWeight: 900,
                }}
              >
                ✦
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted-green)', letterSpacing: '0.04em' }}>
                  Career Readiness
                </div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.65rem', color: 'var(--color-deep-forest)', lineHeight: 1.1 }}>
                  87%
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-emerald)', fontWeight: 600 }}>
                  Ready for TCS & Infosys
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          STATISTICS SECTION (Clean metric cards)
          ========================================================================= */}
      <section style={{ padding: '2rem 0 4rem' }}>
        <div className="container-custom">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1.25rem',
            }}
          >
            <div
              className="card-floating"
              style={{
                padding: '1.75rem',
                backgroundColor: 'var(--color-white)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-border-subtle)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '2.75rem', color: 'var(--color-deep-forest)', lineHeight: 1 }}>
                46
              </div>
              <div style={{ fontSize: '0.925rem', fontWeight: 600, color: 'var(--color-charcoal-subtle)', marginTop: '6px' }}>
                Question Papers
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-muted-green)', marginTop: '2px' }}>
                TCS, Infosys, Accenture & more
              </div>
            </div>

            <div
              className="card-floating"
              style={{
                padding: '1.75rem',
                backgroundColor: 'var(--color-white)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-border-subtle)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '2.75rem', color: 'var(--color-emerald)', lineHeight: 1 }}>
                2,840
              </div>
              <div style={{ fontSize: '0.925rem', fontWeight: 600, color: 'var(--color-charcoal-subtle)', marginTop: '6px' }}>
                Questions Extracted
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-muted-green)', marginTop: '2px' }}>
                Indexed with similarity vectors
              </div>
            </div>

            <div
              className="card-floating"
              style={{
                padding: '1.75rem',
                backgroundColor: 'var(--color-white)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-border-subtle)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '2.75rem', color: 'var(--color-deep-forest)', lineHeight: 1 }}>
                18
              </div>
              <div style={{ fontSize: '0.925rem', fontWeight: 600, color: 'var(--color-charcoal-subtle)', marginTop: '6px' }}>
                Top Tech Companies
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-muted-green)', marginTop: '2px' }}>
                Campus & off-campus drives
              </div>
            </div>

            <div
              className="card-floating"
              style={{
                padding: '1.75rem',
                backgroundColor: 'var(--color-white)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-border-subtle)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '2.75rem', color: 'var(--color-dark-emerald)', lineHeight: 1 }}>
                367
              </div>
              <div style={{ fontSize: '0.925rem', fontWeight: 600, color: 'var(--color-charcoal-subtle)', marginTop: '6px' }}>
                Repeated Questions
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-muted-green)', marginTop: '2px' }}>
                High-priority placement patterns
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          CAREER PATHS PREVIEW SECTION
          ========================================================================= */}
      <section style={{ padding: '4rem 0', backgroundColor: 'var(--color-ivory-surface)' }}>
        <div className="container-custom">
          <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 3rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--color-emerald)' }}>✦</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-emerald)' }}>
                Target Career Tracks
              </span>
            </div>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', color: 'var(--color-deep-forest)', margin: '0 0 0.75rem 0' }}>
              Built for high-growth tech roles
            </h2>
            <p style={{ fontSize: '1rem', color: 'var(--color-charcoal-subtle)' }}>
              Choose your target career path and receive real-time skill matching against corporate hiring benchmarks.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {mockCareerPaths.slice(0, 3).map((path) => (
              <div
                key={path.id}
                className="card-floating"
                style={{
                  padding: '2rem',
                  backgroundColor: 'var(--color-white)',
                  borderRadius: 'var(--radius-xl)',
                  border: '1px solid var(--color-border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.45rem', color: 'var(--color-deep-forest)', margin: 0 }}>
                      {path.title}
                    </h3>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: 'var(--color-lime-soft)',
                        color: 'var(--color-deep-forest)',
                        fontSize: '0.8rem',
                        fontWeight: 800,
                      }}
                    >
                      {path.matchScore}% Match
                    </span>
                  </div>

                  <p style={{ fontSize: '0.885rem', color: 'var(--color-charcoal-subtle)', lineHeight: 1.55, marginBottom: '1.25rem' }}>
                    {path.description}
                  </p>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '1.5rem' }}>
                    {path.skills.map((s) => (
                      <span
                        key={s}
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          backgroundColor: 'var(--color-ivory-surface)',
                          border: '1px solid var(--color-border-medium)',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                          color: 'var(--color-deep-forest)',
                        }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-muted-green)' }}>
                    Avg Package: <strong style={{ color: 'var(--color-deep-forest)' }}>{path.avgSalary}</strong>
                  </span>
                  <Link to="/career-paths">
                    <Button variant="outline-emerald" size="sm" icon={ArrowRight} iconPosition="right">
                      View Track
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
            <Link to="/career-paths">
              <Button variant="primary" size="md" icon={ArrowUpRight} iconPosition="right">
                Explore All 6 Career Paths
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================================================
          QUESTION INTELLIGENCE SHOWCASE
          ========================================================================= */}
      <section style={{ padding: '4.5rem 0' }}>
        <div className="container-custom">
          <div
            style={{
              backgroundColor: 'var(--color-deep-forest)',
              borderRadius: 'var(--radius-2xl)',
              padding: '3.5rem 2.5rem',
              color: 'var(--color-warm-ivory)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '2.5rem',
              alignItems: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Background Glow */}
            <div
              style={{
                position: 'absolute',
                top: '-50%',
                right: '-20%',
                width: '400px',
                height: '400px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(199, 243, 107, 0.18) 0%, transparent 70%)',
                pointerEvents: 'none',
              }}
            />

            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '0.75rem' }}>
                <span style={{ color: 'var(--color-lime)' }}>✦</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-lime)' }}>
                  Question Paper Intelligence
                </span>
              </div>
              <h2
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '2.4rem',
                  color: 'var(--color-warm-ivory)',
                  margin: '0 0 1rem 0',
                  lineHeight: 1.15,
                }}
              >
                Know which questions repeat before your placement exam
              </h2>
              <p style={{ fontSize: '0.975rem', color: 'var(--color-lime-soft)', opacity: 0.9, lineHeight: 1.6, marginBottom: '2rem' }}>
                SkillSense AI analyzes previous placement papers to identify recurring questions, high-frequency topics, and company-specific patterns—helping students prepare for the questions that matter most.
              </p>

              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <Link to="/previous-questions">
                  <Button variant="lime" size="md" icon={ArrowRight} iconPosition="right">
                    Browse Previous Questions →
                  </Button>
                </Link>
                <Link to="/company-prep">
                  <Button variant="outline" size="md" style={{ color: 'var(--color-warm-ivory)', borderColor: 'rgba(255,255,255,0.25)' }}>
                    Explore Company Insights
                  </Button>
                </Link>
              </div>
            </div>

            {/* 3D Question Intelligence Network & Highlighted Card */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div
                style={{
                  backgroundColor: 'rgba(6, 46, 37, 0.6)',
                  borderRadius: 'var(--radius-xl)',
                  border: '1px solid rgba(199, 243, 107, 0.25)',
                  overflow: 'hidden',
                }}
              >
                <QuestionNetwork3D />
              </div>

              {/* Highlighted Mock Intelligence Data */}
              <div
                style={{
                  backgroundColor: 'var(--color-white)',
                  borderRadius: 'var(--radius-xl)',
                  padding: '1.5rem',
                  color: 'var(--color-deep-forest)',
                  boxShadow: 'var(--shadow-xl)',
                  border: '1.5px solid rgba(199, 243, 107, 0.4)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-emerald)', textTransform: 'uppercase' }}>
                    ✦ Sample Intelligence Match
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, backgroundColor: 'var(--color-lime-soft)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                    94% Historical Similarity
                  </span>
                </div>

                <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', margin: '0 0 0.5rem 0' }}>
                  Two Sum (Array Traversal)
                </h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-charcoal-subtle)', marginBottom: '0.75rem' }}>
                  Appeared in TCS NQT 2025, Infosys Online Test 2024, and Accenture Coding Round 2026.
                </p>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'var(--color-ivory-surface)', border: '1px solid var(--color-border-subtle)' }}>
                    Topic: Arrays
                  </span>
                  <span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '4px', backgroundColor: 'var(--color-ivory-surface)', border: '1px solid var(--color-border-subtle)' }}>
                    Difficulty: Medium
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          Section 23: FINAL CTA BANNER
          ========================================================================= */}
      <section style={{ padding: '3.5rem 0 5rem' }}>
        <div className="container-custom">
          <div
            className="card-static"
            style={{
              backgroundColor: 'var(--color-deep-forest)',
              borderRadius: 'var(--radius-2xl)',
              padding: '3.5rem 2.5rem',
              color: 'var(--color-white)',
              textAlign: 'center',
              boxShadow: 'var(--shadow-xl)',
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(2rem, 4vw, 2.85rem)',
                color: 'var(--color-white)',
                margin: '0 0 0.75rem 0',
              }}
            >
              Ready to build your career path?
            </h2>
            <p
              style={{
                fontSize: '1.05rem',
                color: 'var(--color-lime-soft)',
                maxWidth: '560px',
                margin: '0 auto 2rem',
                lineHeight: 1.55,
              }}
            >
              Explore SkillSense AI freely, and create an account when you're ready to personalize your journey.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <Link to="/signup">
                <Button variant="lime" size="lg" icon={ArrowRight} iconPosition="right">
                  Create Free Account →
                </Button>
              </Link>
              <Link to="/career-paths">
                <Button variant="outline" size="lg" style={{ borderColor: 'rgba(255,255,255,0.3)', color: 'var(--color-white)' }}>
                  Explore Career Paths
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          FOOTER
          ========================================================================= */}
      <footer style={{ borderTop: '1px solid var(--color-border-subtle)', padding: '3rem 0 2rem', backgroundColor: 'var(--color-white)' }}>
        <div className="container-custom">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--color-deep-forest)',
                  color: 'var(--color-lime)',
                  fontSize: '0.9rem',
                }}
              >
                ✦
              </span>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', color: 'var(--color-deep-forest)' }}>
                SkillSense AI
              </span>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem', color: 'var(--color-charcoal-subtle)' }}>
              <Link to="/career-paths">Career Paths</Link>
              <Link to="/roadmap">Roadmap</Link>
              <Link to="/previous-questions">Previous Questions</Link>
              <Link to="/company-prep">Company Prep</Link>
              <Link to="/dashboard">Dashboard</Link>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', fontSize: '0.78rem', color: 'var(--color-muted-green)' }}>
            <div>© 2026 SkillSense AI Platform. All rights reserved.</div>
            <div>Designed for College Placements & Technical Career Development.</div>
          </div>
        </div>
      </footer>
    </div>
  );
};
