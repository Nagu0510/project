import React, { useEffect, useState } from 'react';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { Link, useParams } from 'react-router-dom';
import { Sidebar } from '../components/common/Sidebar';
import { Navbar } from '../components/common/Navbar';
import { Badge } from '../components/common/Badge';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingState } from '../components/common/LoadingState';
import { ProgressBar } from '../components/common/ProgressBar';
import { learningService } from '../services/learningService';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Check, ExternalLink } from 'lucide-react';

const box = { backgroundColor: 'var(--color-white)', borderRadius: 'var(--radius-xl)', padding: '1.5rem', border: '1px solid var(--color-border-subtle)', minWidth: 0 };
const h3 = { fontFamily: 'var(--font-serif)', fontSize: '1.25rem', color: 'var(--color-deep-forest)', margin: '0 0 0.9rem' };

export const CourseDetailPage = () => {
  const { slug } = useParams();
  const { isAuthenticated, isStudent, requireAuth } = useAuth();
  const { addToast } = useToast();
  const [course, setCourse] = useState(null);
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [done, setDone] = useState([]);
  const [sets, setSets] = useState([]);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    let alive = true;
    setCourse(null);
    setMissing(false);
    setLoadError('');
    learningService.getCourse(slug).then((c) => alive && setCourse(c)).catch((err) => { if (!alive) return; if (err?.status === 404) setMissing(true); else setLoadError(err?.message || 'Please try again.'); });
    api.get('/assessments').then((all) => alive && setSets(all || [])).catch(() => setSets([]));
    return () => { alive = false; };
  }, [slug, reloadKey]);

  useEffect(() => {
    if (!isStudent) { setDone([]); return; }
    learningService.getMyCourses().then((rows) => setDone(rows.find((r) => r.courseSlug === slug)?.modulesDone || [])).catch(() => setDone([]));
  }, [isStudent, slug]);

  const toggle = (module) => requireAuth(async () => {
    setBusy(module.id);
    try {
      const wasDone = done.includes(module.id);
      const result = await learningService.markModule(slug, module.id, !wasDone);
      setDone(result.modulesDone);
      if (result.completed) addToast(`You finished ${course.title}!`, 'success');
    } catch (err) {
      addToast(err?.message || 'Could not save your progress.', 'error');
    } finally {
      setBusy(null);
    }
  }, `/courses/${slug}`);

  // sets built for this course, plus older sets that test the skills it teaches
  const courseSets = course ? sets.filter((s) => s.course_slug === slug || (!s.course_slug && !s.company && course.assessmentSkills.includes(s.skill))) : [];
  const percent = course && course.modules.length ? Math.round((100 * done.length) / course.modules.length) : 0;

  return (
    <div className={isAuthenticated ? 'dashboard-layout' : ''} style={{ minHeight: '100vh', backgroundColor: 'var(--color-warm-ivory)' }}>
      {isAuthenticated ? <Sidebar /> : <Navbar />}
      <main className={isAuthenticated ? 'dashboard-main' : 'container-custom'} style={{ padding: isAuthenticated ? undefined : '3rem 1.5rem 5rem' }}>
        <div className="dashboard-content animate-fade-in" style={{ padding: isAuthenticated ? undefined : 0, maxWidth: '960px', margin: '0 auto' }}>
          <Link to="/courses" style={{ fontSize: '0.85rem', color: 'var(--color-emerald)', fontWeight: 700 }}>← All courses</Link>

          {loadError && <ErrorBanner title="This course could not be loaded." message={loadError} onRetry={() => setReloadKey((k) => k + 1)} />}
          {!course && !missing && !loadError && <LoadingState message="Loading course..." subtitle="One moment" />}
          {missing && <EmptyState title="Course not found" description="It may have been removed. Browse the catalog to pick another." />}

          {course && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
              <div style={box}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                  <Badge variant="emerald" size="sm">{course.level}</Badge>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-muted-green)' }}>{course.modules.length} modules · about {course.estimatedHours} hours</span>
                </div>
                <h1 data-testid="course-title" style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', color: 'var(--color-deep-forest)', margin: '0 0 0.5rem' }}>{course.title}</h1>
                <p style={{ margin: '0 0 1rem', color: 'var(--color-charcoal-subtle)', lineHeight: 1.6 }}>{course.description}</p>
                {isStudent && (
                  <div data-testid="course-progress" data-percent={percent}>
                    <ProgressBar value={percent} height="8px" />
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-muted-green)', marginTop: '4px' }}>{done.length} of {course.modules.length} modules done ({percent}%)</div>
                  </div>
                )}
                {!isAuthenticated && <p style={{ fontSize: '0.85rem', color: 'var(--color-muted-green)', margin: 0 }}>Sign in to mark modules done and get recommendations.</p>}
                {course.prerequisites.length > 0 && (
                  <p style={{ fontSize: '0.85rem', margin: '0.75rem 0 0' }}>
                    <strong>Before you start:</strong>{' '}
                    {course.prerequisites.map((p, i) => <span key={p}>{i > 0 && ', '}<Link to={`/courses/${p}`} style={{ color: 'var(--color-emerald)' }}>{p.replace(/-/g, ' ')}</Link></span>)}
                  </p>
                )}
              </div>

              <div style={box}>
                <h3 style={h3}>Modules</h3>
                <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {course.modules.map((m, i) => {
                    const isDone = done.includes(m.id);
                    return (
                      <li key={m.id} data-testid="module" data-done={isDone} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '0.85rem 1rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-subtle)', background: isDone ? 'var(--color-lime-soft)' : 'var(--color-ivory-surface)' }}>
                        <button
                          type="button" role="checkbox" aria-checked={isDone} aria-label={`Mark "${m.title}" ${isDone ? 'not done' : 'done'}`}
                          data-testid="module-toggle" disabled={busy === m.id} onClick={() => toggle(m)}
                          style={{ width: '26px', height: '26px', flexShrink: 0, borderRadius: '8px', border: '2px solid var(--color-emerald)', background: isDone ? 'var(--color-emerald)' : 'var(--color-white)', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                        >
                          {isDone && <Check size={16} />}
                        </button>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: 'var(--color-deep-forest)' }}>{i + 1}. {m.title} <span style={{ fontWeight: 500, fontSize: '0.78rem', color: 'var(--color-muted-green)' }}>({m.hours} h)</span></div>
                          <div style={{ fontSize: '0.82rem', color: 'var(--color-charcoal-subtle)', lineHeight: 1.5 }}>{m.topics.join(' · ')}</div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: '1.5rem' }}>
                <div style={box}>
                  <h3 style={h3}>What you will be able to do</h3>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', lineHeight: 1.7, fontSize: '0.9rem' }}>{course.outcomes.map((o) => <li key={o}>{o}</li>)}</ul>
                  {course.skills.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '1rem' }}>
                      {course.skills.map((s) => <span key={s} className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>{s}</span>)}
                    </div>
                  )}
                </div>
                <div style={box}>
                  <h3 style={h3}>Practise it</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-charcoal-subtle)', marginTop: 0 }}>Topics: {course.practiceTopics.join(', ')}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.875rem' }}>
                    {courseSets.map((s) => <Link key={s.id} to="/assessment" style={{ color: 'var(--color-emerald)', fontWeight: 600 }}>{s.title} ({s.questions_count} questions) →</Link>)}
                    <Link to="/practice" style={{ color: 'var(--color-emerald)', fontWeight: 600 }}>Coding practice →</Link>
                  </div>
                </div>
              </div>

              <div style={box}>
                <h3 style={h3}>Where to learn</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-muted-green)', marginTop: '-0.5rem' }}>These open each provider's official site. Search there for the topics above.</p>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {course.resources.map((r) => (
                    <li key={r.url}>
                      <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-emerald)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {r.provider} <ExternalLink size={13} />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default CourseDetailPage;
