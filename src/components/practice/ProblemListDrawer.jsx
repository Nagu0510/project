import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Search } from 'lucide-react';
import { Badge } from '../common/Badge';
import { filterProblems } from '../../utils/practiceHelpers';
import { DailyChallengeCard } from './DailyChallengeCard';

const DIFFICULTY_VARIANT = { Easy: 'success', Medium: 'warning', Hard: 'error' };

// Problem list: search, difficulty / topic / status filters, tags, a check mark for solved problems and the acceptance rate when there is data.
export const ProblemListDrawer = ({ open, onClose, problems, solved, currentSlug, onSelect }) => {
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState('All');
  const [topic, setTopic] = useState('All');
  const [status, setStatus] = useState('All');
  const searchRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    searchRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const topics = useMemo(() => ['All', ...Array.from(new Set(problems.map((p) => p.topic).filter(Boolean)))], [problems]);
  const visible = useMemo(() => filterProblems(problems, { query, difficulty, topic, status, solved }), [problems, query, difficulty, topic, status, solved]);

  if (!open) return null;
  return (
    <>
      <div className="pa-drawer-backdrop" onClick={onClose} data-testid="pa-drawer-backdrop" />
      <aside className="pa-drawer" role="dialog" aria-modal="true" aria-label="Problem list" data-testid="pa-drawer">
        <header>
          <strong style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', color: 'var(--text)' }}>Problems <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>({visible.length}/{problems.length})</span></strong>
          <button type="button" className="pa-iconbtn" onClick={onClose} aria-label="Close problem list"><X size={16} /></button>
        </header>
        <div style={{ padding: '0 1rem 0.75rem' }}>
          <DailyChallengeCard onSolve={(s) => { onSelect(s); onClose(); }} />
        </div>
        <div className="pa-search-wrap">
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 'calc(50% + 3px)', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} aria-hidden="true" />
            <input
              ref={searchRef} className="pa-search" type="search" placeholder="Search by title, topic or tag" aria-label="Search problems" data-testid="pa-search"
              value={query} onChange={(e) => setQuery(e.target.value)} style={{ paddingLeft: '2rem' }}
            />
          </div>
        </div>
        <div className="pa-filters">
          <select aria-label="Filter by difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            {['All', 'Easy', 'Medium', 'Hard'].map((d) => <option key={d} value={d}>{d === 'All' ? 'Difficulty' : d}</option>)}
          </select>
          <select aria-label="Filter by topic" value={topic} onChange={(e) => setTopic(e.target.value)}>
            {topics.map((t) => <option key={t} value={t}>{t === 'All' ? 'Topic' : t}</option>)}
          </select>
          <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {['All', 'Solved', 'Unsolved'].map((s) => <option key={s} value={s}>{s === 'All' ? 'Status' : s}</option>)}
          </select>
        </div>
        <div className="pa-list" data-testid="pa-list">
          {visible.length === 0 && <p style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>No problem matches these filters.</p>}
          {visible.map((p) => (
            <button key={p.slug} type="button" className="pa-row" aria-current={p.slug === currentSlug} data-testid="pa-problem-row" onClick={() => { onSelect(p.slug); onClose(); }}>
              <span className="pa-check" aria-label={solved.includes(p.slug) ? 'Solved' : undefined}>{solved.includes(p.slug) ? '✓' : ''}</span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span className="pa-title">{p.title}</span>
                <span className="pa-meta">
                  <Badge variant={DIFFICULTY_VARIANT[p.difficulty] || 'neutral'} size="sm">{p.difficulty}</Badge>
                  <span>{p.topic}</span>
                  {p.acceptanceRate !== null && p.submissionsCount > 0 && <span>{p.acceptanceRate}% accepted</span>}
                </span>
                {p.tags.length > 0 && <span className="pa-meta">{p.tags.map((t) => `#${t}`).join('  ')}</span>}
              </span>
            </button>
          ))}
        </div>
      </aside>
    </>
  );
};

export default ProblemListDrawer;
