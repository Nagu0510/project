import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Flame, Zap } from 'lucide-react';
import { Badge } from '../common/Badge';
import { useDailyChallenge } from '../../hooks/useDailyChallenge';
import './dailyChallenge.css';

const DIFFICULTY_VARIANT = { Easy: 'success', Medium: 'warning', Hard: 'error' };

const Streak = ({ current, best }) => (
  <span className="dc-streak" data-testid="daily-streak" data-streak={current} title={`Best streak: ${best} ${best === 1 ? 'day' : 'days'}`}>
    <Flame size={16} aria-hidden="true" />
    <strong>{current}</strong> {current === 1 ? 'day' : 'days'}<span className="sr-only"> current streak. Best streak {best}.</span>
  </span>
);

/**
 * Today's problem for everyone, with the student's streak. variant="card" for the dashboard and the problem list, "chip" for the Practice Arena
 * top bar. `onSolve(slug)` opens the problem in place (Practice Arena); without it the button links to /practice?problem=<slug>.
 */
export const DailyChallengeCard = ({ variant = 'card', onSolve }) => {
  const { enabled, data, loading, failed, reload } = useDailyChallenge();
  if (!enabled) return null;
  const problem = data?.problem;
  const solved = Boolean(data?.solved_today);

  if (variant === 'chip') {
    if (!problem) return null;
    const label = solved ? `Daily challenge solved: ${problem.title}` : `Daily challenge: ${problem.title}`;
    const content = (
      <>
        <Zap size={14} aria-hidden="true" />
        {solved && <CheckCircle2 size={14} aria-hidden="true" />}
        <Streak current={data.current_streak} best={data.best_streak} />
      </>
    );
    return onSolve
      ? <button type="button" className="pa-iconbtn dc-chip" data-testid="daily-chip" aria-label={label} title={problem.title} onClick={() => onSolve(problem.slug)}>{content}</button>
      : <Link className="pa-iconbtn dc-chip" data-testid="daily-chip" aria-label={label} title={problem.title} to={`/practice?problem=${encodeURIComponent(problem.slug)}`}>{content}</Link>;
  }

  return (
    <section className="dc-card" data-testid="daily-card" aria-label="Daily challenge">
      <header className="dc-head">
        <span className="dc-kicker"><Zap size={14} aria-hidden="true" /> Daily challenge</span>
        {data && <Streak current={data.current_streak} best={data.best_streak} />}
      </header>
      {loading && !data && <div className="skeleton" style={{ height: 64 }} data-testid="daily-loading" />}
      {failed && !data && (
        <div role="alert" className="dc-note">
          The daily challenge could not be loaded. <button type="button" className="dc-link" onClick={reload}>Try again</button>
        </div>
      )}
      {data && !problem && <div className="dc-note">There is no problem available today.</div>}
      {problem && (
        <>
          <h3 className="dc-title" data-testid="daily-title">{problem.title}</h3>
          <div className="dc-meta">
            <Badge variant={DIFFICULTY_VARIANT[problem.difficulty] || 'neutral'} size="sm">{problem.difficulty}</Badge>
            {problem.topic && <span className="dc-topic">{problem.topic}</span>}
          </div>
          <div className="dc-actions">
            {solved ? (
              <span className="dc-done" data-testid="daily-solved"><CheckCircle2 size={16} aria-hidden="true" /> Solved today. Come back tomorrow to keep your streak.</span>
            ) : onSolve ? (
              <button type="button" className="btn btn-primary btn-sm" data-testid="daily-solve" onClick={() => onSolve(problem.slug)}>Solve now</button>
            ) : (
              <Link className="btn btn-primary btn-sm" data-testid="daily-solve" to={`/practice?problem=${encodeURIComponent(problem.slug)}`}>Solve now</Link>
            )}
          </div>
        </>
      )}
    </section>
  );
};

export default DailyChallengeCard;
