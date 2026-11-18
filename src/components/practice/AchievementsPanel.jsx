import React, { useEffect, useState } from 'react';
import { Award, Flame } from 'lucide-react';
import { practiceService } from '../../services/practiceService';
import { ErrorBanner } from '../common/ErrorBanner';
import './dailyChallenge.css';

/** Profile: the coding streak, the best streak and three simple badges (7-day streak, 30-day streak, 10 problems solved). */
export const AchievementsPanel = () => {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    practiceService.getAchievements().then((d) => { if (alive) setData(d); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [key]);

  return (
    <section className="card-static" data-testid="achievements" aria-label="Streak and badges" style={{ padding: '1.75rem', backgroundColor: 'var(--surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)' }}>
      <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: 'var(--text)', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Flame size={20} color="var(--warning)" aria-hidden="true" /> Streak and badges
      </h3>
      {failed && <ErrorBanner message="Your streak could not be loaded." onRetry={() => setKey((k) => k + 1)} />}
      {!failed && !data && <div className="skeleton" style={{ height: 90 }} />}
      {data && (
        <>
          <div className="ach-stats">
            <div className="ach-stat"><strong data-testid="ach-current">{data.current_streak}</strong><span>Current streak (days)</span></div>
            <div className="ach-stat"><strong data-testid="ach-best">{data.best_streak}</strong><span>Best streak (days)</span></div>
            <div className="ach-stat"><strong data-testid="ach-solved">{data.problems_solved}</strong><span>Problems solved</span></div>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
            A streak day is a day with at least one Accepted submission. Miss a whole day and the streak starts again.
          </p>
          <div className="ach-grid">
            {data.badges.map((b) => (
              <div key={b.key} className="ach-badge" data-testid={`badge-${b.key}`} data-earned={b.earned}>
                <span className="ach-label"><Award size={16} aria-hidden="true" /> {b.label}</span>
                <span className="ach-state">{b.earned ? 'Earned' : `${b.progress} of ${b.target}`}</span>
                <div className="ach-bar" aria-hidden="true"><span style={{ width: `${Math.round((b.progress / b.target) * 100)}%` }} /></div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export default AchievementsPanel;
