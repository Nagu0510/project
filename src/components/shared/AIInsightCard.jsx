import React from 'react';
import { Sparkles, ArrowRight, CheckCircle, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../common/Button';

export const AIInsightCard = ({
  headline = "You're strong in Python and SQL.",
  gap = "System Design",
  recommendation = "Backend Architecture — Level 2",
  actionText = "View Roadmap →",
  actionLink = "/roadmap",
  onAction,
  badgeText = "AI INSIGHT",
  className = '',
}) => {
  return (
    <div
      className={`card-floating ${className}`}
      style={{
        position: 'relative',
        backgroundColor: 'var(--color-white)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid rgba(15, 118, 110, 0.25)',
        padding: '1.5rem 1.75rem',
        boxShadow: '0 8px 24px -4px rgba(6, 46, 37, 0.08)',
        overflow: 'hidden',
      }}
    >
      {/* Decorative subtle accent line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: 'linear-gradient(90deg, var(--color-lime) 0%, var(--color-emerald) 100%)',
        }}
      />

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
              color: 'var(--color-emerald)',
            }}
          >
            {badgeText}
          </span>
        </div>

        <span
          style={{
            fontSize: '0.72rem',
            color: 'var(--color-muted-green)',
            backgroundColor: 'var(--color-ivory-surface)',
            padding: '2px 8px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          Adaptive Feedback
        </span>
      </div>

      <h3
        style={{
          fontSize: '1.35rem',
          fontFamily: 'var(--font-serif)',
          color: 'var(--color-deep-forest)',
          lineHeight: 1.25,
          marginBottom: '1rem',
        }}
      >
        {headline}
      </h3>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '0.85rem',
          marginBottom: '1.25rem',
        }}
      >
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-ivory-surface)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--color-muted-green)', fontWeight: 600 }}>
            Your current gap:
          </div>
          <div
            style={{
              fontSize: '0.95rem',
              fontWeight: 700,
              color: 'var(--color-deep-forest)',
              marginTop: '2px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
            {gap}
          </div>
        </div>

        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(199, 243, 107, 0.22)',
            border: '1px solid rgba(199, 243, 107, 0.45)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--color-dark-emerald)', fontWeight: 600 }}>
            Recommended next step:
          </div>
          <div
            style={{
              fontSize: '0.95rem',
              fontWeight: 700,
              color: 'var(--color-deep-forest)',
              marginTop: '2px',
            }}
          >
            {recommendation}
          </div>
        </div>
      </div>

      {actionLink ? (
        <Link to={actionLink} style={{ display: 'inline-block' }}>
          <Button variant="primary" size="sm" icon={ArrowRight} iconPosition="right">
            {actionText}
          </Button>
        </Link>
      ) : (
        <Button variant="primary" size="sm" onClick={onAction} icon={ArrowRight} iconPosition="right">
          {actionText}
        </Button>
      )}
    </div>
  );
};
