import React, { useEffect, useState } from 'react';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { LoadingState } from '../../components/common/LoadingState';
import { ProgressBar } from '../../components/common/ProgressBar';
import { Button } from '../../components/common/Button';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { ActivityChart, DistributionChart, StatCard, WeakestSkills } from '../../components/admin/AnalyticsCharts';
import { useToast } from '../../context/ToastContext';
import { downloadFile } from '../../utils/download';
import { adminService } from '../../services/adminService';
import { Download } from 'lucide-react';

const Panel = ({ title, children }) => (
  <div
    className="card-static"
    style={{ padding: '1.75rem', backgroundColor: 'var(--surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border-subtle)', minWidth: 0 }}
  >
    <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: 'var(--text)', margin: '0 0 1rem 0' }}>{title}</h3>
    {children}
  </div>
);

const Row = ({ label, value, percent, color }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '4px', fontSize: '0.85rem' }}>
      <span style={{ fontWeight: 600, color: 'var(--text)' }}>{label}</span>
      <span style={{ fontWeight: 700, color: 'var(--accent)', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
    <ProgressBar value={percent} color={color || 'var(--accent)'} height="6px" />
  </div>
);

export const AdminAnalyticsPage = () => {
  const [analytics, setAnalytics] = useState(null); // null = loading
  const [students, setStudents] = useState([]);
  const [failed, setFailed] = useState(false);
  const [exporting, setExporting] = useState('');
  const { addToast } = useToast();

  useEffect(() => {
    let alive = true;
    Promise.all([adminService.getAdminAnalytics(), adminService.getStudents()])
      .then(([a, s]) => { if (alive) { setAnalytics(a || {}); setStudents(Array.isArray(s) ? s : []); } })
      .catch(() => { if (alive) { setFailed(true); setAnalytics({}); } });
    return () => { alive = false; };
  }, []);

  const exportCsv = async (kind, endpoint, fallback) => {
    setExporting(kind);
    try {
      const name = await downloadFile(endpoint, fallback);
      addToast(`Downloaded ${name}`, 'success');
    } catch (err) {
      addToast(err?.status === 429 ? 'Too many exports. Wait a minute and try again.' : 'The export failed. Please try again.', 'error');
    } finally {
      setExporting('');
    }
  };

  // Cohort tiers are computed from the students who have taken at least one assessment
  const assessed = students.filter((s) => s.assessments_completed > 0);
  const tiers = [
    { label: 'Above 85% readiness', color: 'var(--success-text)', count: assessed.filter((s) => s.readiness_score > 85).length },
    { label: '70% to 85% readiness', color: 'var(--accent)', count: assessed.filter((s) => s.readiness_score >= 70 && s.readiness_score <= 85).length },
    { label: 'Below 70% readiness', color: 'var(--warning-text)', count: assessed.filter((s) => s.readiness_score < 70).length },
  ];
  const topics = analytics?.topic_frequencies || [];
  const topCount = Math.max(1, ...topics.map((t) => t.count));

  return (
    <div className="dashboard-layout">
      <AdminSidebar />

      <main className="dashboard-main">
        <div className="dashboard-content animate-fade-in">
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '0.4rem' }}>
              ✦ System-wide analytics
            </div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem, 4vw, 2.5rem)', color: 'var(--text)', margin: 0 }}>
              Question Recurrence & Placement Trends
            </h1>
            <p style={{ fontSize: '1rem', color: 'var(--text)', marginTop: '4px' }}>
              Computed from the published question bank and from your students' assessment results.
            </p>
          </div>

          {analytics !== null && !failed && (
            <>
              {analytics.demo_students_count > 0 && (
                <div role="note" data-testid="demo-note" style={{ background: 'var(--info-soft)', border: '1px solid var(--info-border)', color: 'var(--info-text)', borderRadius: 'var(--radius-md)', padding: '0.7rem 1rem', marginBottom: '1.25rem', fontSize: '0.85rem', fontWeight: 600 }}>
                  These numbers include {analytics.demo_students_count} demo students (fake data). Remove them with: python scripts/seed_demo_data.py --yes --reset
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                <Button variant="outline" size="sm" icon={Download} data-testid="export-students-csv" loading={exporting === 'students'} disabled={Boolean(exporting)} onClick={() => exportCsv('students', '/admin/students/export.csv', 'students.csv')}>
                  Export students (CSV)
                </Button>
                <Button variant="outline" size="sm" icon={Download} data-testid="export-results-csv" loading={exporting === 'results'} disabled={Boolean(exporting)} onClick={() => exportCsv('results', '/admin/assessment-results/export.csv', 'assessment-results.csv')}>
                  Export assessment results (CSV)
                </Button>
              </div>
              <div data-testid="analytics-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(210px, 100%), 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <StatCard testId="card-total" label="Total students" value={analytics.registered_students_count ?? 0} note={`${analytics.assessed_students_count ?? 0} have taken an assessment`} />
                <StatCard testId="card-active" label="Active in 7 days" value={analytics.active_students_7d ?? 0} note="An assessment or a submission" />
                <StatCard testId="card-readiness" label="Average readiness" value={`${analytics.average_readiness ?? 0}%`} note="Students who took an assessment" />
                <StatCard testId="card-assessments" label="Assessments taken" value={analytics.assessments_taken_count ?? 0} note={`${analytics.problems_solved_count ?? 0} problems solved`} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(380px, 100%), 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <Panel title="Readiness distribution">
                  <DistributionChart distribution={analytics.readiness_distribution} />
                </Panel>
                <Panel title="Weakest skills">
                  {(analytics.weakest_skills || []).length === 0
                    ? <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>No assessment results yet, so there is no ranking.</span>
                    : <WeakestSkills rows={analytics.weakest_skills} />}
                </Panel>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <Panel title="Activity over the last 30 days">
                  <ActivityChart rows={analytics.activity || []} />
                </Panel>
              </div>
            </>
          )}

          {analytics === null && <LoadingState message="Loading analytics..." subtitle="One moment" />}
          {failed && <ErrorBanner message="Analytics could not be loaded." onRetry={() => window.location.reload()} />}

          {analytics !== null && !failed && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: '1.5rem' }}>
              <Panel title="Recurrence by topic">
                {topics.length === 0 ? (
                  <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>No published questions yet, so there is nothing to count.</span>
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
                  <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>
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
