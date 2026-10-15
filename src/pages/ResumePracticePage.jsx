import React, { useEffect, useState } from 'react';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { Link, useSearchParams } from 'react-router-dom';
import { Sidebar } from '../components/common/Sidebar';
import { Badge } from '../components/common/Badge';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingState } from '../components/common/LoadingState';
import { QuestionBody } from '../components/learning/QuestionBody';
import { COMPANIES, learningService } from '../services/learningService';
import { assessmentService } from '../services/assessmentService';
import { normalizeAssessmentQuestion } from '../utils/normalizers';

const box = { backgroundColor: 'var(--color-white)', borderRadius: 'var(--radius-xl)', padding: '1.5rem', border: '1px solid var(--color-border-subtle)', minWidth: 0 };
const LETTERS = ['A', 'B', 'C', 'D'];

export const ResumePracticePage = () => {
  const [params, setParams] = useSearchParams();
  const company = params.get('company') || '';
  const analysisId = params.get('analysis_id') || '';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState({}); // question id -> { picked, correctIndex, isCorrect, explanation }
  const [busy, setBusy] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [failed, setFailed] = useState(false); // a real failure (not the normal 'no analysis yet')

  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');
    setFailed(false);
    setAnswers({});
    learningService.getResumeQuestions({ analysisId, company })
      .then((d) => alive && setData({ ...d, questions: d.questions.map((q) => ({ ...normalizeAssessmentQuestion(q), reason: q.reason, forSkill: q.for_skill, level: q.level })) }))
      .catch((err) => { if (!alive) return; setError(err?.message || 'The practice set could not be loaded.'); setFailed(err?.status !== 404 && err?.status !== 400); });
    return () => { alive = false; };
  }, [analysisId, company, reloadKey]);

  const answer = async (q, index) => {
    if (answers[q.id] || busy) return;
    setBusy(q.id);
    try {
      const r = await assessmentService.verifyPracticeAnswer(q.id, index);
      setAnswers((a) => ({ ...a, [q.id]: { picked: index, correctIndex: r.correct_option_index, isCorrect: r.is_correct, explanation: r.explanation } }));
    } finally {
      setBusy(null);
    }
  };

  const setCompany = (value) => {
    const next = new URLSearchParams(params);
    if (value) next.set('company', value); else next.delete('company');
    setParams(next);
  };

  const solved = Object.values(answers).filter((a) => a.isCorrect).length;

  return (
    <div className="dashboard-layout" style={{ minHeight: '100vh', backgroundColor: 'var(--color-warm-ivory)' }}>
      <Sidebar />
      <main className="dashboard-main">
        <div className="dashboard-content animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto' }}>
          <Link to="/resume-analyzer" style={{ fontSize: '0.85rem', color: 'var(--color-emerald)', fontWeight: 700 }}>← Back to the resume analyzer</Link>
          <h1 data-testid="practice-title" style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', color: 'var(--color-deep-forest)', margin: '0.5rem 0 0.25rem' }}>
            {company ? `Practice for ${company}` : 'Practice from your resume'}
          </h1>
          <p style={{ color: 'var(--color-charcoal-subtle)', margin: '0 0 1rem', maxWidth: '680px' }}>
            Questions for the skills your resume shows. Skills that are only listed start with easier questions.
          </p>
          <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-forest)', display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '1rem' }}>
            Company style
            <select aria-label="Company style" value={company} onChange={(e) => setCompany(e.target.value)} style={{ padding: '0.45rem 0.8rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border-medium)', background: 'var(--color-ivory-soft)', fontWeight: 600 }}>
              <option value="">Any company</option>
              {COMPANIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>

          {!data && !error && <LoadingState message="Building your practice set..." subtitle="One moment" />}
          {error && failed && <ErrorBanner title="The practice set could not be loaded." message={error} onRetry={() => setReloadKey((k) => k + 1)} />}
          {error && !failed && (
            <EmptyState title="No practice set yet" description={error} actionText="Analyse a resume" onAction={() => { window.location.href = '/resume-analyzer'; }} />
          )}

          {data && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <p data-testid="disclaimer" style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-muted-green)' }}>{data.disclaimer}</p>

              {data.prompts.length > 0 && (
                <div style={box} data-testid="prompts">
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', color: 'var(--color-deep-forest)', margin: '0 0 0.75rem' }}>Interview prompts from your resume</h2>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    {data.prompts.map((p) => (
                      <li key={p.text} style={{ padding: '0.75rem 1rem', borderRadius: 'var(--radius-lg)', background: 'var(--color-ivory-surface)', border: '1px solid var(--color-border-subtle)', fontSize: '0.9rem' }}>
                        {p.text} <Badge variant="neutral" size="sm">{p.label}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data.questions.length === 0 && <EmptyState title="No questions for this combination" description={data.note || 'Try another company style.'} />}
              {data.questions.length > 0 && (
                <div style={{ fontSize: '0.85rem', color: 'var(--color-muted-green)' }}>
                  {data.questions.length} questions · <span data-testid="score">{solved} correct so far</span>
                </div>
              )}

              {data.questions.map((q, qi) => {
                const a = answers[q.id];
                return (
                  <div key={q.id} data-testid="practice-question" style={box}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <Badge variant="lime" size="sm">{qi + 1}. {q.skill}</Badge>
                      <Badge variant="neutral" size="sm">{q.difficulty}</Badge>
                      {q.questionType && <Badge variant="neutral" size="sm">{q.questionType}</Badge>}
                    </div>
                    {q.reason && <div style={{ fontSize: '0.78rem', color: 'var(--color-emerald)', fontWeight: 600, marginBottom: '0.5rem' }}>{q.reason}</div>}
                    <QuestionBody question={q} headingStyle={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', color: 'var(--color-deep-forest)', lineHeight: 1.45, margin: '0 0 1rem' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {q.options.map((opt, oi) => {
                        const isPicked = a && a.picked === oi;
                        const isRight = a && a.correctIndex === oi;
                        return (
                          <button
                            key={oi} type="button" data-testid="practice-option" disabled={Boolean(a) || busy === q.id} onClick={() => answer(q, oi)}
                            style={{ textAlign: 'left', padding: '0.7rem 1rem', borderRadius: 'var(--radius-md)', cursor: a ? 'default' : 'pointer', whiteSpace: 'pre-wrap', fontSize: '0.9rem',
                              border: `1.5px solid ${isRight ? '#059669' : isPicked ? '#DC2626' : 'var(--color-border-medium)'}`,
                              background: isRight ? 'rgba(16, 185, 129, 0.1)' : isPicked ? 'rgba(239, 68, 68, 0.08)' : 'var(--color-white)', color: 'var(--color-deep-forest)' }}
                          >
                            <strong style={{ marginRight: '8px' }}>{LETTERS[oi]}.</strong>{opt}
                          </button>
                        );
                      })}
                    </div>
                    {a && (
                      <div data-testid="feedback" role="status" style={{ marginTop: '0.9rem', fontSize: '0.875rem', lineHeight: 1.55, color: a.isCorrect ? '#047857' : '#B91C1C' }}>
                        <strong>{a.isCorrect ? 'Correct.' : 'Not quite.'}</strong> {a.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ResumePracticePage;
