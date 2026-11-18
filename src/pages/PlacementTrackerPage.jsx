import React, { useState, useEffect } from 'react';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { Sidebar } from '../components/common/Sidebar';
import { Navbar } from '../components/common/Navbar';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingState } from '../components/common/LoadingState';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { placementService } from '../services/placementService';
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

const formatDeadline = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const PlacementTrackerPage = () => {
  const { user, isAuthenticated, isAuthLoading, requireAuth } = useAuth();
  const { addToast } = useToast();
  const [selectedJob, setSelectedJob] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [appliedJobs, setAppliedJobs] = useState({});
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (isAuthLoading) return undefined;
    if (!isAuthenticated) { // placement drives are for signed-in students
      setLoading(false);
      return undefined;
    }
    let mounted = true;
    const fetchJobs = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const [data, myApps] = await Promise.all([
          placementService.getPlacementJobs(),
          placementService.getMyApplications().catch(() => []),
        ]);
        if (mounted) {
          setJobs(data || []);
          const map = {};
          (myApps || []).forEach((a) => {
            if (a.job_id) map[a.job_id] = true;
          });
          setAppliedJobs(map);
        }
      } catch (err) {
        if (mounted) setLoadError(err?.message || 'Please try again.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchJobs();
    return () => { mounted = false; };
  }, [isAuthenticated, isAuthLoading, reloadKey]);

  const filteredJobs = jobs.filter((job) => {
    return (
      job.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.role?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.requiredSkills || []).some((s) => s.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  const handleApply = (jobId, companyName) => {
    requireAuth(async () => {
      const job = jobs.find((j) => j.id === jobId);
      if (!job) return;

      if (appliedJobs[jobId]) {
        addToast('Already applied to this company.', 'warning');
        return;
      }

      if (job.eligibility && job.eligibility.state !== 'eligible') {
        addToast(`You are not eligible to apply: ${job.eligibility.message || 'Criteria not met.'}`, 'error');
        return;
      }

      setApplying(true);
      try {
        const res = await placementService.applyForJob(jobId);
        setAppliedJobs((prev) => ({ ...prev, [jobId]: true }));
        addToast(res?.message || `Application submitted successfully for ${job.role} at ${job.company}.`, 'success');
        setSelectedJob(null);
      } catch (err) {
        const status = err?.status || err?.response?.status;
        const msg = err?.message || err?.detail || 'Application failed.';
        if (status === 409 || msg.toLowerCase().includes('already applied')) {
          setAppliedJobs((prev) => ({ ...prev, [jobId]: true }));
          addToast('Already applied to this company.', 'warning');
        } else if (status === 403 || msg.toLowerCase().includes('ineligible') || msg.toLowerCase().includes('resume')) {
          addToast(msg, 'error');
        } else {
          addToast(msg, 'error');
        }
      } finally {
        setApplying(false);
      }
    }, '/placement-tracker');
  };

  return (
    <div className={isAuthenticated ? "dashboard-layout" : ""} style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      {isAuthenticated ? <Sidebar /> : <Navbar />}

      <main className={isAuthenticated ? "dashboard-main" : "container-custom"} style={{ padding: isAuthenticated ? undefined : '3rem 1.5rem 5rem' }}>
        <div className="dashboard-content animate-fade-in" style={{ padding: isAuthenticated ? undefined : 0 }}>
          {loadError && <ErrorBanner title="Placement drives could not be loaded." message={loadError} onRetry={() => setReloadKey((k) => k + 1)} />}
          {/* Guest Preview Banner */}
          {!isAuthenticated && (
            <div
              style={{
                backgroundColor: 'var(--lime-soft)',
                border: '1px solid var(--border)',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.885rem', color: 'var(--text)', fontWeight: 600 }}>
                <span style={{ color: 'var(--accent)' }}>✦</span>
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
                <span style={{ color: 'var(--accent)' }}>✦</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent)' }}>
                  Corporate Hiring Intelligence
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
                Placement Intelligence & Opportunities
              </h1>
              <p style={{ fontSize: '1rem', color: 'var(--text)', marginTop: '4px', maxWidth: '680px' }}>
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
                  backgroundColor: 'var(--surface)',
                  fontSize: '0.885rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* =========================================================================
              OPPORTUNITIES GRID
              ========================================================================= */}
          {loading && <LoadingState message="Loading placement drives..." subtitle="One moment" />}
          {!loading && !isAuthenticated && (
            <EmptyState
              title="Sign in to see placement drives"
              description="Placement drives are matched against your own skills, so you need to be signed in."
              actionText="Sign in"
              onAction={() => requireAuth(() => {}, '/placement-tracker')}
            />
          )}
          {!loading && isAuthenticated && filteredJobs.length === 0 && (
            <EmptyState
              title={jobs.length === 0 ? 'No placement drives yet' : 'No drives match your search'}
              description={jobs.length === 0 ? 'Open drives will appear here as soon as your placement office publishes them.' : 'Try a different company or skill.'}
            />
          )}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))',
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
                    backgroundColor: 'var(--surface)',
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
                            backgroundColor: 'var(--surface)',
                            border: '1px solid var(--color-border-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--accent)',
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
                              color: 'var(--text)',
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
                          backgroundColor: job.matchPercentage >= 90 ? 'var(--lime-soft)' : 'var(--accent-soft)',
                          color: 'var(--text)',
                          fontWeight: 800,
                          fontSize: '0.825rem',
                        }}
                      >
                        {job.matchKnown ? `${job.matchPercentage}% Match` : <span title="Take an assessment to see your match">No match yet</span>}
                      </div>
                    </div>

                    {/* Compensation & Deadline */}
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', fontSize: '0.825rem', color: 'var(--color-muted-green)' }}>
                      <span>Package: <strong style={{ color: 'var(--text)' }}>{job.package}</strong></span>
                      <span>·</span>
                      {job.deadline && <span>Deadline: <strong style={{ color: 'var(--warning-text)' }}>{formatDeadline(job.deadline)}</strong></span>}
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
                              backgroundColor: 'var(--surface)',
                              border: '1px solid var(--color-border-subtle)',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              color: 'var(--text)',
                            }}
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Eligibility from the student's own profile (CGPA, branch, graduation year) */}
                    {job.eligibility && (
                      <div
                        data-testid="eligibility"
                        data-state={job.eligibility.state}
                        style={{
                          marginBottom: '1rem', fontSize: '0.8rem', fontWeight: 600, padding: '6px 10px', borderRadius: 'var(--radius-md)',
                          color: job.eligibility.state === 'not_eligible' ? 'var(--danger-text)' : job.eligibility.state === 'unknown' ? 'var(--warning-text)' : 'var(--success-text)',
                          background: job.eligibility.state === 'not_eligible' ? 'var(--danger-soft)' : job.eligibility.state === 'unknown' ? 'var(--warning-soft)' : 'var(--success-soft)',
                        }}
                      >
                        {job.eligibility.message}
                        {job.eligibility.state === 'unknown' && <Link to="/profile" style={{ marginLeft: 8, color: 'inherit', textDecoration: 'underline' }}>Open profile</Link>}
                      </div>
                    )}

                    {/* Missing Skills Warning */}
                    {job.missingSkills && job.missingSkills.length > 0 && (
                      <div style={{ marginBottom: '1.25rem' }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--warning-text)', marginBottom: '4px' }}>
                          Missing Skill Gap
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {(job.missingSkills || []).map((s) => (
                            <span
                              key={s}
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                backgroundColor: 'var(--warning-soft)',
                                border: '1px solid var(--warning-border)',
                                padding: '2px 7px',
                                borderRadius: '4px',
                                color: 'var(--warning-text)',
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
                      {isApplied ? 'Applied' : job.status === 'published' ? 'Open' : job.status}
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
                backgroundColor: 'var(--surface)',
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
                <div style={{ fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: 'var(--accent)' }}>
                  {selectedJob.matchKnown ? `${selectedJob.matchPercentage}% Placement Fit` : 'No skills assessed yet'}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-muted-green)', fontWeight: 600 }}>
                  Batch Eligibility
                </div>
                <div style={{ fontWeight: 700, color: 'var(--text)' }}>
                  {selectedJob.hiringBatch}
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted-green)', marginBottom: '0.4rem' }}>
                Role Overview
              </div>
              <p style={{ fontSize: '0.9rem', color: 'var(--text)', lineHeight: 1.55, margin: 0 }}>
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
                variant={appliedJobs[selectedJob.id] ? "neutral" : (!selectedJob.eligibility || selectedJob.eligibility.state === "eligible") ? "lime" : "outline"}
                size="md"
                disabled={Boolean(appliedJobs[selectedJob.id]) || (selectedJob.eligibility && selectedJob.eligibility.state !== "eligible") || applying}
                onClick={() => {
                  handleApply(selectedJob.id, selectedJob.company);
                }}
              >
                {appliedJobs[selectedJob.id]
                  ? 'Applied'
                  : (selectedJob.eligibility && selectedJob.eligibility.state !== 'eligible')
                  ? 'Not Eligible to Apply'
                  : applying
                  ? 'Applying...'
                  : 'Apply Now ↗'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default PlacementTrackerPage;
