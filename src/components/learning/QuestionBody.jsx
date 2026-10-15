import React from 'react';

const PREVIOUS_YEAR_NOTE = 'Pattern-inspired practice: an original question in the style companies are known to test. It is not a real past question.';

/**
 * Question text, the code it refers to, and the company-style tags.
 * Company tags always read "Pattern-inspired practice". Only a question taken from an admin-uploaded paper may be called
 * a previous-year question, and that comes from `previousMatch`, never from these tags.
 */
export const QuestionBody = ({ question, headingStyle }) => {
  const companies = question.companies || [];
  return (
    <>
      <h2 style={headingStyle}>{question.questionText}</h2>
      {question.code && (
        <pre
          data-testid="question-code"
          aria-label={`${question.language || 'code'} snippet`}
          style={{
            margin: '0 0 1.5rem', padding: '1rem 1.25rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-forest)',
            color: 'var(--color-lime-soft)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre',
          }}
        >
          {question.code}
        </pre>
      )}
      {companies.length > 0 && (
        <div data-testid="pattern-tags" title={PREVIOUS_YEAR_NOTE} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', margin: '-0.75rem 0 1.25rem' }}>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-muted-green)' }}>Pattern-inspired practice:</span>
          {companies.map((c) => (
            <span key={c} className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>{c}-style</span>
          ))}
        </div>
      )}
    </>
  );
};

export default QuestionBody;
