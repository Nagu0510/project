import React from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../../components/common/Navbar';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { useAuth } from '../../context/AuthContext';
import { SkillNetwork3D } from '../../components/three/SkillNetwork3D';
import {
  Sparkles,
  Compass,
  MapPin,
  FileCheck2,
  Code2,
  FileText,
  Briefcase,
  HelpCircle,
  Building2,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';

export const FeaturesPage = () => {
  const { requireAuth } = useAuth();

  const featureList = [
    {
      id: 'career-paths',
      icon: Compass,
      title: 'AI Career Path Architect',
      tag: 'Specialization Matching',
      desc: 'Evaluate your technical competencies against industry roles (Frontend, Backend, AI/ML, Cloud) with real-time skill matching algorithms.',
      link: '/career-paths',
      cta: 'Explore Career Tracks',
    },
    {
      id: 'roadmap',
      icon: MapPin,
      title: 'Interactive Winding-Road Roadmap',
      tag: 'Step-by-Step Milestones',
      desc: 'A 10-milestone progressive curriculum connecting foundational concepts, data structures, and company-specific preparation checkpoints.',
      link: '/roadmap',
      cta: 'Preview Roadmaps',
    },
    {
      id: 'assessment',
      icon: FileCheck2,
      title: 'Skill Assessment Engine',
      tag: 'Diagnostic Testing',
      desc: 'Adaptive technical evaluation with timed multi-topic quizzes, question jumping, and integrated historical exam matches.',
      link: '/assessment',
      cta: 'Preview Sample Quiz',
    },
    {
      id: 'practice',
      icon: Code2,
      title: 'Coding Practice IDE',
      tag: 'Interactive Compiler',
      desc: 'Multi-language coding studio (Java, Python, JS) with automated test cases, execution runtime stats, and real-time AI complexity advice.',
      link: '/practice',
      cta: 'Open Coding IDE',
    },
    {
      id: 'resume',
      icon: FileText,
      title: 'Resume & ATS Intelligence',
      tag: 'Instant Gap Analysis',
      desc: 'Upload PDF/DOCX resumes for instant parsing, 0-100 ATS scoring, verified skill tagging, and missing requirement alerts.',
      link: '/resume-analyzer',
      cta: 'View Sample Analysis',
    },
    {
      id: 'placements',
      icon: Briefcase,
      title: 'Placement Opportunity Matcher',
      tag: 'Campus & Off-Campus',
      desc: 'Real-time candidate compatibility matching against recruitment drives from TCS, Infosys, Accenture, Amazon, and Capgemini.',
      link: '/placement-tracker',
      cta: 'Browse Opportunities',
    },
    {
      id: 'previous-questions',
      icon: HelpCircle,
      title: 'Placement Question Intelligence',
      tag: 'Cross-Company Archive',
      desc: 'Search 2,840+ verified placement questions with recurrence frequency badges, similarity indicators, and company filters.',
      link: '/previous-questions',
      cta: 'Explore Question Bank',
    },
    {
      id: 'company-prep',
      icon: Building2,
      title: 'Company Preparation Intelligence',
      tag: 'Topic Weightage Models',
      desc: 'Deep analytics on paper topic distributions (DSA, Aptitude, SQL) and your candidate skill readiness score for top IT recruiters.',
      link: '/company-prep/tcs',
      cta: 'View Company Models',
    },
  ];

  return (
    <div style={{ backgroundColor: 'var(--color-warm-ivory)', minHeight: '100vh', overflowX: 'hidden' }}>
      <Navbar />

      <main className="container-custom" style={{ padding: '3.5rem 1.5rem 5rem' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', maxWidth: '780px', margin: '0 auto 3.5rem' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--color-white)',
              border: '1px solid rgba(15, 118, 110, 0.2)',
              borderRadius: 'var(--radius-full)',
              padding: '5px 14px',
              boxShadow: 'var(--shadow-sm)',
              marginBottom: '1.25rem',
            }}
          >
            <span style={{ color: 'var(--color-emerald)', fontSize: '0.85rem' }}>✦</span>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-deep-forest)', letterSpacing: '0.04em' }}>
              Platform Architecture Overview
            </span>
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(2.4rem, 5vw, 3.75rem)',
              color: 'var(--color-deep-forest)',
              lineHeight: 1.12,
              margin: '0 0 1rem 0',
            }}
          >
            Intelligence Modules Engineered for Student Employability
          </h1>

          <p style={{ fontSize: '1.1rem', color: 'var(--color-charcoal-subtle)', lineHeight: 1.6, margin: 0 }}>
            Explore how SkillSense AI combines diagnostic skill evaluation, cross-company placement intelligence, and structured learning roadmaps.
          </p>
        </div>

        {/* Priority 3: 3D Interconnected Skill Network Showcase */}
        <div
          className="card-static"
          style={{
            padding: '1.5rem',
            backgroundColor: 'var(--color-white)',
            borderRadius: 'var(--radius-2xl)',
            border: '1.5px solid rgba(15, 118, 110, 0.25)',
            boxShadow: 'var(--shadow-lg)',
            marginBottom: '3.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '2rem',
          }}
        >
          <div style={{ maxWidth: '420px', padding: '1rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '0.4rem' }}>
              <Sparkles size={16} color="var(--color-emerald)" />
              <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-emerald)', letterSpacing: '0.04em' }}>
                Adaptive Skill Constellation
              </span>
            </div>

            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', color: 'var(--color-deep-forest)', margin: '0 0 0.75rem 0' }}>
              Real-time Skill Gap Triangulation
            </h2>

            <p style={{ fontSize: '0.925rem', color: 'var(--color-charcoal-subtle)', lineHeight: 1.6, margin: 0 }}>
              SkillSense measures your verified technical proficiencies (Python, SQL, DSA) against corporate hiring standards and highlights missing pre-requisites (System Design, Docker).
            </p>
          </div>

          <div style={{ flex: 1, minWidth: '320px', height: '340px' }}>
            <SkillNetwork3D />
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.75rem',
            marginBottom: '4rem',
          }}
        >
          {featureList.map((feat) => {
            const Icon = feat.icon;

            return (
              <div
                key={feat.id}
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                    <div
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '12px',
                        backgroundColor: 'var(--color-ivory-surface)',
                        border: '1px solid var(--color-border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--color-emerald)',
                      }}
                    >
                      <Icon size={22} />
                    </div>
                    <Badge variant="lime">{feat.tag}</Badge>
                  </div>

                  <h3
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: '1.5rem',
                      color: 'var(--color-deep-forest)',
                      margin: '0 0 0.5rem 0',
                    }}
                  >
                    {feat.title}
                  </h3>

                  <p
                    style={{
                      fontSize: '0.9rem',
                      color: 'var(--color-charcoal-subtle)',
                      lineHeight: 1.6,
                      marginBottom: '1.5rem',
                    }}
                  >
                    {feat.desc}
                  </p>
                </div>

                <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '1rem' }}>
                  <Link to={feat.link} style={{ textDecoration: 'none' }}>
                    <Button variant="outline-emerald" size="sm" style={{ width: '100%' }} icon={ArrowRight} iconPosition="right">
                      {feat.cta}
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA Banner */}
        <div
          className="card-static"
          style={{
            backgroundColor: 'var(--color-deep-forest)',
            borderRadius: 'var(--radius-2xl)',
            padding: '3rem 2.5rem',
            color: 'var(--color-white)',
            textAlign: 'center',
            boxShadow: 'var(--shadow-xl)',
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(2rem, 4vw, 2.75rem)',
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
      </main>
    </div>
  );
};
