import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';

export const AdminLoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { adminLogin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password.trim()) { setError('Enter admin credentials.'); return; }
    setLoading(true);
    try {
      const result = await adminLogin(email.trim(), password);
      if (result?.success) navigate('/admin/dashboard');
    } catch (err) {
      setError(err?.message || 'Invalid administrator credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} style={{ width: '100%', maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '14px', background: 'var(--color-lime)', color: 'var(--color-forest)', fontWeight: 700, fontSize: '1.6rem', marginBottom: '1rem' }}>&#x2726;</span>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem', fontWeight: 400, color: 'var(--color-ivory)', letterSpacing: '-0.025em' }}>
            SkillSense <span style={{ color: 'var(--color-lime)' }}>Admin</span>
          </h1>
          <p style={{ color: 'rgba(244, 240, 231, 0.5)', fontSize: '0.875rem', marginTop: '0.375rem' }}>Restricted access — administrators only</p>
        </div>

        <div style={{ background: 'rgba(244, 240, 231, 0.06)', border: '1px solid rgba(183, 228, 74, 0.12)', borderRadius: 'var(--radius-2xl)', padding: '2.5rem' }}>
          {error && (
            <div style={{ background: 'rgba(220, 38, 38, 0.12)', border: '1px solid rgba(220, 38, 38, 0.25)', borderRadius: 'var(--radius-md)', padding: '0.875rem 1rem', marginBottom: '1.25rem', color: '#fca5a5', fontSize: '0.875rem', fontWeight: 500 }}>
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ color: 'rgba(244, 240, 231, 0.7)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Admin Email</label>
              <input type="email" autoComplete="email" placeholder="Administrator email" value={email} onChange={(e) => setEmail(e.target.value)} required
                style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(244, 240, 231, 0.06)', border: '1.5px solid rgba(183, 228, 74, 0.15)', borderRadius: 'var(--radius-md)', color: 'var(--color-ivory)', fontSize: '0.9375rem', outline: 'none', fontFamily: 'var(--font-sans)' }}
                onFocus={(e) => e.target.style.borderColor = 'rgba(183, 228, 74, 0.5)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(183, 228, 74, 0.15)'}
              />
            </div>
            <div>
              <label style={{ color: 'rgba(244, 240, 231, 0.7)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Password</label>
              <input type="password" autoComplete="current-password" placeholder="Admin password" value={password} onChange={(e) => setPassword(e.target.value)} required
                style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(244, 240, 231, 0.06)', border: '1.5px solid rgba(183, 228, 74, 0.15)', borderRadius: 'var(--radius-md)', color: 'var(--color-ivory)', fontSize: '0.9375rem', outline: 'none', fontFamily: 'var(--font-sans)' }}
                onFocus={(e) => e.target.style.borderColor = 'rgba(183, 228, 74, 0.5)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(183, 228, 74, 0.15)'}
              />
            </div>
            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: '0.875rem', borderRadius: 'var(--radius-full)', background: loading ? 'rgba(183, 228, 74, 0.5)' : 'var(--color-lime)', color: 'var(--color-forest)', fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '1rem', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '0.25rem' }}>
              {loading ? 'Authenticating...' : 'Access Admin Dashboard →'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.75rem' }}>
          <Link to="/login" style={{ color: 'rgba(244, 240, 231, 0.5)', fontSize: '0.85rem', textDecoration: 'none' }}>Back to student login</Link>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminLoginPage;
