import React from 'react';
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
} from 'lucide-react';
import { initialMockPapers, initialMockExtractedQuestions } from '../../data/mockQuestionPapers';

export const AdminDashboardPage = () => {
  const adminStats = [
    { label: 'Question Papers', value: '46', sub: 'Uploaded & Indexed', icon: FileSpreadsheet, color: 'var(--color-deep-forest)', link: '/admin/question-papers' },
    { label: 'Questions Extracted', value: '2,840', sub: 'Indexed in Question Bank', icon: Database, color: 'var(--color-emerald)', link: '/admin/question-bank' },
    { label: 'Registered Students', value: '1,420', sub: 'Active Candidates', icon: Users, color: 'var(--color-dark-emerald)', link: '/admin/students' },
    { label: 'Active Assessments', value: '18', sub: 'Diagnostic Tracks', icon: FileCheck2, color: '#059669', link: '/admin/assessments' },
    { label: 'Placement Companies', value: '18', sub: 'Corporate Drives', icon: Building2, color: 'var(--color-deep-forest)', link: '/admin/companies' },
    { label: 'Question Intelligence', value: '367', sub: 'Repeated Patterns Found', icon: Repeat, color: '#D97706', link: '/admin/analytics' },
  ];

  return (
    <div className="dashboard-layout">
      <AdminSidebar />

      <main className="dashboard-main">
        <div className="dashboard-content animate-fade-in">
          {/* Header */}
          <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--color-emerald)' }}>✦</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-emerald)' }}>
                  Platform Administration Console
                </span>
              </div>
              <h1
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 'clamp(2rem, 3.5vw, 2.75rem)',
                  color: 'var(--color-deep-forest)',
                  margin: 0,
                }}
              >
                Executive Intelligence Dashboard
              </h1>
              <p style={{ fontSize: '1rem', color: 'var(--color-charcoal-subtle)', marginTop: '4px', maxWidth: '680px' }}>
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
                    backgroundColor: 'var(--color-white)',
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
                        backgroundColor: 'var(--color-ivory-surface)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--color-emerald)',
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
                backgroundColor: 'var(--color-white)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: 'var(--color-deep-forest)', margin: 0 }}>
                  Recent Question Papers
                </h3>
                <Link to="/admin/question-papers" style={{ fontSize: '0.825rem', color: 'var(--color-emerald)', fontWeight: 700 }}>
                  Manage All →
                </Link>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {initialMockPapers.slice(0, 4).map((paper) => (
                  <div
                    key={paper.id}
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-ivory-surface)',
                      border: '1px solid var(--color-border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.925rem', color: 'var(--color-deep-forest)' }}>
                        {paper.company} — {paper.exam}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-muted-green)', marginTop: '2px' }}>
                        {paper.year} · {paper.questions} Questions · {paper.type}
                      </div>
                    </div>

                    <Badge variant={paper.status}>{paper.status}</Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Questions Awaiting Approval */}
            <div
              className="card-static"
              style={{
                padding: '1.75rem',
                backgroundColor: 'var(--color-white)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: 'var(--color-deep-forest)', margin: 0 }}>
                  Questions Review Queue
                </h3>
                <Link to="/admin/question-papers" style={{ fontSize: '0.825rem', color: 'var(--color-emerald)', fontWeight: 700 }}>
                  Review All →
                </Link>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {initialMockExtractedQuestions.slice(0, 3).map((q) => (
                  <div
                    key={q.id}
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--color-ivory-surface)',
                      border: '1px solid var(--color-border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-emerald)' }}>
                        Question #{q.number} ({q.topic})
                      </span>
                      <Badge variant={q.status} size="sm">{q.status}</Badge>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-deep-forest)', fontWeight: 600, lineHeight: 1.4 }}>
                      {q.title}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
