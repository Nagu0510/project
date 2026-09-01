import React, { useState } from 'react';
import { ArrowRight, Eye, Building2, Repeat } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { PreviousQuestionModal } from './PreviousQuestionModal';

export const PreviousQuestionCard = ({ question = {}, className = '' }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const navigate = useNavigate();

  const {
    title = 'Placement Question',
    problemSlug = "two-sum",
    examOrigin = 'Placement Drive',
    topic = 'Data Structures',
    difficulty = 'Medium',
    appearances = 1,
    companies = [],
    badge = "Frequently Asked",
    badgeType = "lime",
    description = '',
    similarity = 94,
    historicalOccurrences = [],
  } = question || {};

  const safeCompanies = Array.isArray(companies) ? companies : companies ? [companies] : ['TCS'];
  const safeOccurrences = Array.isArray(historicalOccurrences) ? historicalOccurrences : [];

  const matchData = {
    company: safeCompanies[0] || "TCS",
    exam: examOrigin,
    topic,
    difficulty,
    similarity,
    appearancesCount: appearances,
    otherAppearances: safeOccurrences,
  };

  return (
    <>
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
          {/* Top Badges */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Badge variant={badgeType === 'lime' ? 'lime' : badgeType === 'emerald' ? 'emerald' : 'forest'}>
                {badge}
              </Badge>
              <Badge variant={difficulty === 'Hard' ? 'error' : difficulty === 'Medium' ? 'warning' : 'success'}>
                {difficulty}
              </Badge>
            </div>

            <span style={{ fontSize: '0.78rem', color: 'var(--color-muted-green)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Repeat size={13} />
              {appearances} Appearances
            </span>
          </div>

          {/* Title & Exam Origin */}
          <h3
            style={{
              fontSize: '1.25rem',
              fontFamily: 'var(--font-serif)',
              color: 'var(--color-deep-forest)',
              lineHeight: 1.25,
              marginBottom: '0.35rem',
            }}
          >
            {title}
          </h3>

          <div style={{ fontSize: '0.825rem', color: 'var(--color-emerald)', fontWeight: 600, marginBottom: '0.75rem' }}>
            {examOrigin}
          </div>

          {description && (
            <p
              style={{
                fontSize: '0.85rem',
                color: 'var(--color-charcoal-subtle)',
                lineHeight: 1.5,
                marginBottom: '1rem',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {description}
            </p>
          )}

          {/* Companies Tag List */}
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted-green)', marginBottom: '4px' }}>
              Seen in drives
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {safeCompanies.map((comp) => (
                <span
                  key={comp}
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    backgroundColor: 'var(--color-ivory-surface)',
                    border: '1px solid var(--color-border-subtle)',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    color: 'var(--color-deep-forest)',
                  }}
                >
                  {comp}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Actions Footer */}
        <div
          style={{
            borderTop: '1px solid var(--color-border-subtle)',
            paddingTop: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
          }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setModalOpen(true)}
            icon={Eye}
            style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
          >
            Intelligence
          </Button>

          <Link to={`/practice?problem=${problemSlug}`}>
            <Button variant="lime" size="sm" icon={ArrowRight} iconPosition="right">
              Practice Question
            </Button>
          </Link>
        </div>
      </div>

      <PreviousQuestionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        questionTitle={title}
        historicalMatch={matchData}
      />
    </>
  );
};

export default PreviousQuestionCard;
