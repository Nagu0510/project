import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../common/Badge';
import { ProgressBar } from '../common/ProgressBar';
import { learningService } from '../../services/learningService';

const box = {
  backgroundColor: 'var(--color-white)', borderRadius: 'var(--radius-xl)', padding: '1.75rem',
  border: '1px solid var(--color-border-subtle)', minWidth: 0,
};
const h3 = { fontFamily: 'var(--font-serif)', fontSize: '1.25rem', color: 'var(--color-deep-forest)', margin: 0 };
const muted = { fontSize: '0.8rem', color: 'var(--color-muted-green)', lineHeight: 1.5 };

/** The top 5 recommended courses with a reason each, and the 4-week study plan. `compact` hides the plan. */
export const RecommendationsCard = ({ compact = false, title = 'Recommended courses', shared }) => {
  // `shared` = { data, failed, retry } when the page already loaded the recommendations (one request, not two)
  const [own, setOwn] = useState(null); // null = loading
  const [ownFailed, setOwnFailed] = useState(false);

  const load = () => {
    setOwnFailed(false);
    learningService.getRecommendations().then(setOwn).catch(() => setOwnFailed(true));
  };
  useEffect(() => { if (!shared) load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const data = shared ? shared.data : own;
  const failed = shared ? shared.failed : ownFailed;
  const retry = shared ? shared.retry : load;

  return (
    <div className="card-static" data-testid="recommendations" style={box}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <h3 style={h3}>{title}</h3>
        <Link to="/courses" style={{ fontSize: '0.825rem', color: 'var(--color-emerald)', fontWeight: 700 }}>All courses →</Link>
      </div>

      {failed && (
        <p role="alert" style={muted}>
          Recommendations could not be loaded.{' '}
          <button type="button" onClick={retry} style={{ background: 'none', border: 'none', color: 'var(--color-emerald)', fontWeight: 700, cursor: 'pointer', padding: 0 }}>Try again</button>
        </p>
      )}
      {!failed && data === null && <p style={muted}>Finding the best courses for you...</p>}

      {data && (
        <>
          <p style={{ ...muted, margin: '0 0 1rem' }}>
            {data.hasData
              ? `Based on your ${data.careerPath ? `${data.careerPath} path, ` : ''}latest assessment and resume analysis.`
              : 'You have no assessment or resume yet, so these are good places to begin.'}
          </p>
          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {data.courses.map((c, i) => (
              <li key={c.slug} data-testid="recommended-course" style={{ padding: '0.85rem 1rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-ivory-surface)', border: '1px solid var(--color-border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <Link to={`/courses/${c.slug}`} style={{ fontWeight: 700, color: 'var(--color-deep-forest)', textDecoration: 'none' }}>{i + 1}. {c.title}</Link>
                  <Badge variant="neutral" size="sm">{c.level}</Badge>
                </div>
                <div data-testid="recommendation-reason" style={{ ...muted, color: 'var(--color-emerald)', fontWeight: 600, margin: '2px 0 6px' }}>{c.reason}</div>
                <div style={{ ...muted, marginBottom: c.progress.done ? '6px' : 0 }}>{c.modulesCount} modules · about {c.estimatedHours} hours</div>
                {c.progress.done > 0 && <ProgressBar value={c.progress.percent} height="5px" />}
              </li>
            ))}
          </ol>

          {!compact && (
            <div data-testid="study-plan" style={{ marginTop: '1.5rem' }}>
              <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', color: 'var(--color-deep-forest)', margin: '0 0 0.25rem' }}>Your 4-week study plan</h4>
              <p style={{ ...muted, margin: '0 0 0.75rem' }}>About {data.plan.hoursPerWeek} hours a week, {data.plan.totalHours} hours in all.{data.plan.modulesAfterWeek4 > 0 ? ` ${data.plan.modulesAfterWeek4} more modules continue after week 4.` : ''}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(210px, 100%), 1fr))', gap: '0.75rem' }}>
                {data.plan.weeks.map((w) => (
                  <div key={w.week} data-testid="plan-week" style={{ padding: '0.85rem 1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-medium)', background: 'var(--color-white)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: 'var(--color-forest)', fontSize: '0.875rem' }}>
                      <span>Week {w.week}</span><span>{w.hours} h</span>
                    </div>
                    <div style={{ ...muted, margin: '2px 0 6px' }}>{w.focus}</div>
                    <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.8rem', color: 'var(--color-charcoal)', lineHeight: 1.5 }}>
                      {w.modules.map((m) => (
                        <li key={m.moduleId}><Link to={`/courses/${m.courseSlug}`} style={{ color: 'inherit' }}>{m.title}</Link> <span style={{ color: 'var(--color-muted-green)' }}>({m.hours} h)</span></li>
                      ))}
                      {w.modules.length === 0 && <li style={{ listStyle: 'none', marginLeft: '-1.1rem', color: 'var(--color-muted-green)' }}>Nothing planned: use it to revise and practise.</li>}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default RecommendationsCard;
