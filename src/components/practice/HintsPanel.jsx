import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { practiceService } from '../../services/practiceService';

// Hints are fetched one at a time and stay hidden until the student asks: nothing about later hints is in the page before that.
export const HintsPanel = ({ slug, hintCount, authenticated }) => {
  const [revealed, setRevealed] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setRevealed([]); setError(''); }, [slug]);

  if (hintCount === 0) return <p style={{ color: 'var(--color-text-muted)' }}>This problem has no hints.</p>;
  const next = revealed.length + 1;

  const reveal = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await practiceService.getHint(slug, next);
      setRevealed((list) => [...list, res.hint]);
    } catch (err) {
      setError(err?.status === 401 ? 'Sign in to reveal hints.' : (err?.message || 'The hint could not be loaded. Try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="pa-hints">
      <p style={{ marginTop: 0, color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
        Stuck? Reveal a hint, one at a time. Each hint points a little closer, but none of them gives the answer.
      </p>
      {revealed.map((hint, i) => (
        <div key={i} data-testid="pa-hint" style={{ background: 'var(--lime-soft)', border: '1px solid var(--color-lime)', borderRadius: 'var(--radius-lg)', padding: '0.75rem 1rem', marginBottom: '0.6rem' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '2px' }}>Hint {i + 1} of {hintCount}</div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text)', lineHeight: 1.55 }}>{hint}</div>
        </div>
      ))}
      {!authenticated ? (
        <p style={{ fontSize: '0.875rem' }}><Link to="/login" style={{ color: 'var(--accent)', fontWeight: 700 }}>Sign in</Link> to reveal hints.</p>
      ) : revealed.length < hintCount && (
        <button type="button" className="pa-iconbtn" data-testid="pa-reveal-hint" onClick={reveal} disabled={loading}>
          {loading ? 'Loading…' : `Reveal hint ${next}/${hintCount}`}
        </button>
      )}
      {error && <div role="alert" style={{ marginTop: '0.6rem', color: 'var(--color-error)', fontSize: '0.85rem' }}>{error}</div>}
    </div>
  );
};

export default HintsPanel;
