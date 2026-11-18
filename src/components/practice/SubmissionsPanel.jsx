import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../common/Badge';
import { practiceService } from '../../services/practiceService';
import { formatMemory, relativeTime, verdictTone } from '../../utils/practiceHelpers';

const TONE_VARIANT = { success: 'success', warning: 'warning', danger: 'error' };
const LANGUAGE_NAMES = { python: 'Python', javascript: 'JavaScript', java: 'Java', cpp: 'C++', c: 'C' };

// The signed-in student's own last 20 judged submissions of this problem, newest first.
export const SubmissionsPanel = ({ slug, authenticated, refreshKey, onLoad }) => {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authenticated) { setRows([]); return undefined; }
    let alive = true;
    setRows(null);
    setError('');
    practiceService.getSubmissions(slug)
      .then((list) => { if (alive) setRows(list); })
      .catch((err) => { if (alive) { setRows([]); setError(err?.message || 'Submissions could not be loaded.'); } });
    return () => { alive = false; };
  }, [slug, authenticated, refreshKey]);

  if (!authenticated) {
    return <p><Link to="/login" style={{ color: 'var(--accent)', fontWeight: 700 }}>Sign in</Link> to see your submissions.</p>;
  }
  if (rows === null) return <p style={{ color: 'var(--color-text-muted)' }}>Loading your submissions…</p>;
  if (error) return <div role="alert" style={{ color: 'var(--color-error)' }}>{error}</div>;
  if (rows.length === 0) return <p data-testid="pa-no-submissions" style={{ color: 'var(--color-text-muted)' }}>No submissions yet. Submit your solution to see it here.</p>;

  return (
    <div data-testid="pa-submissions">
      {rows.map((s) => (
        <div key={s.id} className="pa-sub-row" data-testid="pa-submission">
          <Badge variant={TONE_VARIANT[verdictTone(s.verdict)]} size="sm">{s.verdict}</Badge>
          <span>{LANGUAGE_NAMES[s.language] || s.language}</span>
          {s.passedCount !== null && s.totalCount !== null && <span style={{ color: 'var(--color-text-muted)' }}>{s.passedCount}/{s.totalCount}</span>}
          {s.runtimeMs !== null && <span style={{ color: 'var(--color-text-muted)' }}>{s.runtimeMs} ms</span>}
          {formatMemory(s.memoryKb) && <span style={{ color: 'var(--color-text-muted)' }}>{formatMemory(s.memoryKb)}</span>}
          <span style={{ color: 'var(--color-text-muted)', marginLeft: 'auto' }}>{relativeTime(s.createdAt)}</span>
          <button type="button" className="pa-iconbtn" data-testid="pa-load-code" onClick={() => onLoad(s)}>Load this code</button>
        </div>
      ))}
      <p style={{ marginTop: '0.75rem' }}><Link to="/my-submissions" data-testid="pa-all-submissions" style={{ color: 'var(--link)', fontWeight: 700, textDecoration: 'underline' }}>See all my submissions</Link></p>
    </div>
  );
};

export default SubmissionsPanel;
