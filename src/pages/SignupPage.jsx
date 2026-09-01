import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Lock, Mail, User, Sparkles, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const SignupPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTarget = searchParams.get('redirect') || '/dashboard';
  const { signup } = useAuth();
  const { addToast } = useToast();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [careerInterest, setCareerInterest] = useState('Backend Developer');
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

  const careerOptions = [
    { value: 'Frontend Developer', label: 'Frontend Developer' },
    { value: 'Backend Developer', label: 'Backend Developer' },
    { value: 'Full Stack Developer', label: 'Full Stack Developer' },
    { value: 'Python Developer', label: 'Python Developer' },
    { value: 'Java Developer', label: 'Java Developer' },
    { value: 'Data Analyst', label: 'Data Analyst' },
    { value: 'Data Scientist', label: 'Data Scientist' },
    { value: 'AI / Machine Learning Engineer', label: 'AI / Machine Learning Engineer' },
    { value: 'Cloud / DevOps Engineer', label: 'Cloud / DevOps Engineer' },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!fullName.trim()) newErrors.fullName = 'Please enter your full name';
    if (!email.trim() || !email.includes('@')) newErrors.email = 'Please enter a valid email address';
    if (!password || password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    if (password !== confirmPassword) newErrors.confirmPassword = 'Passwords do not match';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      addToast('Please complete all required fields correctly.', 'error');
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      await signup(fullName, email, password, careerInterest);
      addToast(`Account created for ${fullName}! Welcome to SkillSense AI.`, 'success');
      navigate(redirectTarget);
    } catch (err) {
      const msg = err.message || 'Registration failed. Please try again.';
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
          maxWidth: '1120px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '2.5rem',
          alignItems: 'center',
        }}
      >
        {/* =========================================================================
            LEFT COLUMN: SkillSense Branding & Orbital Skill Badges
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
            Build the career you're meant for.
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
            Discover your strengths, close your skill gaps, and build a personalized path toward your dream career.
          </p>

          {/* Orbital Visualization Graphic */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '240px',
              maxWidth: '400px',
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
            RIGHT COLUMN: Premium Signup Card
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
              Create your SkillSense account
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-muted-green)', margin: 0 }}>
              Start building your personalized career path.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <Input
              label="Full Name"
              placeholder="e.g. Nagappa Gongadi"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              error={errors.fullName}
              icon={User}
              required
            />

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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
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

              <Input
                label="Confirm Password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                error={errors.confirmPassword}
                icon={Lock}
                required
              />
            </div>

            <Select
              label="Career Interest"
              value={careerInterest}
              onChange={(e) => setCareerInterest(e.target.value)}
              options={careerOptions}
              required
            />

            <div style={{ marginTop: '1.5rem', marginBottom: '1.25rem' }}>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={loading}
                style={{ width: '100%' }}
                icon={ArrowUpRight}
                iconPosition="right"
              >
                Create Account
              </Button>
            </div>

            <div style={{ textAlign: 'center', fontSize: '0.885rem', color: 'var(--color-charcoal-subtle)' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ fontWeight: 700, color: 'var(--color-emerald)' }}>
                Sign in
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
