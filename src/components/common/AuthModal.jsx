import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from './Modal';
import { Button } from './Button';
import { useAuth } from '../../context/AuthContext';
import { ArrowRight, CheckCircle2, Sparkles, UserPlus, LogIn, X } from 'lucide-react';

export const AuthModal = () => {
  const { authModal, closeAuthModal } = useAuth();
  const navigate = useNavigate();

  if (!authModal.isOpen) return null;

  const handleSignupRedirect = () => {
    const redirect = authModal.redirectPath ? `?redirect=${encodeURIComponent(authModal.redirectPath)}` : '';
    closeAuthModal();
    navigate(`/signup${redirect}`);
  };

  const handleLoginRedirect = () => {
    const redirect = authModal.redirectPath ? `?redirect=${encodeURIComponent(authModal.redirectPath)}` : '';
    closeAuthModal();
    navigate(`/login${redirect}`);
  };

  const features = [
    'Take personalized skill assessments',
    'Build your customized winding roadmap',
    'Track your learning progress & diagnostic scores',
    'Analyze your resume against ATS benchmarks',
    'Practice coding problems with instant compiler feedback',
    'Get real-time corporate placement intelligence',
  ];

  return (
    <Modal
      isOpen={authModal.isOpen}
      onClose={closeAuthModal}
      maxWidth="560px"
    >
      <div style={{ textAlign: 'center', padding: '0.5rem 0.25rem' }}>
        {/* Glowing Icon */}
        <div
          style={{
            width: '54px',
            height: '54px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--color-lime-soft)',
            color: 'var(--color-deep-forest)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            marginBottom: '1.25rem',
            boxShadow: 'var(--shadow-glow-lime)',
          }}
        >
          ✦
        </div>

        <h2
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 'clamp(1.75rem, 3.5vw, 2.15rem)',
            color: 'var(--color-deep-forest)',
            margin: '0 0 0.5rem 0',
            lineHeight: 1.15,
          }}
        >
          {authModal.title || 'Unlock Your Personalized Experience'}
        </h2>

        <p
          style={{
            fontSize: '0.925rem',
            color: 'var(--color-charcoal-subtle)',
            margin: '0 auto 1.5rem',
            maxWidth: '420px',
            lineHeight: 1.5,
          }}
        >
          {authModal.message || 'Create a free SkillSense AI account to continue.'}
        </p>

        {/* Benefits Checklist */}
        <div
          style={{
            backgroundColor: 'var(--color-ivory-surface)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 'var(--radius-xl)',
            padding: '1.25rem 1.5rem',
            textAlign: 'left',
            marginBottom: '1.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-emerald)', letterSpacing: '0.04em' }}>
            With your free student account you can:
          </div>

          {features.map((feat, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '0.865rem', color: 'var(--color-deep-forest)', fontWeight: 500 }}>
              <span style={{ color: 'var(--color-emerald)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '50%', backgroundColor: 'var(--color-lime-soft)', flexShrink: 0, fontSize: '0.75rem', fontWeight: 800 }}>
                ✓
              </span>
              <span>{feat}</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <Button
            variant="primary"
            size="lg"
            onClick={handleSignupRedirect}
            icon={ArrowRight}
            iconPosition="right"
            style={{ width: '100%' }}
          >
            Create Free Account →
          </Button>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Button
              variant="outline"
              size="md"
              onClick={handleLoginRedirect}
              style={{ flex: 1 }}
              icon={LogIn}
            >
              Sign In
            </Button>
            <Button
              variant="ghost"
              size="md"
              onClick={closeAuthModal}
              style={{ flex: 1, color: 'var(--color-muted-green)' }}
            >
              Continue Exploring
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
