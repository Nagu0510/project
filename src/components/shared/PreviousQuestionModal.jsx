import React from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { Building2, Calendar, Sparkles, CheckCircle2, TrendingUp } from 'lucide-react';

export const PreviousQuestionModal = ({
  isOpen,
  onClose,
  questionTitle = "Two Sum",
  historicalMatch,
  matchData,
}) => {
  const match = historicalMatch || matchData;
  if (!match) return null;

  const {
    company = "TCS",
    exam = "TCS NQT — 2025",
    topic = "Arrays",
    difficulty = "Medium",
    similarity = 94,
    appearancesCount = 6,
    appearances = 6,
    otherAppearances = [
      { company: "Infosys", exam: "Online Test", year: "2024" },
      { company: "Accenture", exam: "Coding Round", year: "2026" },
    ],
  } = match;

  const safeAppearances = Array.isArray(otherAppearances)
    ? otherAppearances
    : Array.isArray(match.historicalOccurrences)
    ? match.historicalOccurrences
    : [
        { company: "Infosys", exam: "Online Test", year: "2024" },
        { company: "Accenture", exam: "Coding Round", year: "2026" },
      ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="✦ Previous Question Intelligence"
      subtitle="Detailed historical appearance and placement pattern breakdown"
      maxWidth="580px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Top Highlight Box */}
        <div
          style={{
            padding: '1.15rem 1.35rem',
            backgroundColor: 'var(--color-ivory-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-muted-green)', fontWeight: 600 }}>
              Current Question
            </div>
            <div
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.35rem',
                color: 'var(--color-deep-forest)',
                marginTop: '2px',
              }}
            >
              {questionTitle}
            </div>
          </div>

          <div
            style={{
              textAlign: 'right',
              backgroundColor: 'var(--color-white)',
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(15, 118, 110, 0.2)',
            }}
          >
            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-emerald)' }}>
              Similarity
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', color: 'var(--color-deep-forest)', lineHeight: 1 }}>
              {similarity}%
            </div>
          </div>
        </div>

        {/* Primary Match Details */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '0.85rem',
          }}
        >
          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-white)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--color-muted-green)', fontWeight: 600 }}>
              Previously Asked In
            </div>
            <div style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--color-deep-forest)', marginTop: '3px' }}>
              {exam}
            </div>
          </div>

          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-white)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--color-muted-green)', fontWeight: 600 }}>
              Topic Category
            </div>
            <div style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--color-emerald)', marginTop: '3px' }}>
              {topic}
            </div>
          </div>

          <div
            style={{
              padding: '0.85rem 1rem',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-white)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <div style={{ fontSize: '0.72rem', color: 'var(--color-muted-green)', fontWeight: 600 }}>
              Difficulty Level
            </div>
            <div style={{ fontSize: '0.925rem', fontWeight: 700, color: 'var(--color-deep-forest)', marginTop: '3px' }}>
              {difficulty}
            </div>
          </div>
        </div>

        {/* Other Appearances */}
        <div>
          <div
            style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--color-muted-green)',
              marginBottom: '0.6rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Other Historical Appearances</span>
            <span style={{ color: 'var(--color-emerald)', fontWeight: 700 }}>
              Total: {appearancesCount || appearances || 5} Times
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {safeAppearances.map((item, idx) => (
              <div
                key={idx}
                style={{
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--color-ivory-surface)',
                  border: '1px solid var(--color-border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building2 size={16} color="var(--color-emerald)" />
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-deep-forest)' }}>
                    {item.company} {item.exam}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: 'var(--color-muted-green)' }}>
                  <Calendar size={14} />
                  <span>{item.year}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Educational Note */}
        <div
          style={{
            padding: '0.85rem 1rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'rgba(199, 243, 107, 0.25)',
            border: '1px solid rgba(199, 243, 107, 0.5)',
            fontSize: '0.825rem',
            color: 'var(--color-dark-emerald)',
            lineHeight: 1.5,
          }}
        >
          <strong>✦ Preparation Tip:</strong> This pattern is a standard filter question for Tier-1 IT drives. Focus on solving it in under 12 minutes with clean variable naming.
        </div>

        {/* Close Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <Button variant="primary" size="md" onClick={onClose} style={{ minWidth: '110px' }}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default PreviousQuestionModal;
