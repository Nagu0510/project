import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/common/Navbar';
import { GoogleAuth } from '../components/common/GoogleAuth';
import { isStrongPassword, PASSWORD_HINT } from '../utils/password';

const CAREER_PATHS = [
  'Frontend Developer', 'Backend Developer', 'Full Stack Developer',
  'Python Developer', 'Java Developer', 'Data Analyst',
  'Data Scientist', 'AI / ML Engineer', 'Cloud / DevOps Engineer',
];

export const SignupPage = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', careerInterest: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup, googleLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const update = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  // a new page visit never starts with the previous attempt's error
  useEffect(() => { setError(''); }, [location.key]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) { setError('Please fill in all required fields.'); return; }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }
    if (!isStrongPassword(form.password)) { setError(PASSWORD_HINT); return; }
    setLoading(true);
    try {
      const result = await signup(form.name.trim(), form.email.trim(), form.password, form.careerInterest || 'Backend Developer');
      if (result?.success) navigate('/dashboard');
    } catch (err) {
      setError(err?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async (credential) => {
    setError('');
    try {
      const result = await googleLogin(credential);
      if (result?.success) navigate('/dashboard');
    } catch (err) {
      setError(err?.message || 'Google sign-in failed. Please try again.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-ivory)' }}>
      <Navbar />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 'calc(100vh - 68px)' }} className="auth-grid">
        <div style={{ background: 'var(--color-forest)', padding: '4rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '12px', background: 'var(--color-lime)', color: 'var(--color-forest)', fontWeight: 700, fontSize: '1.4rem', marginBottom: '1.5rem' }}>&#x2726;</span>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 400, color: 'var(--color-ivory)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '1rem' }}>
              Start your<br /><em style={{ color: 'var(--color-lime)' }}>career journey.</em>
            </h1>
            <p style={{ color: 'rgba(244, 240, 231, 0.65)', fontSize: '1.05rem', lineHeight: 1.7, maxWidth: '380px', marginBottom: '2rem' }}>
              Free assessment, AI-powered roadmap, resume intelligence, and real placement question bank.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              {['Personalized skill assessment', 'AI-powered career roadmap', 'Resume intelligence and ATS analysis', 'Real placement question bank'].map((feat) => (
                <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-lime)', flexShrink: 0 }} />
                  <span style={{ color: 'rgba(244, 240, 231, 0.7)', fontSize: '0.9rem' }}>{feat}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 2rem', overflowY: 'auto' }}>
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} style={{ width: '100%', maxWidth: '440px' }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', fontWeight: 400, color: 'var(--color-forest)', letterSpacing: '-0.025em', marginBottom: '0.5rem' }}>Create account</h2>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
              Already have one? <Link to="/login" style={{ color: 'var(--color-emerald)', fontWeight: 600 }}>Sign in</Link>
            </p>

            {error && (
              <div style={{ background: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)', borderRadius: 'var(--radius-md)', padding: '0.875rem 1rem', marginBottom: '1.25rem', color: 'var(--color-error)', fontSize: '0.875rem', fontWeight: 500 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.125rem' }}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input type="text" className="form-input" placeholder="Your full name" value={form.name} onChange={update('name')} required />
              </div>
              <div className="form-group">
                <label className="form-label">Email address *</label>
                <input type="email" autoComplete="email" className="form-input" placeholder="you@example.com" value={form.email} onChange={update('email')} required />
              </div>
              <div className="form-group">
                <label className="form-label">Career Interest</label>
                <select className="form-input" value={form.careerInterest} onChange={update('careerInterest')}>
                  <option value="">Select your career goal...</option>
                  {CAREER_PATHS.map((cp) => <option key={cp} value={cp}>{cp}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Password *</label>
                <input type="password" autoComplete="new-password" className="form-input" placeholder="8+ characters, with a letter and a number" value={form.password} onChange={update('password')} required />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm Password *</label>
                <input type="password" autoComplete="new-password" className="form-input" placeholder="Confirm your password" value={form.confirmPassword} onChange={update('confirmPassword')} required />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', marginTop: '0.25rem' }} disabled={loading}>
                {loading ? 'Creating account...' : 'Create Free Account →'}
              </button>
            </form>

            <GoogleAuth text="signup_with" onCredential={handleGoogle} onError={setError} />
          </motion.div>
        </div>
      </div>
      <style>{'@media (max-width: 768px) { .auth-grid { grid-template-columns: 1fr !important; } .auth-grid > *:first-child { display: none !important; } }'}</style>
    </div>
  );
};

export default SignupPage;
