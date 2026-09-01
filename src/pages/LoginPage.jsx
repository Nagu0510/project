import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Lock, Mail, Sparkles } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTarget = searchParams.get('redirect') || '/dashboard';
  const { login } = useAuth();
  const { addToast } = useToast();

  const [email, setEmail] = useState('nagappa@skillsense.ai');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const orbitalSkills = [
    { name: 'Python', top: '15%', left: '20%' },
    { name: 'Java', top: '20%', right: '15%' },
    { name: 'React', bottom: '25%', left: '15%' },
    { name: 'DSA', bottom: '20%', right: '20%' },
    { name: 'AI', top: '48%', left: '8%' },
    { name: 'SQL', top: '50%', right: '10%' },
    { name: 'Cloud', top: '8%', left: '50%' },
    { name: 'MongoDB', bottom: '10%', left: '46%' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!email.trim() || !email.includes('@')) newErrors.email = 'Please enter a valid email address';
    if (!password) newErrors.password = 'Please enter your password';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      addToast('Please check your login credentials.', 'error');
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      await login(email, password);
      addToast('Signed in successfully! Welcome back.', 'success');
      navigate(redirectTarget);
    } catch (err) {
      const msg = err.message || 'Invalid email or password';
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
          maxWidth: '1080px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '2.5rem',
          alignItems: 'center',
        }}
      >
        {/* =========================================================================
            LEFT COLUMN: SkillSense Branding Visual
            ========================================================================= */}
        <div
          style={{
            position: 'relative',
            padding: '2.5rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          {/* Brand Logo */}
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              textDecoration: 'none',
              marginBottom: '1.5rem',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'var(--color-deep-forest)',
                color: 'var(--color-lime)',
                fontSize: '1.1rem',
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
          </Link>

          {/* Heading */}
          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'clamp(2.2rem, 4vw, 3.25rem)',
              color: 'var(--color-deep-forest)',
              lineHeight: 1.12,
              marginBottom: '1rem',
              letterSpacing: '-0.02em',
            }}
          >
            Accelerate your career readiness.
          </h1>

          {/* Description */}
          <p
            style={{
              fontSize: '1.05rem',
              color: 'var(--color-charcoal-subtle)',
              lineHeight: 1.6,
              marginBottom: '2rem',
              maxWidth: '480px',
            }}
          >
            Continue your personalized assessment journey, practice previous placement questions, and monitor your career milestones.
          </p>

          {/* Orbital Visualization Graphic */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '240px',
              maxWidth: '380px',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Ambient Circle */}
            <div
              style={{
                position: 'absolute',
                width: '200px',
                height: '200px',
                borderRadius: '50%',
                border: '1px dashed rgba(15, 118, 110, 0.3)',
                background: 'radial-gradient(circle, rgba(199, 243, 107, 0.25) 0%, transparent 70%)',
              }}
            />

            {/* Core Node */}
            <div
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-deep-forest)',
                border: '2px solid var(--color-lime)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-lime)',
                fontSize: '1.25rem',
                boxShadow: '0 0 24px rgba(199, 243, 107, 0.3)',
                zIndex: 2,
              }}
            >
              ✦
            </div>

            {/* Floating Labels */}
            {orbitalSkills.map((skill, idx) => (
              <div
                key={skill.name}
                className={idx % 2 === 0 ? 'animate-float' : 'animate-float-delay'}
                style={{
                  position: 'absolute',
                  top: skill.top,
                  bottom: skill.bottom,
                  left: skill.left,
                  right: skill.right,
                  backgroundColor: 'var(--color-white)',
                  border: '1px solid rgba(15, 118, 110, 0.25)',
                  borderRadius: 'var(--radius-full)',
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--color-deep-forest)',
                  boxShadow: 'var(--shadow-sm)',
                  zIndex: 3,
                }}
              >
                {skill.name}
              </div>
            ))}
          </div>
        </div>

        {/* =========================================================================
            RIGHT COLUMN: Premium Login Card
            ========================================================================= */}
        <div
          className="card-static animate-scale-in"
          style={{
            backgroundColor: 'var(--color-white)',
            borderRadius: 'var(--radius-2xl)',
            padding: '2.5rem',
            border: '1px solid var(--color-border-subtle)',
            boxShadow: 'var(--shadow-xl)',
          }}
        >
          <div style={{ marginBottom: '1.75rem' }}>
            <h2
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '2rem',
                color: 'var(--color-deep-forest)',
                margin: '0 0 0.35rem 0',
              }}
            >
              Welcome back.
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-muted-green)', margin: 0 }}>
              Continue your journey with SkillSense AI.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <Input
              label="Email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              icon={Mail}
              required
            />

            <div style={{ position: 'relative' }}>
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

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-0.5rem', marginBottom: '1.25rem' }}>
                <Link
                  to="/forgot-password"
                  style={{
                    fontSize: '0.825rem',
                    color: 'var(--color-emerald)',
                    fontWeight: 600,
                  }}
                >
                  Forgot password?
                </Link>
              </div>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                style={{ width: '100%' }}
                icon={ArrowUpRight}
                iconPosition="right"
              >
                Sign In
              </Button>
            </div>

            <div style={{ textAlign: 'center', fontSize: '0.885rem', color: 'var(--color-charcoal-subtle)' }}>
              Don't have an account?{' '}
              <Link to="/signup" style={{ fontWeight: 700, color: 'var(--color-emerald)' }}>
                Create account
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
