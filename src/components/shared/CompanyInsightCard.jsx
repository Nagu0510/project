import React from 'react';
import { ArrowRight, Building2, Layers, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../common/Button';

export const CompanyInsightCard = ({
  companyKey = 'tcs',
  companyData,
  className = '',
}) => {
  if (!companyData) return null;

  const {
    name,
    shortName,
    analyzedQuestionsCount = 120,
    topTopics = ["DSA", "Aptitude", "Java", "SQL"],
    aiInsight,
  } = companyData;

  return (
    <div
      className={`card-floating ${className}`}
      style={{
        padding: '1.5rem',
        borderRadius: 'var(--radius-xl)',
        backgroundColor: 'var(--color-white)',
        border: '1px solid var(--color-border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: 'var(--color-ivory-surface)',
                border: '1px solid var(--color-border-medium)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-emerald)',
                fontWeight: 800,
                fontSize: '1rem',
              }}
            >
              {shortName.charAt(0)}
            </div>
            <div>
              <h3
                style={{
                  fontSize: '1.25rem',
                  fontFamily: 'var(--font-serif)',
                  color: 'var(--color-deep-forest)',
                  margin: 0,
                }}
              >
                {shortName}
              </h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-muted-green)' }}>
                {analyzedQuestionsCount} analyzed questions
              </span>
            </div>
          </div>

          <span
            style={{
              padding: '4px 8px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--color-lime-soft)',
              color: 'var(--color-deep-forest)',
              fontSize: '0.72rem',
              fontWeight: 700,
            }}
          >
            Verified Drive
          </span>
        </div>

        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted-green)', marginBottom: '6px' }}>
            Top Assessment Topics
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {topTopics.map((topic) => (
              <span
                key={topic}
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  backgroundColor: 'var(--color-ivory-surface)',
                  border: '1px solid var(--color-border-subtle)',
                  padding: '3px 8px',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-deep-forest)',
                }}
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          borderTop: '1px solid var(--color-border-subtle)',
          paddingTop: '0.85rem',
        }}
      >
        <Link to={`/company-prep/${companyKey}`} style={{ width: '100%', display: 'block' }}>
          <Button variant="outline-emerald" size="sm" style={{ width: '100%' }} icon={ArrowRight} iconPosition="right">
            View {shortName} Insights
          </Button>
        </Link>
      </div>
    </div>
  );
};
