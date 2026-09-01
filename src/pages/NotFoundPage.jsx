import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { ArrowLeft, Home, Sparkles } from 'lucide-react';

export const NotFoundPage = () => {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-warm-ivory)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.5rem',
        textAlign: 'center',
      }}
    >
      <div
        className="card-static animate-scale-in"
        style={{
          width: '100%',
          maxWidth: '520px',
          backgroundColor: 'var(--color-white)',
          borderRadius: 'var(--radius-2xl)',
          padding: '3rem 2rem',
          border: '1px solid var(--color-border-subtle)',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--color-lime-soft)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-deep-forest)',
            fontSize: '1.75rem',
            margin: '0 auto 1.5rem',
          }}
        >
          ✦
        </div>

        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '4.5rem', color: 'var(--color-emerald)', lineHeight: 1 }}>
          404
        </div>

        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.85rem', color: 'var(--color-deep-forest)', margin: '0.75rem 0 0.5rem 0' }}>
          Page not found
        </h2>

        <p style={{ fontSize: '0.925rem', color: 'var(--color-charcoal-subtle)', marginBottom: '2rem', lineHeight: 1.6 }}>
          The path you requested could not be located on the SkillSense AI platform. Return to your dashboard or explore career tracks.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link to="/dashboard">
            <Button variant="primary" size="md" icon={Home}>
              Back to Dashboard
            </Button>
          </Link>
          <Link to="/">
            <Button variant="outline" size="md" icon={ArrowLeft}>
              Landing Page
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
