import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../common/Button';

export const CareerCard = ({
  career,
  path,
  onSelect,
  isSelected = false,
  className = '',
}) => {
  const item = career || path || {};
  const title = item.title || "Career Track";
  const description = item.description || "";
  const skills = item.skills || item.requiredSkills || [];
  const matchScore = item.matchScore || item.matchPercentage || 85;
  const avgSalary = item.avgSalary || item.averageSalary;
  const demandLevel = item.demandLevel || "High Demand";
  const roleCount = item.roleCount || `${item.activeOpenings || 100}+ Openings`;

  return (
    <div
      className={`card-floating ${className}`}
      style={{
        padding: '1.75rem',
        borderRadius: 'var(--radius-xl)',
        backgroundColor: 'var(--color-white)',
        border: isSelected ? '2px solid var(--color-emerald)' : '1px solid var(--color-border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        boxShadow: isSelected ? '0 12px 28px -4px rgba(15, 118, 110, 0.18)' : 'var(--shadow-md)',
      }}
    >
      <div>
        {/* Top Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <h3
                style={{
                  fontSize: '1.35rem',
                  fontFamily: 'var(--font-serif)',
                  color: 'var(--color-deep-forest)',
                  margin: 0,
                }}
              >
                {title}
              </h3>
              {isSelected && (
                <span
                  style={{
                    backgroundColor: 'var(--color-emerald)',
                    color: 'var(--color-white)',
                    borderRadius: 'var(--radius-full)',
                    padding: '2px 6px',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                  }}
                >
                  Active Path
                </span>
              )}
            </div>
            {demandLevel && (
              <span style={{ fontSize: '0.78rem', color: 'var(--color-muted-green)', fontWeight: 500 }}>
                {demandLevel} · {roleCount}
              </span>
            )}
          </div>

          <div
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--color-lime-soft)',
              color: 'var(--color-deep-forest)',
              fontWeight: 800,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span style={{ fontSize: '0.75rem' }}>✦</span>
            {matchScore}% Match
          </div>
        </div>

        {/* Description */}
        <p
          style={{
            fontSize: '0.885rem',
            color: 'var(--color-charcoal-subtle)',
            lineHeight: 1.55,
            marginBottom: '1.25rem',
          }}
        >
          {description}
        </p>

        {/* Skills Pills */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted-green)', marginBottom: '6px' }}>
            Core Skills
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {skills.map((skill) => (
              <span
                key={skill}
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  backgroundColor: 'var(--color-ivory-surface)',
                  border: '1px solid var(--color-border-medium)',
                  color: 'var(--color-deep-forest)',
                  padding: '3px 9px',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Metrics & Actions */}
      <div
        style={{
          borderTop: '1px solid var(--color-border-subtle)',
          paddingTop: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <div>
          {avgSalary && (
            <div style={{ fontSize: '0.75rem', color: 'var(--color-muted-green)' }}>
              Avg CTC: <strong style={{ color: 'var(--color-deep-forest)' }}>{avgSalary}</strong>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link to="/roadmap">
            <Button variant="outline-emerald" size="sm" icon={ArrowUpRight} iconPosition="right">
              Roadmap
            </Button>
          </Link>
          {onSelect && (
            <Button variant={isSelected ? "primary" : "lime"} size="sm" onClick={() => onSelect(item)}>
              {isSelected ? "Selected" : "Choose Track"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
