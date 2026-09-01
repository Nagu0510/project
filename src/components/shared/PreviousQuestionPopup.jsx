import React, { useState } from 'react';
import { Sparkles, X, Eye, ArrowRight, Building, CheckCircle2 } from 'lucide-react';
import { Button } from '../common/Button';
import { PreviousQuestionModal } from './PreviousQuestionModal';

export const PreviousQuestionPopup = ({
  historicalMatch,
  matchData,
  questionTitle = "Current Problem",
  onDismiss,
  onViewDetails,
  isOpen = true,
}) => {
  const [modalOpen, setModalOpen] = useState(false);

  const match = historicalMatch || matchData;
  if (!isOpen || !match) return null;

  const {
    company = "TCS",
    exam = "TCS NQT — 2025",
    year = "2025",
    topic = "Arrays",
    difficulty = "Medium",
    similarity = 94,
    appearancesCount = 6,
    appearances = 6,
    otherAppearances = [],
  } = match;

  const handleOpenDetails = () => {
    if (typeof onViewDetails === 'function') {
      onViewDetails(match);
    } else {
      setModalOpen(true);
    }
  };

  return (
    <>
      <div
        className="previous-question-popup animate-fade-in"
        style={{
          position: 'fixed',
          top: '88px',
          right: '24px',
          zIndex: 800,
          width: '340px',
          maxWidth: 'calc(100vw - 32px)',
          backgroundColor: 'var(--color-white)',
          border: '1.5px solid rgba(15, 118, 110, 0.35)',
          borderRadius: 'var(--radius-xl)',
          padding: '1.25rem',
          boxShadow: '0 16px 36px -6px rgba(6, 46, 37, 0.16), 0 0 20px -2px rgba(199, 243, 107, 0.25)',
          backdropFilter: 'blur(10px)',
        }}
      >
        {/* Header with Lime Sparkle Accent */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '22px',
                height: '22px',
                borderRadius: '6px',
                backgroundColor: 'var(--color-lime)',
                color: 'var(--color-deep-forest)',
                fontSize: '0.8rem',
                fontWeight: 900,
              }}
            >
              ✦
            </span>
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: 800,
                fontSize: '0.78rem',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: 'var(--color-emerald)',
              }}
            >
              Previously Asked
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                backgroundColor: 'var(--color-lime-soft)',
                color: 'var(--color-deep-forest)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
              }}
            >
              {similarity}% Match
            </span>
            {onDismiss && (
              <button
                onClick={onDismiss}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-muted-green)',
                  display: 'flex',
                  padding: '2px',
                }}
                aria-label="Dismiss popup"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Question Context Body */}
        <div style={{ marginBottom: '0.85rem' }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--color-muted-green)', marginBottom: '2px' }}>
            A similar problem appeared in:
          </div>
          <div
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.15rem',
              color: 'var(--color-deep-forest)',
              lineHeight: 1.25,
            }}
          >
            {exam}
          </div>
        </div>

        {/* Metadata Pill Grid */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '1rem',
            fontSize: '0.78rem',
          }}
        >
          <div
            style={{
              padding: '3px 8px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-ivory-surface)',
              border: '1px solid var(--color-border-subtle)',
              color: 'var(--color-deep-forest)',
              fontWeight: 600,
            }}
          >
            Topic: <strong style={{ color: 'var(--color-emerald)' }}>{topic}</strong>
          </div>
          <div
            style={{
              padding: '3px 8px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--color-ivory-surface)',
              border: '1px solid var(--color-border-subtle)',
              color: 'var(--color-deep-forest)',
              fontWeight: 600,
            }}
          >
            Difficulty: <strong style={{ color: difficulty === 'Hard' ? 'var(--color-error)' : 'var(--color-dark-emerald)' }}>{difficulty}</strong>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Button
            variant="primary"
            size="sm"
            style={{ flex: 1, fontSize: '0.8rem', padding: '0.45rem 0.75rem' }}
            onClick={handleOpenDetails}
            icon={Eye}
          >
            View Details
          </Button>
          {onDismiss && (
            <Button
              variant="outline"
              size="sm"
              style={{ fontSize: '0.8rem', padding: '0.45rem 0.75rem' }}
              onClick={onDismiss}
            >
              Dismiss
            </Button>
          )}
        </div>
      </div>

      {/* Details Modal */}
      {!onViewDetails && (
        <PreviousQuestionModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          questionTitle={questionTitle}
          historicalMatch={match}
          matchData={match}
        />
      )}

      <style>{`
        @media (max-width: 640px) {
          .previous-question-popup {
            top: auto !important;
            bottom: 20px !important;
            right: 16px !important;
            left: 16px !important;
            width: auto !important;
          }
        }
      `}</style>
    </>
  );
};

export default PreviousQuestionPopup;
