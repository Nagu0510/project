import React, { useEffect, useState } from 'react';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { assessmentService } from '../../services/assessmentService';

export const AdminAssessmentsPage = () => {
  const [assessments, setAssessments] = useState(null); // null = loading
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoadError('');
    assessmentService.getAssessments()
      .then((rows) => alive && setAssessments(Array.isArray(rows) ? rows : []))
      .catch((err) => { if (alive) { setLoadError(err?.message || 'Please try again.'); setAssessments([]); } });
    return () => { alive = false; };
  }, [reloadKey]);

  return (
    <div className="dashboard-layout">
      <AdminSidebar />

      <main className="dashboard-main">
        <div className="dashboard-content animate-fade-in">
          {loadError && <ErrorBanner title="Assessments could not be loaded." message={loadError} onRetry={() => setReloadKey((k) => k + 1)} />}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-emerald)', marginBottom: '0.4rem' }}>
              ✦ Skill evaluation
            </div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem, 4vw, 2.5rem)', color: 'var(--color-deep-forest)', margin: 0 }}>
              Assessments Available to Students
            </h1>
            <p style={{ fontSize: '1rem', color: 'var(--color-charcoal-subtle)', marginTop: '4px' }}>
              The assessment sets students can take today. Creating and editing sets is not available yet.
            </p>
          </div>

          {assessments === null && <LoadingState message="Loading assessments..." subtitle="One moment" />}
          {assessments !== null && !loadError && assessments.length === 0 && (
            <EmptyState title="No assessments yet" description="Assessment sets appear here once they have been loaded into the database (python -m app.seed)." />
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {(assessments || []).map((asm) => (
              <div
                key={asm.id}
                className="card-static"
                style={{ padding: '1.5rem', backgroundColor: 'var(--color-white)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border-subtle)', minWidth: 0 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.3rem', color: 'var(--color-deep-forest)', margin: 0 }}>{asm.title}</h3>
                  <Badge variant={asm.difficulty === 'Hard' ? 'error' : asm.difficulty === 'Medium' ? 'warning' : 'success'}>{asm.difficulty}</Badge>
                </div>
                <div style={{ fontSize: '0.825rem', color: 'var(--color-muted-green)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <span>{asm.skill}</span>
                  <span>·</span>
                  <span>{asm.questions_count} questions</span>
                  <span>·</span>
                  <span>{asm.duration_minutes} minutes</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminAssessmentsPage;
