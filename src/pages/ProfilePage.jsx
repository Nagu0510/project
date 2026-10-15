import React, { useState, useEffect } from 'react';
import { Sidebar } from '../components/common/Sidebar';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { ProgressCircle } from '../components/common/ProgressCircle';
import { ProgressBar } from '../components/common/ProgressBar';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { studentService } from '../services/studentService';
import { careerService } from '../services/careerService';
import { LoadingState } from '../components/common/LoadingState';
import {
  User,
  Mail,
  Target,
  Edit3,
  Award,
  BookOpen,
  CheckCircle2,
  Sparkles,
  Layers,
  MapPin,
} from 'lucide-react';

export const ProfilePage = () => {
  const { user, updateUserProfile } = useAuth();
  const { addToast } = useToast();

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [dash, setDash] = useState(null); // readiness, strengths and gaps computed by the API from this student's records
  const [paths, setPaths] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [loadKey, setLoadKey] = useState(0);

  const [formData, setFormData] = useState({
    name: '',
    college: '',
    department: '',
    current_year: '',
    career_path: '',
    cgpa: '',
    graduation_year: '',
  });

  useEffect(() => {
    let mounted = true;
    setLoadError('');
    Promise.all([studentService.getProfile(), studentService.getDashboard(), careerService.getCareerPaths()])
      .then(([data, dashboard, careerPaths]) => {
        if (!mounted) return;
        setProfile(data);
        setDash(dashboard);
        setPaths(careerPaths);
      })
      .catch((err) => { if (mounted) setLoadError(err?.message || 'Your profile could not be loaded.'); });
    return () => { mounted = false; };
  }, [loadKey]);

  const handleOpenEdit = () => {
    setFormData({
      name: profile?.name || user?.name || '',
      college: profile?.college || user?.college || '',
      department: profile?.department || user?.department || '',
      current_year: profile?.current_year || user?.year || '',
      career_path: profile?.career_path || user?.currentPath || '',
      cgpa: profile?.cgpa ?? '',
      graduation_year: profile?.graduation_year ?? '',
    });
    setEditModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const cgpa = formData.cgpa === '' ? null : Number(formData.cgpa);
    const gradYear = formData.graduation_year === '' ? null : Number(formData.graduation_year);
    if (cgpa !== null && !(cgpa >= 0 && cgpa <= 10)) { addToast('CGPA must be between 0 and 10.', 'error'); return; }
    if (gradYear !== null && !(Number.isInteger(gradYear) && gradYear >= 2000 && gradYear <= 2040)) { addToast('Graduation year must be between 2000 and 2040.', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        user_id: user?.id,
        name: formData.name.trim(),
        email: user?.email,
        college: formData.college.trim(),
        department: formData.department.trim(),
        current_year: formData.current_year.trim(),
        career_path: formData.career_path || null,
        preferred_language: profile?.preferred_language ?? null,
        skill_level: profile?.skill_level ?? null,
        skills: profile?.skills || [],
        target_companies: profile?.target_companies || [],
        branch: formData.department.trim() || null, // the branch placements check eligibility against
        cgpa,
        graduation_year: gradYear,
      };

      const updated = await studentService.updateProfile(payload);
      setProfile(updated);
      updateUserProfile({
        name: updated.name,
        college: updated.college,
        department: updated.department,
        year: updated.current_year,
        careerInterest: updated.career_path,
        currentPath: updated.career_path,
      });

      setEditModalOpen(false);
      addToast('Profile updated successfully in MongoDB!', 'success');
    } catch (err) {
      addToast(`Profile update failed: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const careerOptions = paths.map((cp) => cp.title);

  const NOT_SET = 'Not set';
  const displayName = profile?.name || user?.name || NOT_SET;
  const displayEmail = profile?.email || user?.email || NOT_SET;
  const displayCollege = profile?.college || user?.college || NOT_SET;
  const displayDepartment = profile?.department || user?.department || NOT_SET;
  const displayYear = profile?.current_year || user?.year || NOT_SET;
  const displayPath = profile?.career_path || user?.currentPath || NOT_SET;
  const strengths = dash?.strengths || [];
  const gaps = dash?.skill_gaps || [];
  const parts = dash?.readiness_parts || [];

  return (
    <div className="dashboard-layout">
      <Sidebar />

      <main className="dashboard-main">
        <div className="dashboard-content animate-fade-in">
          {!profile && !loadError && <LoadingState message="Loading your profile..." subtitle="One moment" />}
          {loadError && (
            <div role="alert" data-testid="profile-error" style={{ background: '#FEF2F2', border: '1.5px solid #F87171', borderRadius: 'var(--radius-xl)', padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', color: '#991B1B' }}>
              <span><strong>Your profile could not be loaded.</strong> {loadError}</span>
              <Button variant="outline" size="sm" onClick={() => setLoadKey((k) => k + 1)}>Try again</Button>
            </div>
          )}
          {/* Header */}
          <div style={{ marginBottom: '2.5rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--color-emerald)' }}>✦</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-emerald)' }}>
                  Student Intelligence Dossier
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
                Candidate Profile
              </h1>
              <p style={{ fontSize: '1rem', color: 'var(--color-charcoal-subtle)', marginTop: '4px', maxWidth: '680px' }}>
                Manage your candidate credentials, career goals, and verified placement skills.
              </p>
            </div>

            <Button
              variant="primary"
              size="md"
              onClick={handleOpenEdit}
              icon={Edit3}
            >
              Edit Profile
            </Button>
          </div>

          {/* CANDIDATE INFO & METRICS CARD */}
          <div
            className="card-floating"
            style={{
              padding: '2rem',
              backgroundColor: 'var(--color-white)',
              borderRadius: 'var(--radius-2xl)',
              border: '1.5px solid rgba(15, 118, 110, 0.25)',
              marginBottom: '2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--color-deep-forest)',
                  border: '3px solid var(--color-lime)',
                  color: 'var(--color-lime)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-serif)',
                  fontSize: '2rem',
                  boxShadow: 'var(--shadow-glow-lime)',
                }}
              >
                {displayName ? displayName.charAt(0) : 'N'}
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.85rem', color: 'var(--color-deep-forest)', margin: 0 }}>
                    {displayName}
                  </h2>
                  <Badge variant="lime">Verified Candidate</Badge>
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--color-muted-green)', marginTop: '2px' }}>
                  {displayEmail} · {displayCollege} ({displayDepartment})
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-emerald)', fontWeight: 700, marginTop: '6px' }}>
                  {displayYear} · Target Goal: {displayPath}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem' }} data-testid="profile-stats">
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted-green)' }}>
                  Career Readiness
                </div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', color: 'var(--color-deep-forest)' }}>
                  {dash ? dash.career_readiness : 0}%
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted-green)' }}>
                  Roadmap Progress
                </div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', color: 'var(--color-emerald)' }}>
                  {dash ? dash.roadmap_progress : 0}%
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted-green)' }}>
                  Assessments
                </div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', color: 'var(--color-dark-emerald)' }}>
                  {dash ? dash.assessments_completed : 0}
                </div>
              </div>
            </div>
          </div>

          {/* SKILLS & PROGRESS REPORT */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {/* Verified Skills */}
            <div
              className="card-static"
              style={{
                padding: '1.75rem',
                backgroundColor: 'var(--color-white)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: 'var(--color-deep-forest)', margin: '0 0 1rem 0' }}>
                Verified Skills & Strengths
              </h3>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '1.5rem' }}>
                {strengths.length === 0 && <span style={{ fontSize: '0.85rem', color: 'var(--color-muted-green)' }}>Take an assessment to see your strengths.</span>}
                {strengths.map((s) => (
                  <span
                    key={s}
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      backgroundColor: '#ECFDF5',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      color: '#065F46',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    ✓ {s}
                  </span>
                ))}
              </div>

              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#D97706', marginBottom: '6px' }}>
                Identified Skill Gaps
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {gaps.length === 0 && <span style={{ fontSize: '0.85rem', color: 'var(--color-muted-green)' }}>{strengths.length ? 'No gaps in your latest assessment.' : 'Gaps appear after your first assessment.'}</span>}
                {gaps.map((s) => (
                  <span
                    key={s}
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      backgroundColor: '#FFFBEB',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                      color: '#92400E',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-md)',
                    }}
                  >
                    ! {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Learning Progress Checkpoints */}
            <div
              className="card-static"
              style={{
                padding: '1.75rem',
                backgroundColor: 'var(--color-white)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: 'var(--color-deep-forest)', margin: '0 0 1rem 0' }}>
                Learning Progress
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {parts.map((part) => (
                  <div key={part.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-deep-forest)' }}>{part.label} ({part.weight}%)</span>
                      <span style={{ color: part.has_data ? 'var(--color-emerald)' : 'var(--color-muted-green)', fontWeight: 700 }}>{part.value}%</span>
                    </div>
                    <ProgressBar value={part.value} color="var(--color-emerald)" height="6px" />
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-muted-green)', marginTop: '2px' }}>{part.detail}</div>
                  </div>
                ))}
                {parts.length === 0 && <span style={{ fontSize: '0.85rem', color: 'var(--color-muted-green)' }}>Your progress appears here once you start learning.</span>}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Candidate Profile"
        subtitle="Update your name, institution, branch, and target career path."
      >
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <Input
            label="Full Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <Input
            label="College / Institution"
            value={formData.college}
            onChange={(e) => setFormData({ ...formData, college: e.target.value })}
            required
          />

          <Input
            label="Branch / Department"
            value={formData.department}
            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
            required
          />

          <Input
            label="Current year of study"
            value={formData.current_year}
            onChange={(e) => setFormData({ ...formData, current_year: e.target.value })}
            required
          />

          <Input
            label="Graduation year (for placement eligibility)"
            type="number"
            min="2000"
            max="2040"
            data-testid="profile-graduation-year"
            value={formData.graduation_year}
            onChange={(e) => setFormData({ ...formData, graduation_year: e.target.value })}
            helperText="Optional. Between 2000 and 2040."
          />

          <Input
            label="CGPA (for placement eligibility)"
            type="number"
            step="0.01"
            min="0"
            max="10"
            data-testid="profile-cgpa"
            value={formData.cgpa}
            onChange={(e) => setFormData({ ...formData, cgpa: e.target.value })}
            helperText="Optional. Between 0 and 10. Without it, placements say Add CGPA to see eligibility."
          />

          <Select
            label="Career Target"
            value={formData.career_path}
            onChange={(e) => setFormData({ ...formData, career_path: e.target.value })}
            options={careerOptions}
            required
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <Button variant="outline" size="md" onClick={() => setEditModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ProfilePage;
