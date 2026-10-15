import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { authService } from '../services/authService';
import { isStrongPassword, PASSWORD_HINT } from '../utils/password';

const cardStyle = {
  width: '100%',
  maxWidth: '480px',
  backgroundColor: 'var(--color-white)',
  borderRadius: 'var(--radius-2xl)',
  padding: '2.5rem',
  border: '1px solid var(--color-border-subtle)',
  boxShadow: 'var(--shadow-xl)',
  textAlign: 'center',
};

const headingStyle = {
  fontFamily: 'var(--font-serif)',
  fontSize: '1.85rem',
  color: 'var(--color-deep-forest)',
  margin: '0 0 0.5rem 0',
};

export const ResetPasswordPage = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isStrongPassword(password)) return setError(PASSWORD_HINT);
    if (password !== confirm) return setError('Passwords do not match.');

    setLoading(true);
    try {
      await authService.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err?.message || 'Could not reset the password. Request a new link and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-warm-ivory)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem' }}>
      <div className="card-static animate-scale-in" style={cardStyle}>
        {done ? (
          <>
            <CheckCircle2 size={44} color="var(--color-emerald)" style={{ marginBottom: '1rem' }} />
            <h2 style={headingStyle}>Password updated</h2>
            <p style={{ color: 'var(--color-muted-green)', marginBottom: '1.5rem' }}>You can now sign in with your new password.</p>
            <Link to="/login"><Button variant="primary" size="lg" style={{ width: '100%' }}>Go to Sign In</Button></Link>
          </>
        ) : !token ? (
          <>
            <h2 style={headingStyle}>Invalid reset link</h2>
            <p style={{ color: 'var(--color-muted-green)', marginBottom: '1.5rem' }}>This link is missing its token. Request a new one.</p>
            <Link to="/forgot-password"><Button variant="primary" size="lg" style={{ width: '100%' }}>Request a new link</Button></Link>
          </>
        ) : (
          <>
            <h2 style={headingStyle}>Choose a new password</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-muted-green)', marginBottom: '1.5rem' }}>{PASSWORD_HINT}</p>
            {error && (
              <div role="alert" style={{ background: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)', borderRadius: 'var(--radius-md)', padding: '0.875rem 1rem', marginBottom: '1.25rem', color: 'var(--color-error)', fontSize: '0.875rem', fontWeight: 500 }}>
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
              <Input label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <Input label="Confirm new password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              <div style={{ marginTop: '1.25rem' }}>
                <Button type="submit" variant="primary" size="lg" loading={loading} style={{ width: '100%' }}>Reset Password</Button>
              </div>
              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <Link to="/login" style={{ fontSize: '0.885rem', color: 'var(--color-emerald)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <ArrowLeft size={16} /> Back to Sign In
                </Link>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
