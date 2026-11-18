import React, { useMemo } from 'react';

// Small SVG / CSS charts for the admin Analytics page. Every colour is a theme token (var(--chart-n), --success, --warning, --danger),
// so the charts follow the light and dark themes. Each chart also has a text version for screen readers.

const BAND_COLORS = ['var(--danger)', 'var(--danger)', 'var(--warning)', 'var(--chart-1)', 'var(--success)'];

export const StatCard = ({ label, value, note, testId }) => (
  <div className="card-static" data-testid={testId} style={{ padding: '1.25rem 1.4rem', backgroundColor: 'var(--surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', minWidth: 0 }}>
    <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>{label}</div>
    <div style={{ fontFamily: 'var(--font-serif)', fontSize: '2.4rem', lineHeight: 1.1, color: 'var(--text)', marginTop: '4px' }} data-testid={testId ? `${testId}-value` : undefined}>{value}</div>
    {note && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>{note}</div>}
  </div>
);

/** Readiness distribution: one column per band, the count above it. `distribution` = { buckets: [{label, count}], no_data }. */
export const DistributionChart = ({ distribution }) => {
  const buckets = distribution?.buckets || [];
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const total = buckets.reduce((n, b) => n + b.count, 0);
  const summary = `Readiness distribution of ${total} students with data: ${buckets.map((b) => `${b.label}%: ${b.count}`).join(', ')}.`;
  return (
    <div data-testid="chart-distribution">
      <div role="img" aria-label={summary} style={{ display: 'flex', alignItems: 'flex-end', gap: '0.6rem', height: 190, padding: '0 0.25rem' }}>
        {buckets.map((b, i) => (
          <div key={b.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', minWidth: 0 }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>{b.count}</span>
            <div style={{ width: '100%', maxWidth: 64, height: `${Math.max(b.count ? 4 : 1, (b.count / max) * 150)}px`, background: BAND_COLORS[i] || 'var(--chart-1)', borderRadius: '6px 6px 2px 2px', opacity: b.count ? 1 : 0.35 }} />
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '0.6rem', padding: '6px 0.25rem 0', borderTop: '1px solid var(--border-mid)', marginTop: 4 }} aria-hidden="true">
        {buckets.map((b) => <span key={b.label} style={{ flex: 1, textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{b.label}%</span>)}
      </div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 10 }}>
        {distribution?.no_data ? `${distribution.no_data} ${distribution.no_data === 1 ? 'student has' : 'students have'} no activity yet and ${distribution.no_data === 1 ? 'is' : 'are'} not counted.` : 'Every student has some activity.'}
      </div>
    </div>
  );
};

/** Weakest topics: the lowest average first. `rows` = [{topic, average, questions, attempts, students}]. */
export const WeakestSkills = ({ rows }) => (
  <ol data-testid="weakest-skills" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
    {rows.map((r, i) => (
      <li key={r.topic} data-testid="weakest-skill">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.85rem', marginBottom: 4 }}>
          <span style={{ fontWeight: 600, color: 'var(--text)', minWidth: 0 }}>{i + 1}. {r.topic}</span>
          <span style={{ fontWeight: 800, color: r.average < 60 ? 'var(--danger-text)' : r.average < 80 ? 'var(--warning-text)' : 'var(--success-text)', whiteSpace: 'nowrap' }}>{r.average}% average</span>
        </div>
        <div style={{ height: 6, background: 'var(--surface-sunken)', borderRadius: 9999, overflow: 'hidden' }} aria-hidden="true">
          <div style={{ width: `${r.average}%`, height: '100%', background: r.average < 60 ? 'var(--danger)' : r.average < 80 ? 'var(--warning)' : 'var(--success)', borderRadius: 9999 }} />
        </div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3 }}>{r.questions} questions across {r.students} {r.students === 1 ? 'student' : 'students'}</div>
      </li>
    ))}
  </ol>
);

const W = 640;
const H = 220;
const PAD = { left: 34, right: 12, top: 12, bottom: 28 };

/** Activity over time: lines for submissions and assessments, a dashed line for distinct active students. `rows` = 30 days, oldest first. */
export const ActivityChart = ({ rows }) => {
  const series = useMemo(() => {
    const max = Math.max(4, ...rows.map((r) => Math.max(r.submissions, r.assessments, r.active_students)));
    const step = (W - PAD.left - PAD.right) / Math.max(1, rows.length - 1);
    const x = (i) => PAD.left + i * step;
    const y = (v) => H - PAD.bottom - (v / max) * (H - PAD.top - PAD.bottom);
    const line = (key) => rows.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r[key]).toFixed(1)}`).join(' ');
    return { max, x, y, submissions: line('submissions'), assessments: line('assessments'), active: line('active_students') };
  }, [rows]);
  const totals = rows.reduce((t, r) => ({ s: t.s + r.submissions, a: t.a + r.assessments }), { s: 0, a: 0 });
  const summary = `Activity over the last ${rows.length} days: ${totals.a} assessments and ${totals.s} submissions.`;
  const ticks = [0, Math.round(series.max / 2), series.max];
  const labelAt = [0, Math.floor(rows.length / 2), rows.length - 1];
  return (
    <div data-testid="chart-activity">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={series.y(t)} y2={series.y(t)} stroke="var(--border-mid)" strokeWidth="1" />
            <text x={PAD.left - 6} y={series.y(t) + 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">{t}</text>
          </g>
        ))}
        <path d={series.active} fill="none" stroke="var(--chart-6)" strokeWidth="2" strokeDasharray="5 4" />
        <path d={series.assessments} fill="none" stroke="var(--chart-3)" strokeWidth="2.5" strokeLinejoin="round" />
        <path d={series.submissions} fill="none" stroke="var(--chart-1)" strokeWidth="2.5" strokeLinejoin="round" />
        {rows.map((r, i) => <circle key={r.date} cx={series.x(i)} cy={series.y(r.submissions)} r="2.5" fill="var(--chart-1)"><title>{`${r.date}: ${r.submissions} submissions, ${r.assessments} assessments, ${r.active_students} active students`}</title></circle>)}
        {labelAt.map((i) => rows[i] && <text key={i} x={series.x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === rows.length - 1 ? 'end' : 'middle'} fontSize="11" fill="var(--text-muted)">{rows[i].date.slice(5)}</text>)}
      </svg>
      <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 6 }}>
        <Legend color="var(--chart-1)" label="Submissions" />
        <Legend color="var(--chart-3)" label="Assessments" />
        <Legend color="var(--chart-6)" label="Active students" dashed />
      </div>
    </div>
  );
};

const Legend = ({ color, label, dashed }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
    <span aria-hidden="true" style={{ width: 18, height: 0, borderTop: `3px ${dashed ? 'dashed' : 'solid'} ${color}` }} />
    {label}
  </span>
);
