import React from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../../components/common/Navbar';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Sparkles, ArrowRight, ShieldCheck, Target, Layers, Brain, Award } from 'lucide-react';

export const AboutPage = () => {
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
              Platform Mission & Synopsis
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
            Bridging the Gap Between Engineering Education and Industry Hiring
          </h1>

          <p style={{ fontSize: '1.1rem', color: 'var(--color-charcoal-subtle)', lineHeight: 1.6, margin: 0 }}>
            SkillSense AI was designed to eliminate the guesswork from college placements through adaptive diagnostic assessments, historical question paper vectorization, and data-driven career roadmaps.
          </p>
        </div>

        {/* Pillars Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1.75rem',
            marginBottom: '4rem',
          }}
        >
          <div
            className="card-static"
            style={{
              padding: '2rem',
              backgroundColor: 'var(--color-white)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: 'var(--color-lime-soft)', color: 'var(--color-deep-forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, marginBottom: '1rem', fontSize: '1.1rem' }}>
              01
            </div>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', color: 'var(--color-deep-forest)', margin: '0 0 0.5rem 0' }}>
              Diagnostic Competency Mapping
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-charcoal-subtle)', lineHeight: 1.6 }}>
              Rather than generic tests, SkillSense assesses practical skills, problem-solving capability, and technical precision to identify true competency levels.
            </p>
          </div>

          <div
            className="card-static"
            style={{
              padding: '2rem',
              backgroundColor: 'var(--color-white)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: 'var(--color-lime-soft)', color: 'var(--color-deep-forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, marginBottom: '1rem', fontSize: '1.1rem' }}>
              02
            </div>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', color: 'var(--color-deep-forest)', margin: '0 0 0.5rem 0' }}>
              Question Paper Intelligence
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-charcoal-subtle)', lineHeight: 1.6 }}>
              Our proprietary question paper engine extracts, cleans, and clusters historical placement exam questions (TCS, Infosys, Accenture) to highlight recurring patterns.
            </p>
          </div>

          <div
            className="card-static"
            style={{
              padding: '2rem',
              backgroundColor: 'var(--color-white)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: 'var(--color-lime-soft)', color: 'var(--color-deep-forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, marginBottom: '1rem', fontSize: '1.1rem' }}>
              03
            </div>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.4rem', color: 'var(--color-deep-forest)', margin: '0 0 0.5rem 0' }}>
              Actionable Winding Roadmaps
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-charcoal-subtle)', lineHeight: 1.6 }}>
              Students receive a dynamic 10-checkpoint learning journey that focuses specifically on closing their individual gaps to achieve placement readiness.
            </p>
          </div>
        </div>

        {/* Project Authorship & Synopsis Section */}
        <div
          className="card-static"
          style={{
            padding: '2.5rem',
            backgroundColor: 'var(--color-white)',
            borderRadius: 'var(--radius-2xl)',
            border: '1.5px solid rgba(15, 118, 110, 0.25)',
            boxShadow: 'var(--shadow-lg)',
            textAlign: 'center',
            maxWidth: '720px',
            margin: '0 auto',
          }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '0.75rem' }}>
            <Sparkles size={16} color="var(--color-emerald)" />
            <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-emerald)' }}>
              Project Synopsis & Authorship
            </span>
          </div>

          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', color: 'var(--color-deep-forest)', margin: '0 0 0.5rem 0' }}>
            SkillSense AI Research Platform
          </h2>

          <p style={{ fontSize: '0.925rem', color: 'var(--color-charcoal-subtle)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            Developed as a Major Project Synopsis for advanced automated placement intelligence and personalized technical career development.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link to="/career-paths">
              <Button variant="primary" size="md" icon={ArrowRight} iconPosition="right">
                Explore Platform Features
              </Button>
            </Link>
            <Link to="/signup">
              <Button variant="lime" size="md">
                Create Free Student Account
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
};
