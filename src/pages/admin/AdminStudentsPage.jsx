import React, { useState } from 'react';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { ProgressBar } from '../../components/common/ProgressBar';
import { useToast } from '../../context/ToastContext';
import { Users, Search, Award, Eye, Mail } from 'lucide-react';

export const AdminStudentsPage = () => {
  const { addToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  const mockStudents = [
    { id: 'std-1', name: 'Nagappa Gongadi', email: 'nagappa@skillsense.ai', path: 'Backend Developer', readiness: 87, assessments: 12, status: 'Placement Ready' },
    { id: 'std-2', name: 'Mallikarjun Pawale', email: 'mallikarjun@skillsense.ai', path: 'Full Stack Developer', readiness: 82, assessments: 10, status: 'Placement Ready' },
    { id: 'std-3', name: 'Prashant Chinnanagoudar', email: 'prashant@skillsense.ai', path: 'AI/ML Engineer', readiness: 79, assessments: 9, status: 'In Training' },
    { id: 'std-4', name: 'Darshan Tungal', email: 'darshan@skillsense.ai', path: 'Cloud Engineer', readiness: 75, assessments: 8, status: 'In Training' },
    { id: 'std-5', name: 'Ananya Sharma', email: 'ananya@skillsense.ai', path: 'Frontend Developer', readiness: 91, assessments: 15, status: 'Top Candidate' },
    { id: 'std-6', name: 'Rahul Verma', email: 'rahul@skillsense.ai', path: 'Data Analyst', readiness: 70, assessments: 6, status: 'Needs Support' },
  ];

  const filtered = mockStudents.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.path.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="dashboard-layout">
      <AdminSidebar />

      <main className="dashboard-main">
        <div className="dashboard-content animate-fade-in">
          <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--color-emerald)' }}>✦</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-emerald)' }}>
                  Student Candidate Management
                </span>
              </div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', color: 'var(--color-deep-forest)', margin: 0 }}>
                Registered Candidates
              </h1>
              <p style={{ fontSize: '1rem', color: 'var(--color-charcoal-subtle)', marginTop: '4px' }}>
                Track student learning roadmaps, career readiness metrics, and diagnostic evaluation performance.
              </p>
            </div>

            <Button variant="primary" size="md" onClick={() => addToast('Exported student dossier report', 'success')}>
              Export Candidate Roster
            </Button>
          </div>

          {/* Search Bar */}
          <div
            className="card-static"
            style={{
              padding: '1rem 1.25rem',
              backgroundColor: 'var(--color-white)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border-subtle)',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
              <Search size={16} color="var(--color-muted-green)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search candidate name or track..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem 1rem 0.55rem 2.25rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-medium)',
                  fontSize: '0.875rem',
                  outline: 'none',
                }}
              />
            </div>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-muted-green)', fontWeight: 600 }}>
              Showing {filtered.length} of {mockStudents.length} candidates
            </span>
          </div>

          {/* Students Table */}
          <div
            className="card-static"
            style={{
              backgroundColor: 'var(--color-white)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border-subtle)',
              overflow: 'hidden',
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.885rem' }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: '1px solid var(--color-border-subtle)',
                      backgroundColor: 'rgba(6, 46, 37, 0.02)',
                      color: 'var(--color-muted-green)',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                    }}
                  >
                    <th style={{ padding: '1rem 1.25rem' }}>Candidate</th>
                    <th style={{ padding: '1rem 1.25rem' }}>Target Career Track</th>
                    <th style={{ padding: '1rem 1.25rem' }}>Readiness Score</th>
                    <th style={{ padding: '1rem 1.25rem' }}>Assessments</th>
                    <th style={{ padding: '1rem 1.25rem' }}>Status</th>
                    <th style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr
                      key={s.id}
                      style={{ borderBottom: '1px solid var(--color-border-subtle)', transition: 'background-color 0.15s ease' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-ivory-surface)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ fontWeight: 700, color: 'var(--color-deep-forest)' }}>{s.name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-muted-green)' }}>{s.email}</div>
                      </td>
                      <td style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--color-emerald)' }}>
                        {s.path}
                      </td>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 800, color: 'var(--color-deep-forest)' }}>{s.readiness}%</span>
                          <div style={{ width: '80px' }}>
                            <ProgressBar value={s.readiness} color="var(--color-emerald)" height="5px" />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--color-deep-forest)' }}>
                        {s.assessments}
                      </td>
                      <td style={{ padding: '1rem 1.25rem' }}>
                        <Badge variant={s.readiness >= 85 ? 'success' : s.readiness >= 75 ? 'lime' : 'warning'}>
                          {s.status}
                        </Badge>
                      </td>
                      <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                        <Button variant="ghost" size="sm" icon={Eye} onClick={() => addToast(`Opening profile for ${s.name}`, 'info')}>
                          Inspect
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
