import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/common/Navbar';

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const result = await login(email.trim(), password);
      if (result?.success) navigate('/dashboard');
    } catch (err) {
      setError(err?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-ivory)' }}>
      <Navbar />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 'calc(100vh - 68px)' }} className="auth-grid">
        <div style={{ background: 'var(--color-forest)', padding: '4rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-100px', right: '-100px', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(183, 228, 74, 0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}>
            <div style={{ marginBottom: '2.5rem' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '12px', background: 'var(--color-lime)', color: 'var(--color-forest)', fontWeight: 700, fontSize: '1.4rem', marginBottom: '1.5rem' }}>
                &#x2726;
              </span>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 400, color: 'var(--color-ivory)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '1rem' }}>
                Welcome back to<br /><em style={{ color: 'var(--color-lime)' }}>SkillSense AI.</em>
              </h1>
              <p style={{ color: 'rgba(244, 240, 231, 0.65)', fontSize: '1.05rem', lineHeight: 1.7, maxWidth: '380px' }}>
                Your personalized assessment scores, roadmap progress, and career data are waiting for you.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {['Resume your personalized roadmap', 'View your latest assessment results', 'Check placement match scores'].map((text) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-lime)', flexShrink: 0 }} />
                  <span style={{ color: 'rgba(244, 240, 231, 0.7)', fontSize: '0.9rem' }}>{text}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 2rem' }}>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            style={{ width: '100%', maxWidth: '420px' }}
          >
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', fontWeight: 400, color: 'var(--color-forest)', letterSpacing: '-0.025em', marginBottom: '0.5rem' }}>Sign in</h2>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
              Don't have an account?{' '}
              <Link to="/signup" style={{ color: 'var(--color-emerald)', fontWeight: 600 }}>Get started free</Link>
            </p>

            {error && (
              <div style={{ background: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)', borderRadius: 'var(--radius-md)', padding: '0.875rem 1rem', marginBottom: '1.25rem', color: 'var(--color-error)', fontSize: '0.875rem', fontWeight: 500 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label">Email address</label>
                <input type="email" autoComplete="email" className="form-input" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input type="password" autoComplete="current-password" className="form-input" placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', marginTop: '0.25rem' }} disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In →'}
              </button>
            </form>

            <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--color-ivory)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-subtle)' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.375rem', fontWeight: 600 }}>Demo Credentials</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-subtle)', fontFamily: 'var(--font-mono)' }}>nagappa@skillsense.ai / password123</p>
            </div>

            <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              Admin? <Link to="/admin/login" style={{ color: 'var(--color-emerald)', fontWeight: 600 }}>Admin login →</Link>
            </p>
          </motion.div>
        </div>
      </div>
      <style>{'@media (max-width: 768px) { .auth-grid { grid-template-columns: 1fr !important; } .auth-grid > *:first-child { display: none !important; } }'}</style>
    </div>
  );
};

export default LoginPage;
