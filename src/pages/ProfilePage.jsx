import React, { useState } from 'react';
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
  const [formData, setFormData] = useState({
    name: user?.name || 'Nagappa Gongadi',
    email: user?.email || 'nagappa@skillsense.ai',
    careerInterest: user?.careerInterest || 'Backend Developer',
  });

  const handleSave = (e) => {
    e.preventDefault();
    updateUserProfile({
      name: formData.name,
      email: formData.email,
      careerInterest: formData.careerInterest,
      currentPath: formData.careerInterest,
    });
    setEditModalOpen(false);
    addToast('Profile updated successfully!', 'success');
  };

  const careerOptions = [
    'Frontend Developer',
    'Backend Developer',
    'Full Stack Developer',
    'AI/ML Engineer',
    'Data Analyst',
    'Cloud Engineer',
  ];

  return (
    <div className="dashboard-layout">
      <Sidebar />

      <main className="dashboard-main">
        <div className="dashboard-content animate-fade-in">
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
              onClick={() => setEditModalOpen(true)}
              icon={Edit3}
            >
              Edit Profile
            </Button>
          </div>

          {/* =========================================================================
              Section 39: CANDIDATE INFO & METRICS CARD
              ========================================================================= */}
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
                {user?.name ? user.name.charAt(0) : 'N'}
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.85rem', color: 'var(--color-deep-forest)', margin: 0 }}>
                    {user?.name || 'Nagappa Gongadi'}
                  </h2>
                  <Badge variant="lime">Verified Candidate</Badge>
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--color-muted-green)', marginTop: '2px' }}>
                  {user?.email || 'nagappa@skillsense.ai'} · Student (2026 Batch)
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-emerald)', fontWeight: 700, marginTop: '6px' }}>
                  Target Goal: {user?.careerInterest || 'Backend Developer'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted-green)' }}>
                  Career Readiness
                </div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', color: 'var(--color-deep-forest)' }}>
                  {user?.readinessScore || 87}%
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted-green)' }}>
                  Skill Progress
                </div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', color: 'var(--color-emerald)' }}>
                  {user?.skillProgress || 74}%
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-muted-green)' }}>
                  Assessments
                </div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', color: 'var(--color-dark-emerald)' }}>
                  {user?.assessmentsCompleted || 12}
                </div>
              </div>
            </div>
          </div>

          {/* =========================================================================
              SKILLS & PROGRESS REPORT
              ========================================================================= */}
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
                {(user?.strongSkills || ['Python', 'SQL', 'Java', 'REST APIs', 'FastAPI', 'Data Structures']).map((s) => (
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
                {(user?.gapSkills || ['System Design', 'Docker', 'Kubernetes']).map((s) => (
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
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-deep-forest)' }}>01 — Strong Foundations</span>
                    <span style={{ color: '#059669', fontWeight: 700 }}>100% Cleared</span>
                  </div>
                  <ProgressBar value={100} color="#10B981" height="6px" />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-deep-forest)' }}>02 — Data & Problem Solving</span>
                    <span style={{ color: '#059669', fontWeight: 700 }}>100% Cleared</span>
                  </div>
                  <ProgressBar value={100} color="#10B981" height="6px" />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-deep-forest)' }}>03 — Core Technical Skills</span>
                    <span style={{ color: 'var(--color-emerald)', fontWeight: 700 }}>65% In Progress</span>
                  </div>
                  <ProgressBar value={65} color="var(--color-emerald)" height="6px" />
                </div>
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
        subtitle="Update your name, email, and target placement career path."
      >
        <form onSubmit={handleSave}>
          <Input
            label="Full Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <Input
            label="Email Address"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            required
          />

          <Select
            label="Career Target"
            value={formData.careerInterest}
            onChange={(e) => setFormData({ ...formData, careerInterest: e.target.value })}
            options={careerOptions}
            required
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
            <Button variant="outline" size="md" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md">
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
