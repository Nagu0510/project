import { formatExamOrigin } from '../../utils/examOrigin';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import {
  FileSpreadsheet,
  Database,
  Users,
  FileCheck2,
  Building2,
  Sparkles,
  ArrowRight,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Repeat,
  BarChart3,
  Search,
} from 'lucide-react';
import { adminService } from '../../services/adminService';

const EmptyNote = ({ children }) => (
  <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-border-medium)', color: 'var(--text)', fontSize: '0.875rem', textAlign: 'center' }}>
    {children}
  </div>
);

export const AdminDashboardPage = () => {
  const [stats, setStats] = useState(null); // null = loading
  const [papers, setPapers] = useState(null);
  const [queue, setQueue] = useState(null);
  const [applications, setApplications] = useState(null);
  const [appSearch, setAppSearch] = useState('');
  const [failed, setFailed] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setFailed('');
    Promise.all([
      adminService.getDashboard(),
      adminService.getQuestionPapers(),
      adminService.getExtractedQuestions(null, { status: 'needs_review', pageSize: 100 }),
      adminService.getApplications(),
    ])
      .then(([s, p, q, apps]) => {
        if (!alive) return;
        setStats(s || {});
        setPapers(Array.isArray(p) ? p : []);
        setQueue((Array.isArray(q) ? q : []).filter((x) => x.status === 'needs_review'));
        setApplications(Array.isArray(apps) ? apps : []);
      })
      .catch((err) => {
        if (alive) {
          setFailed(err?.message || 'Please try again.');
          setStats({});
          setPapers([]);
          setQueue([]);
          setApplications([]);
        }
      });
    return () => { alive = false; };
  }, [reloadKey]);

  const filteredApplications = (applications || []).filter((app) => {
    if (!appSearch.trim()) return true;
    const term = appSearch.toLowerCase();
    return (
      (app.student_name || '').toLowerCase().includes(term) ||
      (app.student_email || '').toLowerCase().includes(term) ||
      (app.company || '').toLowerCase().includes(term) ||
      (app.role || '').toLowerCase().includes(term)
    );
  });

  const formatAppliedDate = (raw) => {
    if (!raw) return '—';
    try {
      const d = new Date(raw);
      return Number.isNaN(d.getTime()) ? raw : d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return raw;
    }
  };

  const n = (v) => (v ?? 0).toLocaleString();
  const adminStats = [
    { label: 'Question Papers', value: n(stats?.question_papers_count), sub: 'Uploaded & indexed', icon: FileSpreadsheet, color: 'var(--text)', link: '/admin/question-papers' },
    { label: 'Questions Extracted', value: n(stats?.extracted_questions_count), sub: 'In the review queue and bank', icon: Database, color: 'var(--accent)', link: '/admin/question-bank' },
    { label: 'Registered Students', value: n(stats?.total_students), sub: 'Student accounts', icon: Users, color: 'var(--accent)', link: '/admin/students' },
    { label: 'Assessments', value: n(stats?.active_assessments_count), sub: 'Available to students', icon: FileCheck2, color: 'var(--success-text)', link: '/admin/assessments' },
    { label: 'Placement Companies', value: n(stats?.verified_companies_count), sub: 'With uploaded papers', icon: Building2, color: 'var(--text)', link: '/admin/companies' },
    { label: 'Question Intelligence', value: n(stats?.repeated_patterns_count), sub: 'Repeated questions found', icon: Repeat, color: 'var(--warning-text)', link: '/admin/analytics' },
  ];

  return (
    <div className="dashboard-layout">
      <AdminSidebar />

      <main className="dashboard-main">
        <div className="dashboard-content animate-fade-in">
          {failed && <ErrorBanner title="The dashboard numbers could not be loaded." message={failed} onRetry={() => setReloadKey((k) => k + 1)} />}
          {/* Header */}
          <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--accent)' }}>✦</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent)' }}>
                  Platform Administration Console
                </span>
              </div>
              <h1
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 'clamp(2rem, 3.5vw, 2.75rem)',
                  color: 'var(--text)',
                  margin: 0,
                }}
              >
                Executive Intelligence Dashboard
              </h1>
              <p style={{ fontSize: '1rem', color: 'var(--text)', marginTop: '4px', maxWidth: '680px' }}>
                Monitor placement paper extraction pipelines, curate assessment question pools, and inspect cross-exam similarity intelligence.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <Link to="/admin/question-papers?tab=upload">
                <Button variant="lime" size="md" icon={Upload}>
                  Upload Question Paper ↗
                </Button>
              </Link>
              <Link to="/admin/question-bank">
                <Button variant="primary" size="md" icon={Database}>
                  Question Bank
                </Button>
              </Link>
            </div>
          </div>

          {/* =========================================================================
              6 ADMIN METRIC CARDS
              ========================================================================= */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1.25rem',
              marginBottom: '2.5rem',
            }}
          >
            {adminStats.map((stat, idx) => {
              const Icon = stat.icon;

              return (
                <Link
                  key={idx}
                  to={stat.link}
                  className="card-floating"
                  style={{
                    padding: '1.5rem',
                    backgroundColor: 'var(--surface)',
                    borderRadius: 'var(--radius-xl)',
                    border: '1px solid var(--color-border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    textDecoration: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted-green)' }}>
                      {stat.label}
                    </span>
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: 'var(--surface)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent)',
                      }}
                    >
                      <Icon size={16} />
                    </div>
                  </div>

                  <div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: '2.4rem', color: stat.color, lineHeight: 1 }}>
                      {stat.value}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-muted-green)', marginTop: '4px' }}>
                      {stat.sub}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* =========================================================================
              REVIEW QUEUE & RECENT UPLOADS GRID
              ========================================================================= */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {/* Recent Uploaded Papers */}
            <div
              className="card-static"
              style={{
                padding: '1.75rem',
                backgroundColor: 'var(--surface)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: 'var(--text)', margin: 0 }}>
                  Recent Question Papers
                </h3>
                <Link to="/admin/question-papers" style={{ fontSize: '0.825rem', color: 'var(--accent)', fontWeight: 700 }}>
                  Manage All →
                </Link>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {papers !== null && papers.length === 0 && <EmptyNote>No question papers uploaded yet.</EmptyNote>}
                {(papers ?? []).slice(0, 4).map((paper) => (
                  <div
                    key={paper.id}
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--color-border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.925rem', color: 'var(--text)' }}>
                        {formatExamOrigin(paper.company, paper.exam, paper.year)}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-muted-green)', marginTop: '2px' }}>
                        {paper.year} · {paper.questions_count ?? 0} questions · {paper.paper_type}
                      </div>
                    </div>

                    <Badge variant="neutral">{paper.status}</Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Questions Awaiting Approval */}
            <div
              className="card-static"
              style={{
                padding: '1.75rem',
                backgroundColor: 'var(--surface)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: 'var(--text)', margin: 0 }}>
                  Questions Review Queue
                </h3>
                <Link to="/admin/question-papers" style={{ fontSize: '0.825rem', color: 'var(--accent)', fontWeight: 700 }}>
                  Review All →
                </Link>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {queue !== null && queue.length === 0 && <EmptyNote>No questions are waiting for review.</EmptyNote>}
                {(queue ?? []).slice(0, 3).map((q, i) => (
                  <div
                    key={q.id}
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--color-border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--accent)' }}>
                        Question #{i + 1} ({q.topic})
                      </span>
                      <Badge variant="warning" size="sm">Needs review</Badge>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text)', fontWeight: 600, lineHeight: 1.4 }}>
                      {q.question_text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* =========================================================================
              STUDENT PLACEMENT APPLICATIONS SECTION
              ========================================================================= */}
          <div
            className="card-static"
            style={{
              padding: '1.75rem',
              backgroundColor: 'var(--surface)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border-subtle)',
              marginTop: '2rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: 'var(--text)', margin: 0 }}>
                  Student Placement Applications
                </h3>
                <p style={{ fontSize: '0.825rem', color: 'var(--color-muted-green)', marginTop: '2px', margin: 0 }}>
                  Review which students have applied to corporate hiring opportunities.
                </p>
              </div>

              {/* Search / Filter by student or company */}
              <div style={{ position: 'relative', minWidth: '260px' }}>
                <Search size={16} color="var(--color-muted-green)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Filter by student or company..."
                  value={appSearch}
                  onChange={(e) => setAppSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 1rem 0.5rem 2.25rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border-medium)',
                    backgroundColor: 'var(--surface)',
                    fontSize: '0.85rem',
                    color: 'var(--text)',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            {/* Applications Table */}
            {applications === null ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted-green)' }}>
                Loading applications...
              </div>
            ) : filteredApplications.length === 0 ? (
              <EmptyNote>
                {appSearch ? 'No applications match your filter.' : 'No applications submitted yet.'}
              </EmptyNote>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.885rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border-subtle)', color: 'var(--color-muted-green)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <th style={{ padding: '0.75rem 1rem' }}>Student</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Email</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Company & Role</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Applied Date</th>
                      <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApplications.map((app) => (
                      <tr key={app.id} style={{ borderBottom: '1px solid var(--color-border-subtle)', transition: 'background-color 0.15s ease' }}>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: 'var(--text)' }}>
                          {app.student_name || 'Student'}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--color-muted-green)' }}>
                          {app.student_email || '—'}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--text)' }}>
                          <strong>{app.company}</strong>
                          <div style={{ fontSize: '0.78rem', color: 'var(--color-muted-green)' }}>{app.role}</div>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: 'var(--color-muted-green)' }}>
                          {formatAppliedDate(app.applied_date || app.submitted_at)}
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <Badge variant="success" size="sm">
                            {app.status || 'Applied'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboardPage;
