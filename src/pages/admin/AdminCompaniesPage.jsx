import React from 'react';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { mockCompaniesData } from '../../data/mockCompanies';
import { useToast } from '../../context/ToastContext';
import { Building2, Plus, ArrowRight, Layers, Briefcase } from 'lucide-react';
import { Link } from 'react-router-dom';

export const AdminCompaniesPage = () => {
  const { addToast } = useToast();
  const companies = Object.entries(mockCompaniesData);

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
                  Hiring Partners & Placement Profiles
                </span>
              </div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', color: 'var(--color-deep-forest)', margin: 0 }}>
                Corporate Placement Intelligence
              </h1>
              <p style={{ fontSize: '1rem', color: 'var(--color-charcoal-subtle)', marginTop: '4px' }}>
                Maintain verified recruitment drives, question distribution models, and candidate qualification bars.
              </p>
            </div>

            <Button variant="primary" size="md" icon={Plus} onClick={() => addToast('Add company profile dialog', 'info')}>
              Add Company Profile
            </Button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {companies.map(([key, comp]) => (
              <div
                key={key}
                className="card-static"
                style={{
                  padding: '1.75rem',
                  backgroundColor: 'var(--color-white)',
                  borderRadius: 'var(--radius-xl)',
                  border: '1px solid var(--color-border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '10px',
                          backgroundColor: 'var(--color-ivory-surface)',
                          border: '1px solid var(--color-border-subtle)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--color-emerald)',
                          fontWeight: 800,
                          fontSize: '1rem',
                        }}
                      >
                        {comp.shortName.charAt(0)}
                      </div>
                      <div>
                        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', color: 'var(--color-deep-forest)', margin: 0 }}>
                          {comp.shortName}
                        </h3>
                        <span style={{ fontSize: '0.78rem', color: 'var(--color-muted-green)' }}>
                          {comp.analyzedQuestionsCount} Questions Analyzed
                        </span>
                      </div>
                    </div>

                    <Badge variant="lime">Verified Drive</Badge>
                  </div>

                  <p style={{ fontSize: '0.85rem', color: 'var(--color-charcoal-subtle)', marginBottom: '1rem' }}>
                    {comp.tagline}
                  </p>

                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted-green)', marginBottom: '4px' }}>
                      Active Recruitment Drives
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {comp.activeDrives.map((d) => (
                        <span key={d} style={{ fontSize: '0.75rem', padding: '2px 7px', borderRadius: '4px', backgroundColor: 'var(--color-ivory-surface)', border: '1px solid var(--color-border-subtle)' }}>
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '0.85rem' }}>
                  <Link to={`/company-prep/${key}`}>
                    <Button variant="outline-emerald" size="sm" style={{ width: '100%' }} icon={ArrowRight} iconPosition="right">
                      View Intelligence Model
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};
