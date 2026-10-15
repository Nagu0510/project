import React, { useEffect, useState } from 'react';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { ProgressBar } from '../../components/common/ProgressBar';
import { useToast } from '../../context/ToastContext';
import { adminService } from '../../services/adminService';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { downloadFile } from '../../utils/download';
import { Search, Download } from 'lucide-react';

export const AdminStudentsPage = () => {
  const { addToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [students, setStudents] = useState(null); // null = loading
  const [failed, setFailed] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed('');
    adminService.getStudents()
      .then((rows) => alive && setStudents(Array.isArray(rows) ? rows : []))
      .catch((err) => { if (alive) { setFailed(err?.message || 'Please try again.'); setStudents([]); } });
    return () => { alive = false; };
  }, [reloadKey]);

  const term = searchTerm.toLowerCase();
  const filtered = (students || []).filter((s) =>
    [s.name, s.email, s.current_path].some((v) => (v || '').toLowerCase().includes(term))
  );

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadFile('/admin/students/export.csv', 'students.csv');
      addToast(`Exported ${(students || []).length} students`, 'success');
    } catch (err) {
      addToast(err?.message || 'The export failed. Please try again.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const status = (s) => {
    if (!s.has_data) return { label: 'No activity yet', variant: 'neutral' };
    if (!s.assessments_completed) return { label: 'Not assessed', variant: 'neutral' };
    if (s.readiness_score >= 85) return { label: 'Above 85%', variant: 'success' };
    if (s.readiness_score >= 70) return { label: '70% to 85%', variant: 'lime' };
    return { label: 'Below 70%', variant: 'warning' };
  };

  return (
    <div className="dashboard-layout">
      <AdminSidebar />

      <main className="dashboard-main">
        <div className="dashboard-content animate-fade-in">
          <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-emerald)', marginBottom: '0.4rem' }}>
                ✦ Student management
              </div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem, 4vw, 2.5rem)', color: 'var(--color-deep-forest)', margin: 0 }}>
                Registered Candidates
              </h1>
              <p style={{ fontSize: '1rem', color: 'var(--color-charcoal-subtle)', marginTop: '4px' }}>
                Real student accounts with their latest readiness score and assessment count.
              </p>
            </div>

            <Button variant="primary" size="md" icon={Download} onClick={exportCsv} disabled={!(students || []).length} loading={exporting} data-testid="export-csv">
              Export CSV (all students)
            </Button>
          </div>

          <div
            className="card-static"
            style={{ padding: '1rem 1.25rem', backgroundColor: 'var(--color-white)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border-subtle)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}
          >
            <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
              <Search size={16} color="var(--color-muted-green)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                aria-label="Search students"
                placeholder="Search name, email or career track..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%', padding: '0.55rem 1rem 0.55rem 2.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-medium)', fontSize: '0.875rem', outline: 'none' }}
              />
            </div>
            <span data-testid="student-count" style={{ fontSize: '0.85rem', color: 'var(--color-muted-green)', fontWeight: 600 }}>
              Showing {filtered.length} of {(students || []).length} students
            </span>
          </div>

          {failed && <ErrorBanner title="Students could not be loaded." message={failed} onRetry={() => setReloadKey((k) => k + 1)} />}
          {students === null && <LoadingState message="Loading students..." subtitle="One moment" />}
          {students !== null && !failed && filtered.length === 0 && (
            <EmptyState
              title={students.length === 0 ? 'No students have registered yet' : 'No students match your search'}
              description={students.length === 0 ? 'Accounts appear here as soon as students sign up.' : 'Try a different name, email or career track.'}
            />
          )}

          {filtered.length > 0 && (
            <div className="card-static" style={{ backgroundColor: 'var(--color-white)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border-subtle)', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.885rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', backgroundColor: 'rgba(6, 46, 37, 0.02)', color: 'var(--color-muted-green)', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      <th style={{ padding: '1rem 1.25rem' }}>Candidate</th>
                      <th style={{ padding: '1rem 1.25rem' }}>Career track</th>
                      <th style={{ padding: '1rem 1.25rem' }}>Readiness</th>
                      <th style={{ padding: '1rem 1.25rem' }}>Assessments</th>
                      <th style={{ padding: '1rem 1.25rem' }}>Attempts</th>
                      <th style={{ padding: '1rem 1.25rem' }}>Problems solved</th>
                      <th style={{ padding: '1rem 1.25rem' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((s) => {
                      const st = status(s);
                      return (
                        <tr key={s.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                          <td style={{ padding: '1rem 1.25rem' }}>
                            <div style={{ fontWeight: 700, color: 'var(--color-deep-forest)' }}>{s.name}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--color-muted-green)' }}>{s.email}</div>
                          </td>
                          <td style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--color-emerald)' }}>{s.current_path || 'Not chosen'}</td>
                          <td style={{ padding: '1rem 1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontWeight: 800, color: 'var(--color-deep-forest)' }}>{s.readiness_score}%</span>
                              <div style={{ width: '80px' }}><ProgressBar value={s.readiness_score} color="var(--color-emerald)" height="5px" /></div>
                            </div>
                          </td>
                          <td style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--color-deep-forest)' }}>{s.assessments_completed}</td>
                          <td data-testid="student-attempts" style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--color-deep-forest)' }}>{s.attempts}</td>
                          <td style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--color-deep-forest)' }}>{s.problems_solved}/{s.problems_attempted}</td>
                          <td style={{ padding: '1rem 1.25rem' }}><Badge variant={st.variant}>{st.label}</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminStudentsPage;
