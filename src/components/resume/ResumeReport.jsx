import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { COMPANIES } from '../../services/learningService';
import { Badge } from '../common/Badge';
import { ProgressBar } from '../common/ProgressBar';
import { ProgressCircle } from '../common/ProgressCircle';
import { AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const card = {
  backgroundColor: 'var(--color-white)',
  borderRadius: 'var(--radius-xl)',
  padding: '1.5rem',
  border: '1px solid var(--color-border-subtle)',
  minWidth: 0,
};
const h3 = { fontFamily: 'var(--font-serif)', fontSize: '1.3rem', color: 'var(--color-deep-forest)', margin: '0 0 1rem 0' };
const muted = { fontSize: '0.825rem', color: 'var(--color-muted-green)', lineHeight: 1.5 };

const EVIDENCE = {
  verified: { variant: 'lime', label: 'Verified', hint: 'Confirmed by your assessments or accepted code on SkillSense' },
  demonstrated: { variant: 'emerald', label: 'In a project or job', hint: 'Shown in your Projects or Experience' },
  claimed: { variant: 'neutral', label: 'Listed only', hint: 'Only listed under Skills' },
};

const barColor = (score, max) => (score / Math.max(1, max) >= 0.75 ? 'var(--color-emerald)' : score / Math.max(1, max) >= 0.4 ? 'var(--color-amber, #D97706)' : '#DC2626');

export const ScoreOverview = ({ report }) => {
  const cmp = report.comparison;
  const Trend = !cmp || cmp.delta === 0 ? Minus : cmp.delta > 0 ? TrendingUp : TrendingDown;
  return (
    <div className="card-floating" style={{ ...card, padding: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem', border: '1.5px solid rgba(15, 118, 110, 0.25)' }}>
      <div style={{ flex: '1 1 280px', maxWidth: '520px' }}>
        <Badge variant="neutral">{report.scoreLabel}</Badge>
        <h2 data-testid="headline" style={{ fontFamily: 'var(--font-serif)', fontSize: '1.7rem', color: 'var(--color-deep-forest)', margin: '0.6rem 0 0.4rem' }}>{report.headline}</h2>
        <p style={{ ...muted, margin: 0 }}>
          Target role: <strong>{report.recommendedPath}</strong>. This is a rule-based estimate of how well an ATS could read and match your resume. It is not a real ATS result and not a hiring decision.
        </p>
        {cmp && (
          <p data-testid="comparison" style={{ ...muted, margin: '0.75rem 0 0', display: 'flex', alignItems: 'center', gap: '6px', color: cmp.delta >= 0 ? '#047857' : '#B45309', fontWeight: 600 }}>
            <Trend size={16} /> {cmp.delta === 0 ? 'Same as' : `${cmp.delta > 0 ? '+' : ''}${cmp.delta} points compared with`} your previous analysis ({cmp.previousScore}/100)
          </p>
        )}
      </div>
      <div style={{ textAlign: 'center' }}>
        <div data-testid="ats-score" data-score={report.overallScore}>
          <ProgressCircle value={report.overallScore} size={140} strokeWidth={12} color="var(--color-emerald)" label={`${report.overallScore}`} sublabel="out of 100" />
        </div>
      </div>
    </div>
  );
};

export const OcrNotice = ({ report }) => {
  if (!report.ocrUsed && report.warnings.length === 0) return null;
  const low = report.ocrUsed && report.ocrConfidence !== null && report.ocrConfidence < 60;
  return (
    <div data-testid="ocr-notice" role="status" style={{ ...card, padding: '1rem 1.25rem', backgroundColor: low ? '#FFFBEB' : 'var(--color-white)', border: `1px solid ${low ? 'rgba(245, 158, 11, 0.5)' : 'var(--color-border-subtle)'}` }}>
      {report.ocrUsed && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '0.875rem', color: 'var(--color-deep-forest)' }}>
          <strong>Read with OCR</strong>
          <Badge variant={low ? 'warning' : 'success'} size="sm">OCR confidence {report.ocrConfidence}%</Badge>
          <span style={muted}>{report.pagesProcessed} page{report.pagesProcessed === 1 ? '' : 's'} &middot; engine: {report.ocrEngine}</span>
        </div>
      )}
      {report.ocrUsed && (
        <p style={{ ...muted, margin: '6px 0 0' }}>OCR text can contain mistakes, please review it below and re-score if something is wrong.</p>
      )}
      {report.warnings.map((w) => (
        <p key={w} style={{ margin: '6px 0 0', fontSize: '0.85rem', color: '#92400E', display: 'flex', gap: '6px' }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} /> {w}
        </p>
      ))}
    </div>
  );
};

export const CategoryBars = ({ categories }) => (
  <div style={card}>
    <h3 style={h3}>Where your points come from</h3>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {categories.map((c) => (
        <div key={c.key} data-testid={`category-${c.key}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-deep-forest)', marginBottom: '4px', gap: '8px' }}>
            <span>{c.label}</span>
            <span>{c.score}/{c.max}</span>
          </div>
          <ProgressBar value={c.score} max={c.max} color={barColor(c.score, c.max)} height="7px" />
          <div style={{ ...muted, marginTop: '4px' }}>{c.explanation}</div>
        </div>
      ))}
    </div>
  </div>
);

export const RankedFixes = ({ fixes }) => (
  <div style={card}>
    <h3 style={h3}>Top fixes, biggest gain first</h3>
    {fixes.length === 0 && <p style={muted}>Nothing left to fix that the checks can see. Keep your resume current.</p>}
    <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
      {fixes.map((f) => (
        <li key={f.rank} data-testid="fix" style={{ padding: '0.9rem 1rem', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--color-ivory-surface)', border: '1px solid var(--color-border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
            <strong style={{ color: 'var(--color-deep-forest)', fontSize: '0.925rem' }}>{f.rank}. {f.title}</strong>
            <Badge variant="lime" size="sm">+{f.points} pts</Badge>
          </div>
          <p style={{ ...muted, margin: '4px 0' }}>{f.detail}</p>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--color-charcoal)', background: 'var(--color-white)', border: '1px dashed var(--color-border-medium)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.65rem' }}>{f.example}</pre>
          {f.courseSlug && (
            <Link to={`/courses/${f.courseSlug}`} data-testid="fix-course-link" style={{ display: 'inline-block', marginTop: '0.6rem', fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-emerald)' }}>
              Fix this gap with this course: {f.courseTitle} →
            </Link>
          )}
        </li>
      ))}
    </ol>
  </div>
);

export const SkillChips = ({ skills }) => (
  <div style={card}>
    <h3 style={h3}>Skills found, and how well they are backed up</h3>
    {skills.length === 0 && <p style={muted}>No known skills were found in the text.</p>}
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {skills.map((s) => {
        const ev = EVIDENCE[s.evidence] || EVIDENCE.claimed;
        return (
          <span key={s.name} data-testid="skill-chip" data-evidence={s.evidence} title={`${ev.hint}. ${s.note}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 6px 4px 10px', borderRadius: 'var(--radius-full)', border: `1px solid ${s.required ? 'var(--color-emerald)' : 'var(--color-border-medium)'}`, background: 'var(--color-ivory-soft)', fontSize: '0.825rem', fontWeight: 600, color: 'var(--color-deep-forest)' }}>
            {s.name}
            <Badge variant={ev.variant} size="sm">{ev.label}</Badge>
          </span>
        );
      })}
    </div>
    <p style={{ ...muted, margin: '0.9rem 0 0' }}>
      Green outline = needed for your target role. <strong>Verified</strong> only appears for skills you proved here (a passed assessment or an accepted coding solution of your own).
    </p>
  </div>
);

export const KeywordGap = ({ report }) => {
  const jd = report.jd;
  return (
    <div style={card}>
      <h3 style={h3}>Keyword gap</h3>
      <div style={{ fontSize: '0.9rem', color: 'var(--color-deep-forest)', marginBottom: '0.75rem' }}>
        {report.recommendedPath} role match: <strong data-testid="role-match">{report.roleMatch}%</strong> ({report.matchedRequirements.length} of {report.matchedRequirements.length + report.missingRequirements.length} requirements)
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '1rem' }}>
        {report.matchedRequirements.map((m) => <Badge key={m} variant="success" size="sm">✓ {m}</Badge>)}
        {report.missingRequirements.map((m) => <Badge key={m} variant="warning" size="sm" >✗ {m}</Badge>)}
      </div>
      {jd && (
        <div data-testid="jd-match" style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '0.9rem' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--color-deep-forest)', marginBottom: '0.5rem' }}>
            Job description match: <strong>{jd.matchPercent === null ? 'not enough keywords' : `${jd.matchPercent}%`}</strong>
          </div>
          {jd.note && <p style={muted}>{jd.note}</p>}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {jd.matched.map((m) => <Badge key={m} variant="success" size="sm">✓ {m}</Badge>)}
            {jd.missing.map((m) => <Badge key={m} variant="warning" size="sm">✗ {m}</Badge>)}
          </div>
        </div>
      )}
    </div>
  );
};

export const BulletCoach = ({ tips }) => {
  if (!tips.length) return null;
  return (
    <div style={card}>
      <h3 style={h3}>Bullet coach</h3>
      <p style={{ ...muted, marginTop: '-0.5rem' }}>These are fill-in-the-blank templates, not rewrites. Only write what you really did.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        {tips.map((t) => (
          <div key={t.original} data-testid="bullet-tip" style={{ padding: '0.9rem 1rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-ivory-surface)', border: '1px solid var(--color-border-subtle)' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-charcoal)' }}>&ldquo;{t.original}&rdquo;</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '6px 0' }}>
              {t.issues.map((i) => <Badge key={i} variant="warning" size="sm">{i}</Badge>)}
            </div>
            <p style={{ ...muted, margin: '0 0 6px' }}>{t.advice}</p>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', background: 'var(--color-white)', border: '1px dashed var(--color-border-medium)', borderRadius: 'var(--radius-md)', padding: '0.5rem 0.65rem' }}>
              <strong>Template:</strong> {t.template}
            </div>
            <p style={{ ...muted, margin: '4px 0 0', fontSize: '0.75rem' }}>{t.templateNote}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export const LearningSteps = ({ steps }) => {
  if (!steps.length) return null;
  return (
    <div style={card}>
      <h3 style={h3}>Learning steps for the gaps</h3>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {steps.map((s) => (
          <li key={s.skill} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'var(--color-deep-forest)' }}>
            <CheckCircle2 size={16} color={s.kind === 'course' ? '#059669' : '#9CA3AF'} />
            <span><strong>{s.skill}:</strong> {s.kind === 'course' && s.courseSlug ? <Link to={`/courses/${s.courseSlug}`} data-testid="learning-step-link" style={{ color: 'var(--color-emerald)', fontWeight: 600 }}>{s.title}</Link> : s.title}</span>
            {s.kind === 'course' && <Badge variant="emerald" size="sm">Course available</Badge>}
          </li>
        ))}
      </ul>
    </div>
  );
};

export const CompanyMatches = ({ matches }) => {
  if (!matches.length) return null;
  return (
    <div style={card}>
      <h3 style={h3}>Company skill match (from the skills found in this resume)</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: '1rem' }}>
        {matches.map((c) => (
          <div key={c.company} style={{ padding: '1rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-ivory-soft)', border: '1px solid var(--color-border-medium)' }}>
            <div style={{ fontWeight: 800, color: 'var(--color-forest)', fontSize: '0.95rem' }}>{c.company}</div>
            <div style={{ ...muted, marginBottom: '8px' }}>{c.role}</div>
            <ProgressBar value={c.matchPercentage} color={c.matchPercentage >= 75 ? 'var(--color-emerald)' : 'var(--color-amber, #D97706)'} height="6px" />
            <div style={{ ...muted, marginTop: '6px' }}>{c.matchPercentage}% skill match &middot; {c.status}</div>
            {c.missingSkills.length > 0 && <div style={{ ...muted, color: '#92400E' }}>Missing: {c.missingSkills.join(', ')}</div>}
          </div>
        ))}
      </div>
    </div>
  );
};

// A small line chart of the last analyses (oldest on the left)
export const HistoryChart = ({ history }) => {
  const points = [...history].reverse();
  const W = 560;
  const H = 150;
  const pad = 28;
  const x = (i) => (points.length === 1 ? W / 2 : pad + (i * (W - 2 * pad)) / (points.length - 1));
  const y = (v) => H - pad - (v / 100) * (H - 2 * pad);
  return (
    <div style={card} data-testid="history">
      <h3 style={h3}>Your progress</h3>
      {points.length === 0 ? (
        <p style={muted}>Your analyses will be listed here so you can see your score improve.</p>
      ) : (
        <svg role="img" aria-label={`ATS-style score over your last ${points.length} analyses: ${points.map((p) => p.overallScore).join(', ')}`} viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, height: 'auto' }}>
          {[0, 50, 100].map((g) => (
            <g key={g}>
              <line x1={pad} x2={W - pad} y1={y(g)} y2={y(g)} stroke="var(--color-border-subtle)" />
              <text x={4} y={y(g) + 4} fontSize="10" fill="var(--color-muted-green)">{g}</text>
            </g>
          ))}
          <polyline fill="none" stroke="var(--color-emerald)" strokeWidth="2.5" points={points.map((p, i) => `${x(i)},${y(p.overallScore)}`).join(' ')} />
          {points.map((p, i) => (
            <g key={p.createdAt}>
              <circle cx={x(i)} cy={y(p.overallScore)} r="4.5" fill="var(--color-emerald)" />
              <text x={x(i)} y={y(p.overallScore) - 9} fontSize="11" textAnchor="middle" fill="var(--color-deep-forest)" fontWeight="700">{p.overallScore}</text>
            </g>
          ))}
        </svg>
      )}
    </div>
  );
};

// "Practice for <company>": a personal question set built from this analysis (pattern-inspired practice, not real past questions)
export const PracticeForCompany = ({ analysisId }) => {
  const [company, setCompany] = useState('TCS');
  const to = `/resume-practice?company=${encodeURIComponent(company)}${analysisId ? `&analysis_id=${encodeURIComponent(analysisId)}` : ''}`;
  return (
    <div style={card} data-testid="practice-for-company">
      <h3 style={h3}>Practise for a company</h3>
      <p style={{ ...muted, marginTop: '-0.5rem' }}>
        Questions for the skills on your resume, easier first for skills you only list, plus interview prompts built from your resume.
        They are original questions in a company's style, not real past questions.
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <select aria-label="Company" data-testid="practice-company-select" value={company} onChange={(e) => setCompany(e.target.value)} style={{ padding: '0.55rem 0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-medium)', fontSize: '0.9rem', background: 'var(--color-white)' }}>
          {COMPANIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <Link to={to} className="btn btn-primary btn-sm" data-testid="practice-company-button">Practice for {company}</Link>
        <Link to={`/resume-practice${analysisId ? `?analysis_id=${encodeURIComponent(analysisId)}` : ''}`} style={{ fontSize: '0.85rem', color: 'var(--color-emerald)', fontWeight: 700 }}>Any company →</Link>
      </div>
    </div>
  );
};
