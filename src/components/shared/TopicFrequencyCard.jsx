import React from 'react';
import { Layers, Type, Database, Box, TrendingUp, GitBranch, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../common/Badge';

export const TopicFrequencyCard = ({ topic = {}, className = '' }) => {
  const {
    name = 'Topic',
    appearances = 0,
    companies = [],
    priority = '',
  } = topic || {};

  const safeCompanies = Array.isArray(companies) ? companies : [companies].filter(Boolean);

  let Icon = Layers;
  if (name.includes('String')) Icon = Type;
  else if (name.includes('SQL') || name.includes('Database')) Icon = Database;
  else if (name.includes('OOP')) Icon = Box;
  else if (name.includes('Aptitude')) Icon = TrendingUp;
  else if (name.includes('Dynamic')) Icon = GitBranch;

  return (
    <Link
      to={`/previous-questions?topic=${encodeURIComponent(name)}`}
      className={`card-floating ${className}`}
      style={{
        padding: '1.25rem 1.35rem',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--color-white)',
        border: '1px solid var(--color-border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        textDecoration: 'none',
        transition: 'transform 0.2s ease, border-color 0.2s ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--color-emerald)')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--color-border-subtle)')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            backgroundColor: 'var(--color-ivory-surface)',
            border: '1px solid var(--color-border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-emerald)',
            flexShrink: 0,
          }}
        >
          <Icon size={20} />
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h4
              style={{
                fontSize: '1.05rem',
                fontFamily: 'var(--font-serif)',
                color: 'var(--color-deep-forest)',
                margin: 0,
              }}
            >
              {name}
            </h4>
            {priority && (
              <Badge variant={priority === 'High' ? 'lime' : 'neutral'} size="sm">
                {priority} Priority
              </Badge>
            )}
          </div>

          <div style={{ fontSize: '0.78rem', color: 'var(--color-muted-green)', marginTop: '2px' }}>
            <strong style={{ color: 'var(--color-deep-forest)' }}>{appearances}</strong> appearances · {safeCompanies.join(' · ')}
          </div>
        </div>
      </div>

      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--color-ivory-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-emerald)',
        }}
      >
        <ArrowRight size={16} />
      </div>
    </Link>
  );
};

export default TopicFrequencyCard;
