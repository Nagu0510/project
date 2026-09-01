import React, { useState } from 'react';
import { Sidebar } from '../components/common/Sidebar';
import { Navbar } from '../components/common/Navbar';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { mockPlacementJobs } from '../data/mockPlacementJobs';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Briefcase,
  Building2,
  MapPin,
  Clock,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Search,
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const PlacementTrackerPage = () => {
  const { user, isAuthenticated, requireAuth } = useAuth();
  const { addToast } = useToast();
  const [selectedJob, setSelectedJob] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedJobs, setAppliedJobs] = useState({});

  const filteredJobs = mockPlacementJobs.filter((job) => {
    return (
      job.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.role?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.requiredSkills || []).some((s) => s.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  const handleApply = (jobId, companyName) => {
    requireAuth(() => {
      setAppliedJobs((prev) => ({ ...prev, [jobId]: true }));
      addToast(`Application simulated for ${companyName}! Status: Applied.`, 'success');
    }, '/placement-tracker');
  };

  return (
    <div className={isAuthenticated ? "dashboard-layout" : ""} style={{ minHeight: '100vh', backgroundColor: 'var(--color-warm-ivory)' }}>
      {isAuthenticated ? <Sidebar /> : <Navbar />}

      <main className={isAuthenticated ? "dashboard-main" : "container-custom"} style={{ padding: isAuthenticated ? undefined : '3rem 1.5rem 5rem' }}>
        <div className="dashboard-content animate-fade-in" style={{ padding: isAuthenticated ? undefined : 0 }}>
          {/* Guest Preview Banner */}
          {!isAuthenticated && (
            <div
              style={{
                backgroundColor: 'var(--color-lime-soft)',
                border: '1px solid rgba(6, 46, 37, 0.1)',
                borderRadius: 'var(--radius-lg)',
                padding: '0.85rem 1.25rem',
                marginBottom: '2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.885rem', color: 'var(--color-deep-forest)', fontWeight: 600 }}>
                <span style={{ color: 'var(--color-emerald)' }}>✦</span>
                <span><strong>Placement Intelligence Preview:</strong> Explore active hiring drives and match criteria. Sign in to apply and track your compatibility.</span>
              </div>
              <Button variant="primary" size="sm" onClick={() => requireAuth(null, '/placement-tracker')}>
                Sign In to Apply →
              </Button>
            </div>
          )}

          {/* Header */}
          <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.25rem' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--color-emerald)' }}>✦</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-emerald)' }}>
                  Corporate Hiring Intelligence
                </span>
                {!isAuthenticated && <Badge variant="lime" size="sm">Sample Matches</Badge>}
              </div>
              <h1
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 'clamp(2rem, 3.5vw, 2.75rem)',
                  color: 'var(--color-deep-forest)',
                  margin: 0,
                }}
              >
                Placement Intelligence & Opportunities
              </h1>
              <p style={{ fontSize: '1rem', color: 'var(--color-charcoal-subtle)', marginTop: '4px', maxWidth: '680px' }}>
                Real-time matching against active campus recruitment drives and corporate hiring pipelines.
              </p>
            </div>

            {/* Search Bar */}
            <div style={{ position: 'relative', minWidth: '280px' }}>
              <Search size={16} color="var(--color-muted-green)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search company or skill..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.65rem 1rem 0.65rem 2.25rem',
                  borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--color-border-medium)',
                  backgroundColor: 'var(--color-white)',
                  fontSize: '0.885rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* =========================================================================
              OPPORTUNITIES GRID
              ========================================================================= */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {filteredJobs.map((job) => {
              const isApplied = appliedJobs[job.id];

              return (
                <div
                  key={job.id}
                  className="card-floating"
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
                    {/* Top Row: Company & Match Badge */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '40px',
                            height: '40px',
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
                          {job.company.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--color-muted-green)', fontWeight: 600 }}>
                            {job.company}
                          </div>
                          <h3
                            style={{
                              fontSize: '1.25rem',
                              fontFamily: 'var(--font-serif)',
                              color: 'var(--color-deep-forest)',
                              margin: 0,
                            }}
                          >
                            {job.role}
                          </h3>
                        </div>
                      </div>

                      <div
                        style={{
                          padding: '4px 10px',
                          borderRadius: 'var(--radius-full)',
                          backgroundColor: job.matchPercentage >= 90 ? 'var(--color-lime-soft)' : 'rgba(15, 118, 110, 0.1)',
                          color: 'var(--color-deep-forest)',
                          fontWeight: 800,
                          fontSize: '0.825rem',
                        }}
                      >
                        {job.matchPercentage}% Match
                      </div>
                    </div>

                    {/* Compensation & Deadline */}
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', fontSize: '0.825rem', color: 'var(--color-muted-green)' }}>
                      <span>Package: <strong style={{ color: 'var(--color-deep-forest)' }}>{job.package}</strong></span>
                      <span>·</span>
                      <span>Deadline: <strong style={{ color: '#D97706' }}>{job.deadline}</strong></span>
                    </div>

                    {/* Required Skills */}
                    <div style={{ marginBottom: '0.85rem' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted-green)', marginBottom: '4px' }}>
                        Required Skills
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {(job.requiredSkills || []).map((s) => (
                          <span
                            key={s}
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              backgroundColor: 'var(--color-ivory-surface)',
                              border: '1px solid var(--color-border-subtle)',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              color: 'var(--color-deep-forest)',
                            }}
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Missing Skills Warning */}
                    {job.missingSkills && job.missingSkills.length > 0 && (
                      <div style={{ marginBottom: '1.25rem' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: '#D97706', marginBottom: '4px' }}>
                          Missing Skill Gap
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {(job.missingSkills || []).map((s) => (
                            <span
                              key={s}
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                backgroundColor: '#FFFBEB',
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                                padding: '2px 7px',
                                borderRadius: '4px',
                                color: '#92400E',
                              }}
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions Row */}
                  <div
                    style={{
                      borderTop: '1px solid var(--color-border-subtle)',
                      paddingTop: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                    }}
                  >
                    <Badge variant={isApplied ? 'success' : job.status === 'Ready to Apply' ? 'lime' : 'neutral'}>
                      {isApplied ? 'Applied' : job.status}
                    </Badge>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setSelectedJob(job)}
                      icon={ArrowRight}
                      iconPosition="right"
                    >
                      View Opportunity
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Opportunity Details Modal */}
      {selectedJob && (
        <Modal
          isOpen={Boolean(selectedJob)}
          onClose={() => setSelectedJob(null)}
          title={`${selectedJob.company} — ${selectedJob.role}`}
          subtitle={`${selectedJob.package} · ${selectedJob.location}`}
          maxWidth="620px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div
              style={{
                padding: '1rem',
                backgroundColor: 'var(--color-ivory-surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-muted-green)', fontWeight: 600 }}>
                  Match Assessment
                </div>
                <div style={{ fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: 'var(--color-emerald)' }}>
                  {selectedJob.matchPercentage}% Placement Fit
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-muted-green)', fontWeight: 600 }}>
                  Batch Eligibility
                </div>
                <div style={{ fontWeight: 700, color: 'var(--color-deep-forest)' }}>
                  {selectedJob.hiringBatch}
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted-green)', marginBottom: '0.4rem' }}>
                Role Overview
              </div>
              <p style={{ fontSize: '0.9rem', color: 'var(--color-charcoal-subtle)', lineHeight: 1.55, margin: 0 }}>
                {selectedJob.description}
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
              <Button
                variant="outline-emerald"
                size="md"
                onClick={() => {
                  setSelectedJob(null);
                  requireAuth(null, '/practice');
                }}
              >
                Practice Company Questions
              </Button>
              <Button
                variant="lime"
                size="md"
                onClick={() => {
                  handleApply(selectedJob.id, selectedJob.company);
                  setSelectedJob(null);
                }}
              >
                {appliedJobs[selectedJob.id] ? 'Already Applied' : 'Apply Now ↗'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
