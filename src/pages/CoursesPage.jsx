import React, { useEffect, useMemo, useState } from 'react';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { Link } from 'react-router-dom';
import { Sidebar } from '../components/common/Sidebar';
import { Navbar } from '../components/common/Navbar';
import { Badge } from '../components/common/Badge';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingState } from '../components/common/LoadingState';
import { ProgressBar } from '../components/common/ProgressBar';
import { learningService } from '../services/learningService';
import { useAuth } from '../context/AuthContext';
import { Clock, Layers } from 'lucide-react';

const LEVELS = ['All', 'Beginner', 'Intermediate', 'Advanced'];
const select = { padding: '0.5rem 0.85rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border-medium)', backgroundColor: 'var(--color-ivory-soft)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-forest)' };

export const CoursesPage = () => {
  const { isAuthenticated, isStudent } = useAuth();
  const [courses, setCourses] = useState(null); // null = loading
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [progress, setProgress] = useState({});
  const [level, setLevel] = useState('All');
  const [skill, setSkill] = useState('All');

  useEffect(() => {
    let alive = true;
    setError('');
    learningService.getCourses().then((c) => alive && setCourses(c)).catch((err) => alive && setError(err?.message || 'Please try again.'));
    return () => { alive = false; };
  }, [reloadKey]);

  useEffect(() => {
    if (!isStudent) return;
    learningService.getMyCourses()
      .then((rows) => setProgress(Object.fromEntries(rows.map((r) => [r.courseSlug, r]))))
      .catch(() => setProgress({}));
  }, [isStudent]);

  const skills = useMemo(() => ['All', ...Array.from(new Set((courses || []).flatMap((c) => c.skills))).sort()], [courses]);
  const shown = (courses || []).filter((c) => (level === 'All' || c.level === level) && (skill === 'All' || c.skills.includes(skill)));

  return (
    <div className={isAuthenticated ? 'dashboard-layout' : ''} style={{ minHeight: '100vh', backgroundColor: 'var(--color-warm-ivory)' }}>
      {isAuthenticated ? <Sidebar /> : <Navbar />}
      <main className={isAuthenticated ? 'dashboard-main' : 'container-custom'} style={{ padding: isAuthenticated ? undefined : '3rem 1.5rem 5rem' }}>
        <div className="dashboard-content animate-fade-in" style={{ padding: isAuthenticated ? undefined : 0, maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ marginBottom: '1.75rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-emerald)' }}>✦ Learn</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem, 3.5vw, 2.6rem)', color: 'var(--color-deep-forest)', margin: '0.2rem 0 0' }}>Courses</h1>
            <p style={{ color: 'var(--color-charcoal-subtle)', maxWidth: '640px', marginTop: '4px' }}>
              Structured learning paths for placements. Mark modules as you finish them, and we use your progress to recommend what to study next.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-forest)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Level
              <select aria-label="Filter by level" value={level} onChange={(e) => setLevel(e.target.value)} style={select}>
                {LEVELS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </label>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-forest)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              Skill
              <select aria-label="Filter by skill" value={skill} onChange={(e) => setSkill(e.target.value)} style={select}>
                {skills.map((s) => <option key={s}>{s}</option>)}
              </select>
            </label>
          </div>

          {courses === null && !error && <LoadingState message="Loading courses..." subtitle="One moment" />}
          {error && <ErrorBanner title="Courses could not be loaded." message={error} onRetry={() => setReloadKey((k) => k + 1)} />}
          {courses !== null && courses.length === 0 && <EmptyState title="No courses yet" description="Courses appear here once they have been loaded into the database (python -m app.seed)." />}
          {courses !== null && courses.length > 0 && shown.length === 0 && <EmptyState title="No courses match these filters" description="Choose another level or skill." />}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))', gap: '1.25rem' }}>
            {shown.map((c) => {
              const p = progress[c.slug];
              return (
                <Link key={c.slug} to={`/courses/${c.slug}`} data-testid="course-card" style={{ textDecoration: 'none', minWidth: 0 }}>
                  <div className="card-static" style={{ height: '100%', padding: '1.5rem', backgroundColor: 'var(--color-white)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border-subtle)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
                      <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', color: 'var(--color-deep-forest)', margin: 0 }}>{c.title}</h3>
                      <Badge variant={c.level === 'Beginner' ? 'emerald' : c.level === 'Advanced' ? 'warning' : 'lime'} size="sm">{c.level}</Badge>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-charcoal-subtle)', lineHeight: 1.5 }}>{c.description}</p>
                    <div style={{ display: 'flex', gap: '14px', fontSize: '0.78rem', color: 'var(--color-muted-green)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Layers size={13} /> {c.modulesCount} modules</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Clock size={13} /> about {c.estimatedHours} h</span>
                    </div>
                    {c.skills.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                        {c.skills.slice(0, 6).map((s) => <span key={s} className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>{s}</span>)}
                      </div>
                    )}
                    {p && p.modulesDone.length > 0 && (
                      <div style={{ marginTop: 'auto' }}>
                        <ProgressBar value={p.percent} height="6px" />
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-muted-green)', marginTop: '4px' }}>{p.completed ? 'Completed' : `${p.modulesDone.length} of ${p.modulesTotal} modules done`}</div>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
};

export default CoursesPage;
