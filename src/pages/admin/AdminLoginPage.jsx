import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { ThemeToggle } from '../../components/common/ThemeToggle';

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
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}><ThemeToggle /></div>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} style={{ width: '100%', maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '56px', height: '56px', borderRadius: '14px', background: 'var(--color-forest)', color: 'var(--color-lime)', border: '1px solid var(--border-mid)', fontWeight: 700, fontSize: '1.6rem', marginBottom: '1rem' }}>&#x2726;</span>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem', fontWeight: 400, color: 'var(--text)', letterSpacing: '-0.025em' }}>
            SkillSense <span style={{ color: 'var(--accent)' }}>Admin</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.375rem' }}>Restricted access — administrators only</p>
        </div>

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)', borderRadius: 'var(--radius-2xl)', padding: '2.5rem' }}>
          {error && (
            <div role="alert" style={{ background: 'var(--danger-soft)', border: '1px solid var(--danger-border)', borderRadius: 'var(--radius-md)', padding: '0.875rem 1rem', marginBottom: '1.25rem', color: 'var(--danger-text)', fontSize: '0.875rem', fontWeight: 500 }}>
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ color: 'var(--text)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Admin Email</label>
              <input className="form-input" type="email" autoComplete="email" placeholder="Administrator email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label style={{ color: 'var(--text)', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Password</label>
              <input className="form-input" type="password" autoComplete="current-password" placeholder="Admin password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary"
              style={{ width: '100%', padding: '0.875rem', fontSize: '1rem', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, marginTop: '0.25rem' }}>
              {loading ? 'Authenticating...' : 'Access Admin Dashboard →'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.75rem' }}>
          <Link to="/login" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textDecoration: 'underline' }}>Back to student login</Link>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminLoginPage;
