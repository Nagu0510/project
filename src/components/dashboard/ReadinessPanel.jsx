import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FileText, Code2, FileCheck2 } from 'lucide-react';
import { ProgressBar } from '../common/ProgressBar';
import { Badge } from '../common/Badge';

const card = { backgroundColor: 'var(--color-white)', borderRadius: 'var(--radius-xl)', padding: '1.75rem', border: '1px solid var(--color-border-subtle)', minWidth: 0 };
const h3 = { fontFamily: 'var(--font-serif)', fontSize: '1.25rem', color: 'var(--color-deep-forest)', margin: 0 };
const muted = { fontSize: '0.8rem', color: 'var(--color-muted-green)', lineHeight: 1.5 };

// each readiness part that has no data yet has one clear first step
const FIRST_STEPS = {
  assessments: { label: 'Take your first assessment', to: '/assessment', icon: FileCheck2, hint: 'Counts for 40% of your readiness' },
  resume: { label: 'Upload your resume', to: '/resume-analyzer', icon: FileText, hint: 'Counts for 15% and unlocks personal practice' },
  coding: { label: 'Solve your first problem', to: '/practice', icon: Code2, hint: 'Counts for 20% of your readiness' },
};

/** Shown while the student is new (or a part is still empty): one button per missing first step. */
export const StartHere = ({ parts, isNew }) => {
  const steps = parts.filter((p) => !p.has_data && FIRST_STEPS[p.key]).map((p) => ({ key: p.key, ...FIRST_STEPS[p.key] }));
  if (steps.length === 0) return null;
  return (
    <div data-testid="first-steps" style={{ ...card, border: '1.5px solid rgba(15, 118, 110, 0.25)', marginBottom: '2rem' }}>
      <h3 style={h3}>{isNew ? 'Start here' : 'Next first steps'}</h3>
      <p style={{ ...muted, margin: '0.35rem 0 1rem' }}>
        {isNew ? 'Your numbers are all zero because nothing has been recorded yet. Each step below fills in part of your readiness.' : 'These parts of your readiness have no data yet.'}
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {steps.map((s) => (
          <Link key={s.key} to={s.to} data-testid={`first-step-${s.key}`} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }} title={s.hint}>
            <s.icon size={16} /> {s.label} <ArrowRight size={16} />
          </Link>
        ))}
      </div>
    </div>
  );
};

/** The five parts of readiness with their weights, values and the points each adds. */
export const ReadinessPanel = ({ overall, parts, streak, activeDays }) => (
  <div style={card} data-testid="readiness-panel">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px', marginBottom: '1rem' }}>
      <h3 style={h3}>How your readiness is calculated</h3>
      <span style={muted}>{streak} day streak &middot; {activeDays} active day{activeDays === 1 ? '' : 's'} in the last 14</span>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {parts.map((p) => (
        <div key={p.key} data-testid="readiness-part" data-key={p.key} data-value={p.value}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-deep-forest)', marginBottom: '4px' }}>
            <span>{p.label} <span style={{ fontWeight: 500, color: 'var(--color-muted-green)' }}>({p.weight}%)</span></span>
            <span>{p.value}% &middot; {p.points} pts</span>
          </div>
          <ProgressBar value={p.value} height="7px" color={p.has_data ? 'var(--color-emerald)' : 'var(--color-border-medium)'} />
          <div style={{ ...muted, marginTop: '3px' }}>{p.detail}</div>
        </div>
      ))}
    </div>
    <p style={{ ...muted, margin: '1rem 0 0' }}>Total {overall}%. A part with no data counts as 0 until you add some.</p>
  </div>
);

const SERIES = {
  assessment: { label: 'Assessment', color: 'var(--color-emerald)' },
  resume: { label: 'Resume (ATS-style)', color: '#B45309' },
};

/** Assessment and resume scores over time, from the student's own records (oldest on the left). */
export const ScoreHistoryChart = ({ history }) => {
  const W = 560;
  const H = 170;
  const pad = 30;
  const x = (i) => (history.length === 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (history.length - 1));
  const y = (v) => H - pad - (v / 100) * (H - 2 * pad);
  return (
    <div style={card} data-testid="score-history">
      <h3 style={{ ...h3, marginBottom: '0.75rem' }}>Your score history</h3>
      {history.length === 0 ? (
        <p style={muted}>Your assessment and resume scores will appear here after your first assessment or resume analysis.</p>
      ) : (
        <>
          <svg role="img" data-points={history.length} aria-label={`Score history: ${history.map((h) => `${SERIES[h.kind]?.label || h.kind} ${h.score}`).join(', ')}`} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, height: 'auto' }}>
            {[0, 50, 100].map((g) => (
              <g key={g}>
                <line x1={pad} x2={W - pad} y1={y(g)} y2={y(g)} stroke="var(--color-border-subtle)" />
                <text x={4} y={y(g) + 4} fontSize="10" fill="var(--color-muted-green)">{g}</text>
              </g>
            ))}
            {Object.keys(SERIES).map((kind) => {
              const pts = history.map((h, i) => ({ ...h, i })).filter((h) => h.kind === kind);
              return (
                <g key={kind}>
                  {pts.length > 1 && <polyline fill="none" stroke={SERIES[kind].color} strokeWidth="2.5" points={pts.map((p) => `${x(p.i)},${y(p.score)}`).join(' ')} />}
                  {pts.map((p) => (
                    <g key={p.i}>
                      <circle cx={x(p.i)} cy={y(p.score)} r="5" fill={SERIES[kind].color} />
                      <text x={x(p.i)} y={y(p.score) - 9} fontSize="11" textAnchor="middle" fill="var(--color-deep-forest)" fontWeight="700">{p.score}</text>
                    </g>
                  ))}
                </g>
              );
            })}
          </svg>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '6px' }}>
            {Object.entries(SERIES).map(([k, s]) => (
              <span key={k} style={{ ...muted, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color, display: 'inline-block' }} /> {s.label}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/** The next recommended course and the next recommended practice set (from the course recommendations). */
export const NextSteps = ({ recs, failed, onRetry }) => {
  const course = recs?.courses?.[0];
  const set = recs?.nextPracticeSet;
  return (
    <div style={card} data-testid="next-steps">
      <h3 style={{ ...h3, marginBottom: '0.75rem' }}>Your next steps</h3>
      {failed && <p style={muted}>Recommendations could not be loaded. <button type="button" onClick={onRetry} style={{ background: 'none', border: 'none', color: 'var(--color-emerald)', fontWeight: 700, cursor: 'pointer', padding: 0 }}>Try again</button></p>}
      {!failed && !recs && <p style={muted}>Finding your next steps...</p>}
      {recs && !course && <p style={muted}>No courses are available yet.</p>}
      {recs && course && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          <div data-testid="next-course" style={{ padding: '0.85rem 1rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-ivory-surface)', border: '1px solid var(--color-border-subtle)' }}>
            <div style={{ ...muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Next course</div>
            <Link to={`/courses/${course.slug}`} style={{ fontWeight: 700, color: 'var(--color-deep-forest)', fontSize: '1rem' }}>{course.title}</Link>
            <div style={{ ...muted, color: 'var(--color-emerald)', fontWeight: 600 }}>{course.reason}</div>
          </div>
          <div data-testid="next-practice-set" style={{ padding: '0.85rem 1rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-ivory-surface)', border: '1px solid var(--color-border-subtle)' }}>
            <div style={{ ...muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Next practice set</div>
            {set ? (
              <>
                <Link to="/assessment" style={{ fontWeight: 700, color: 'var(--color-deep-forest)', fontSize: '1rem' }}>{set.title}</Link>
                <div style={muted}>{set.questionsCount} questions &middot; <Badge variant="neutral" size="sm">{set.difficulty}</Badge> &middot; for {set.courseTitle}</div>
              </>
            ) : (
              <div style={muted}>There is no assessment set for this course yet. Try <Link to="/practice" style={{ color: 'var(--color-emerald)', fontWeight: 600 }}>coding practice</Link>.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
