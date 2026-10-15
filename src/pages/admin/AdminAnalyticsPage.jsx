import React, { useEffect, useState } from 'react';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { ProgressBar } from '../../components/common/ProgressBar';
import { adminService } from '../../services/adminService';

const Panel = ({ title, children }) => (
  <div
    className="card-static"
    style={{ padding: '1.75rem', backgroundColor: 'var(--color-white)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border-subtle)', minWidth: 0 }}
  >
    <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: 'var(--color-deep-forest)', margin: '0 0 1rem 0' }}>{title}</h3>
    {children}
  </div>
);

const Row = ({ label, value, percent, color }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '4px', fontSize: '0.85rem' }}>
      <span style={{ fontWeight: 600, color: 'var(--color-deep-forest)' }}>{label}</span>
      <span style={{ fontWeight: 700, color: 'var(--color-emerald)', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
    <ProgressBar value={percent} color={color || 'var(--color-emerald)'} height="6px" />
  </div>
);

export const AdminAnalyticsPage = () => {
  const [analytics, setAnalytics] = useState(null); // null = loading
  const [students, setStudents] = useState([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([adminService.getAdminAnalytics(), adminService.getStudents()])
      .then(([a, s]) => { if (alive) { setAnalytics(a || {}); setStudents(Array.isArray(s) ? s : []); } })
      .catch(() => { if (alive) { setFailed(true); setAnalytics({}); } });
    return () => { alive = false; };
  }, []);

  // Cohort tiers are computed from the students who have taken at least one assessment
  const assessed = students.filter((s) => s.assessments_completed > 0);
  const tiers = [
    { label: 'Above 85% readiness', color: '#10B981', count: assessed.filter((s) => s.readiness_score > 85).length },
    { label: '70% to 85% readiness', color: 'var(--color-emerald)', count: assessed.filter((s) => s.readiness_score >= 70 && s.readiness_score <= 85).length },
    { label: 'Below 70% readiness', color: '#F59E0B', count: assessed.filter((s) => s.readiness_score < 70).length },
  ];
  const topics = analytics?.topic_frequencies || [];
  const topCount = Math.max(1, ...topics.map((t) => t.count));

  return (
    <div className="dashboard-layout">
      <AdminSidebar />

      <main className="dashboard-main">
        <div className="dashboard-content animate-fade-in">
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-emerald)', marginBottom: '0.4rem' }}>
              ✦ System-wide analytics
            </div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem, 4vw, 2.5rem)', color: 'var(--color-deep-forest)', margin: 0 }}>
              Question Recurrence & Placement Trends
            </h1>
            <p style={{ fontSize: '1rem', color: 'var(--color-charcoal-subtle)', marginTop: '4px' }}>
              Computed from the published question bank and from your students' assessment results.
            </p>
          </div>

          {analytics === null && <LoadingState message="Loading analytics..." subtitle="One moment" />}
          {failed && <EmptyState title="Analytics are unavailable right now" description="They could not be loaded. Refresh to try again." />}

          {analytics !== null && !failed && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: '1.5rem' }}>
              <Panel title="Recurrence by topic">
                {topics.length === 0 ? (
                  <span style={{ color: 'var(--color-charcoal-subtle)', fontSize: '0.9rem' }}>No published questions yet, so there is nothing to count.</span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {topics.map((t) => (
                      <Row key={t.topic} label={t.topic} value={`${t.count} ${t.count === 1 ? 'question' : 'questions'}`} percent={(t.count / topCount) * 100} />
                    ))}
                  </div>
                )}
              </Panel>

              <Panel title="Student preparedness">
                {assessed.length === 0 ? (
                  <span style={{ color: 'var(--color-charcoal-subtle)', fontSize: '0.9rem' }}>
                    No student has taken an assessment yet ({analytics.registered_students_count ?? 0} registered).
                  </span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {tiers.map((t) => (
                      <Row key={t.label} label={t.label} color={t.color} percent={Math.round((t.count / assessed.length) * 100)}
                        value={`${Math.round((t.count / assessed.length) * 100)}% (${t.count} ${t.count === 1 ? 'student' : 'students'})`} />
                    ))}
                    <div style={{ fontSize: '0.825rem', color: 'var(--color-muted-green)' }}>
                      Average readiness of assessed students: <strong>{analytics.average_readiness_score ?? 0}%</strong>
                    </div>
                  </div>
                )}
              </Panel>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminAnalyticsPage;
