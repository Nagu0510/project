import React, { useState, useEffect } from 'react';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Input } from '../../components/common/Input';
import { placementService } from '../../services/placementService';
import { useToast } from '../../context/ToastContext';
import { Building2, Plus, Trash2, Edit3, ArrowRight, Layers, Briefcase } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';

export const AdminCompaniesPage = () => {
  const { addToast } = useToast();
  const [placements, setPlacements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    company: '',
    role: '',
    package: '',
    location: '',
    deadline: '',
    hiring_batch: '',
    required_skills: '',
    description: '',
    status: 'published',
    minimum_cgpa: '',
    eligible_branches: '',
    graduation_year: '',
  });

  const loadPlacements = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await placementService.getPlacementJobs();
      setPlacements(data || []);
    } catch (err) {
      setLoadError(err?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlacements();
  }, [reloadKey]);

  const handleOpenCreate = () => {
    setEditingJob(null);
    setFormData({
      company: '',
      role: '',
      package: '',
      location: '',
      deadline: '',
      hiring_batch: '',
      required_skills: '',
      description: '',
      status: 'published',
      minimum_cgpa: '',
      eligible_branches: '',
      graduation_year: '',
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (job) => {
    setEditingJob(job);
    setFormData({
      company: job.company || '',
      role: job.role || '',
      package: job.package || '',
      location: job.location || '',
      deadline: job.deadline || '',
      hiring_batch: job.hiringBatch || job.hiring_batch || '',
      required_skills: (job.requiredSkills || job.required_skills || []).join(', '),
      description: job.description || '',
      status: ['draft', 'published', 'closed'].includes(job.status) ? job.status : 'published',
      minimum_cgpa: job.minimumCgpa ?? '',
      eligible_branches: (job.eligibleBranches || []).join(', '),
      graduation_year: job.graduationYear ?? '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const skillsArray = formData.required_skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = {
        company: formData.company.trim(),
        role: formData.role.trim(),
        package: formData.package.trim(),
        location: formData.location.trim(),
        deadline: formData.deadline.trim(),
        hiring_batch: formData.hiring_batch.trim(),
        required_skills: skillsArray,
        description: formData.description.trim() || `${formData.company} hiring drive for ${formData.role}`,
        status: formData.status,
        minimum_cgpa: formData.minimum_cgpa === '' ? null : Number(formData.minimum_cgpa),
        eligible_branches: formData.eligible_branches.split(',').map((b) => b.trim()).filter(Boolean),
        graduation_year: formData.graduation_year === '' ? null : Number(formData.graduation_year),
      };

      if (editingJob) {
        await placementService.updatePlacementJob(editingJob.id, payload);
        addToast(`Placement drive for ${payload.company} updated in MongoDB!`, 'success');
      } else {
        await placementService.createPlacementJob(payload);
        addToast(`New Placement drive for ${payload.company} created in MongoDB!`, 'success');
      }

      setModalOpen(false);
      loadPlacements();
    } catch (err) {
      addToast(`Operation failed: ${err.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (jobId, companyName) => {
    if (!window.confirm(`Are you sure you want to delete placement drive for ${companyName}?`)) return;
    try {
      await placementService.deletePlacementJob(jobId);
      addToast(`Placement drive deleted from MongoDB.`, 'info');
      loadPlacements();
    } catch (err) {
      addToast(`Delete failed: ${err.message}`, 'error');
    }
  };

  return (
    <div className="dashboard-layout">
      <AdminSidebar />

      <main className="dashboard-main">
        <div className="dashboard-content animate-fade-in">
          {loadError && <ErrorBanner title="Placement drives could not be loaded." message={loadError} onRetry={() => setReloadKey((k) => k + 1)} />}
          <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--color-emerald)' }}>✦</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-emerald)' }}>
                  Hiring Partners & Placement Profiles
                </span>
              </div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', color: 'var(--color-deep-forest)', margin: 0 }}>
                Corporate Placement Intelligence & Drives
              </h1>
              <p style={{ fontSize: '1rem', color: 'var(--color-charcoal-subtle)', marginTop: '4px' }}>
                Maintain verified recruitment drives, publish job opportunities, and update student qualification criteria in MongoDB.
              </p>
            </div>

            <Button variant="primary" size="md" icon={Plus} onClick={handleOpenCreate}>
              Create Placement Drive ↗
            </Button>
          </div>

          {loading && placements.length === 0 && <LoadingState message="Loading placement drives..." subtitle="One moment" />}
          {!loading && !loadError && placements.length === 0 && (
            <EmptyState title="No placement drives yet" description="Create the first drive and students will see it with their own match score." />
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
            {placements.map((job) => (
              <div
                key={job.id}
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
                        {job.company.charAt(0)}
                      </div>
                      <div>
                        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', color: 'var(--color-deep-forest)', margin: 0 }}>
                          {job.company}
                        </h3>
                        <span style={{ fontSize: '0.78rem', color: 'var(--color-muted-green)' }}>
                          {job.role}
                        </span>
                      </div>
                    </div>

                    <Badge variant="lime">{job.status || 'Active Drive'}</Badge>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--color-muted-green)', marginBottom: '0.75rem' }}>
                    Package: <strong style={{ color: 'var(--color-deep-forest)' }}>{job.package}</strong> · Batch: {job.hiringBatch || job.hiring_batch}
                  </div>

                  <p style={{ fontSize: '0.85rem', color: 'var(--color-charcoal-subtle)', marginBottom: '1rem', lineHeight: 1.4 }}>
                    {job.description}
                  </p>

                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted-green)', marginBottom: '4px' }}>
                      Required Skills
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {(job.requiredSkills || job.required_skills || []).map((s) => (
                        <span key={s} style={{ fontSize: '0.75rem', padding: '2px 7px', borderRadius: '4px', backgroundColor: 'var(--color-ivory-surface)', border: '1px solid var(--color-border-subtle)' }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '0.85rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <Button variant="outline" size="sm" icon={Edit3} onClick={() => handleOpenEdit(job)}>
                    Edit
                  </Button>
                  <Button variant="outline-emerald" size="sm" icon={Trash2} onClick={() => handleDelete(job.id, job.company)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Admin Create / Edit Placement Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingJob ? `Edit Placement Drive — ${editingJob.company}` : 'Create Corporate Placement Drive'}
        subtitle="Saved directly to MongoDB and instantly visible to eligible students."
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Input
            label="Company Name"
            placeholder="e.g. Google India, TCS, Infosys"
            value={formData.company}
            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
            required
          />

          <Input
            label="Job Role Title"
            placeholder="e.g. Software Engineer, Systems Engineer"
            value={formData.role}
            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            required
          />

          <Input
            label="Salary Package"
            placeholder="e.g. ₹9.5 LPA"
            value={formData.package}
            onChange={(e) => setFormData({ ...formData, package: e.target.value })}
            required
          />

          <Input
            label="Location"
            placeholder="e.g. Bangalore / Hyderabad / Hybrid"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            required
          />

          <Input
            label="Application Deadline"
            type="date"
            placeholder="e.g. April 30, 2026"
            value={formData.deadline}
            onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
            required
          />

          <Input
            label="Hiring Batch"
            placeholder="e.g. 2025 & 2026 Batch"
            value={formData.hiring_batch}
            onChange={(e) => setFormData({ ...formData, hiring_batch: e.target.value })}
            required
          />

          <Input
            label="Required Skills (comma separated)"
            placeholder="Python, SQL, REST APIs, System Design"
            value={formData.required_skills}
            onChange={(e) => setFormData({ ...formData, required_skills: e.target.value })}
            required
          />

          <Input
            label="Minimum CGPA (optional)"
            type="number"
            step="0.1"
            min="0"
            max="10"
            placeholder="e.g. 6.5"
            data-testid="placement-min-cgpa"
            value={formData.minimum_cgpa}
            onChange={(e) => setFormData({ ...formData, minimum_cgpa: e.target.value })}
          />

          <Input
            label="Eligible branches (comma separated, optional)"
            placeholder="Computer Science, IT"
            value={formData.eligible_branches}
            onChange={(e) => setFormData({ ...formData, eligible_branches: e.target.value })}
          />

          <Input
            label="Graduation year (optional)"
            type="number"
            min="2000"
            max="2040"
            placeholder="2027"
            value={formData.graduation_year}
            onChange={(e) => setFormData({ ...formData, graduation_year: e.target.value })}
          />

          <div>
            <label htmlFor="placement-status" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-deep-forest)', marginBottom: '0.4rem', display: 'block' }}>
              Status
            </label>
            <select
              id="placement-status"
              data-testid="placement-status"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-medium)', fontSize: '0.9rem' }}
            >
              <option value="draft">Draft (hidden from students)</option>
              <option value="published">Published (students are told)</option>
              <option value="closed">Closed (hidden from students)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-deep-forest)', marginBottom: '0.4rem', display: 'block' }}>
              Role Overview / Description
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Provide drive overview, engineering expectations, or test format details..."
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-medium)',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
            <Button variant="outline" size="md" onClick={() => setModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" disabled={submitting}>
              {submitting ? 'Saving to MongoDB...' : editingJob ? 'Update Placement Drive' : 'Publish Placement Drive →'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AdminCompaniesPage;
