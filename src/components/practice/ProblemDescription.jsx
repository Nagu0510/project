import React from 'react';
import { Badge } from '../common/Badge';
import { formatExamOrigin } from '../../utils/examOrigin';

const DIFFICULTY_VARIANT = { Easy: 'success', Medium: 'warning', Hard: 'error' };

// Statement, examples, constraints and expected complexity. Only what the API sends for students: no hidden case, no hint, no solution.
export const ProblemDescription = ({ problem, solved, matchData }) => {
  const paragraphs = problem.description.split(/\n{2,}/).filter(Boolean);
  const companies = matchData?.companies?.length > 0 ? matchData.companies : problem.companies || [];
  return (
    <div data-testid="pa-description">
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.7rem', lineHeight: 1.15, color: 'var(--text)', margin: '0 0 0.6rem' }}>{problem.title}</h1>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginBottom: '1rem' }}>
        <span data-testid="pa-difficulty" data-difficulty={problem.difficulty}>
          <Badge variant={DIFFICULTY_VARIANT[problem.difficulty] || 'neutral'}>{problem.difficulty}</Badge>
        </span>
        {problem.topic && <Badge variant="emerald" size="sm">{problem.topic}</Badge>}
        {problem.tags.filter((t) => t.toLowerCase() !== (problem.topic || '').toLowerCase()).map((t) => <Badge key={t} size="sm">{t}</Badge>)}
        {solved && <span data-testid="solved-badge"><Badge variant="success" size="sm">✓ Solved</Badge></span>}
        {problem.acceptanceRate !== null && problem.submissionsCount > 0 && (
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }} title={`${problem.submissionsCount} judged submissions`}>
            {problem.acceptanceRate}% accepted
          </span>
        )}
      </div>

      {matchData?.matched && (
        <div role="note" style={{ background: 'var(--lime-soft)', border: '1px solid var(--color-lime)', borderRadius: 'var(--radius-lg)', padding: '0.6rem 0.85rem', marginBottom: '1rem', fontSize: '0.82rem', color: 'var(--text)' }}>
          <strong>Question Intelligence match: </strong>
          {matchData.best_match
            ? <>asked in <strong>{formatExamOrigin(matchData.best_match.company, matchData.best_match.exam, matchData.best_match.year)}</strong>.</>
            : <>previously asked in <strong>{matchData.exam_origin}</strong>.</>}
        </div>
      )}

      <div className="pa-prose">{paragraphs.map((p, i) => <p key={i}>{p}</p>)}</div>

      <div className="pa-prose" style={{ marginTop: '0.4rem' }}>
        Write the function <code className="pa-code">{problem.functionName}({problem.params.map((p) => `${p.name}: ${p.type}`).join(', ')})</code>
        {' '}that returns <code className="pa-code">{problem.returnType}</code>. Your code runs on each test case; what you print is shown as Stdout and does not count.
      </div>

      {problem.examples.length > 0 && (
        <>
          <h2 className="pa-h">Examples</h2>
          {problem.examples.map((ex, i) => (
            <div key={ex.id ?? i} className="pa-example" data-testid="pa-example">
              <span className="pa-ex-label">Example {i + 1} input</span>
              <pre>{ex.input}</pre>
              <span className="pa-ex-label">Output</span>
              <pre>{ex.output}</pre>
              {ex.explanation && <span style={{ display: 'block', marginTop: '6px', fontFamily: 'var(--font-sans)', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{ex.explanation}</span>}
            </div>
          ))}
        </>
      )}

      {problem.constraints.length > 0 && (
        <>
          <h2 className="pa-h">Constraints</h2>
          <ul className="pa-prose" style={{ margin: 0, paddingLeft: '1.2rem' }}>
            {problem.constraints.map((c) => <li key={c}><code className="pa-code">{c}</code></li>)}
          </ul>
        </>
      )}

      <h2 className="pa-h">Limits</h2>
      <div className="pa-prose" style={{ fontSize: '0.875rem' }}>
        {problem.timeLimitMs > 0 && <div>Time limit: <strong>{problem.timeLimitMs} ms</strong> for each test case.</div>}
        {problem.expectedComplexity && <div data-testid="pa-complexity">Expected complexity: <strong>{problem.expectedComplexity}</strong>.</div>}
        {problem.totalCases > 0 && <div>{problem.totalCases} test cases ({problem.shownCases} shown above, the rest hidden).</div>}
      </div>

      {companies.length > 0 && (
        <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '0.9rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '6px' }}>
            {matchData?.matched ? 'Verified in corporate placement drives:' : 'Recently asked by:'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {companies.map((c) => <span key={c} className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>✦ {c}</span>)}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProblemDescription;
