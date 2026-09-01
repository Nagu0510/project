import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Mail, ShieldCheck, Sparkles, Building2, Layers } from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export const AdminLoginPage = () => {
  const navigate = useNavigate();
  const { adminLogin } = useAuth();
  const { addToast } = useToast();

  const [email, setEmail] = useState('admin@skillsense.ai');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!email.trim() || !email.includes('@')) newErrors.email = 'Please enter a valid administrator email';
    if (!password) newErrors.password = 'Please enter your password';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      addToast('Please check your administrator credentials.', 'error');
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      await adminLogin(email, password);
      addToast('Welcome to SkillSense Admin Console!', 'success');
      navigate('/admin/dashboard');
    } catch (err) {
      const msg = err.message || 'Invalid administrator credentials';
      setErrors({ general: msg });
      addToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-warm-ivory)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.5rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1020px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '2.5rem',
          alignItems: 'center',
        }}
      >
        {/* =========================================================================
            LEFT COLUMN: Admin Branding
            ========================================================================= */}
        <div style={{ padding: '2rem 1.5rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-deep-forest)',
                color: 'var(--color-lime)',
                fontSize: '1.15rem',
              }}
            >
              ✦
            </span>
            <span
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.5rem',
                color: 'var(--color-deep-forest)',
              }}
            >
              SkillSense AI
            </span>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                backgroundColor: 'var(--color-lime-soft)',
                color: 'var(--color-deep-forest)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              Admin Portal
            </span>
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(2.2rem, 4vw, 3.25rem)',
              color: 'var(--color-deep-forest)',
              lineHeight: 1.15,
              marginBottom: '1rem',
              letterSpacing: '-0.02em',
            }}
          >
            Placement & Assessment Management Console
          </h1>

          <p
            style={{
              fontSize: '1.05rem',
              color: 'var(--color-charcoal-subtle)',
              lineHeight: 1.6,
              marginBottom: '2rem',
            }}
          >
            Upload question papers, curate extracted question banks, configure skill diagnostic assessments, and monitor corporate hiring analytics.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.885rem', color: 'var(--color-deep-forest)', fontWeight: 600 }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-emerald)' }} />
              Automated multi-format paper OCR & question vectorization
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.885rem', color: 'var(--color-deep-forest)', fontWeight: 600 }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-emerald)' }} />
              Cross-company question recurrence intelligence
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.885rem', color: 'var(--color-deep-forest)', fontWeight: 600 }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-emerald)' }} />
              Candidate assessment verification and hiring pipeline tracking
            </div>
          </div>
        </div>

        {/* =========================================================================
            RIGHT COLUMN: Admin Sign In Card
            ========================================================================= */}
        <div
          className="card-static animate-scale-in"
          style={{
            backgroundColor: 'var(--color-white)',
            borderRadius: 'var(--radius-2xl)',
            padding: '2.5rem',
            border: '1.5px solid rgba(15, 118, 110, 0.25)',
            boxShadow: 'var(--shadow-xl)',
          }}
        >
          <div style={{ marginBottom: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.35rem' }}>
              <ShieldCheck size={18} color="var(--color-emerald)" />
              <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-emerald)', letterSpacing: '0.04em' }}>
                Secure Access
              </span>
            </div>

            <h2
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '2rem',
                color: 'var(--color-deep-forest)',
                margin: '0 0 0.35rem 0',
              }}
            >
              SkillSense AI Admin
            </h2>
            <p style={{ fontSize: '0.885rem', color: 'var(--color-muted-green)', margin: 0 }}>
              Manage assessments, question papers, students and placement intelligence.
            </p>
          </div>

          <form onSubmit={handleAdminSubmit}>
            <Input
              label="Administrator Email"
              type="email"
              placeholder="admin@skillsense.ai"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              icon={Mail}
              required
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              icon={Lock}
              required
            />

            <div style={{ marginTop: '1.75rem', marginBottom: '1.25rem' }}>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                style={{ width: '100%' }}
                icon={ArrowRight}
                iconPosition="right"
              >
                Sign In as Admin →
              </Button>
            </div>

            <div style={{ textAlign: 'center', fontSize: '0.885rem', color: 'var(--color-charcoal-subtle)', borderTop: '1px solid var(--color-border-subtle)', paddingTop: '1rem' }}>
              Looking for student learning?{' '}
              <Link to="/login" style={{ fontWeight: 700, color: 'var(--color-emerald)' }}>
                Student Sign In
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
