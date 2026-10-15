import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '../components/common/Button';
import { LoadingState } from '../components/common/LoadingState';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';

export const VerifyEmailPage = () => {
  const [params] = useSearchParams();
  const token = params.get('token');
  const { isAuthenticated, updateUserProfile } = useAuth();
  const [state, setState] = useState(token ? 'loading' : 'error');
  const [message, setMessage] = useState(token ? '' : 'This link is missing its token.');
  const started = useRef(false); // the token is single-use: never call twice (React StrictMode runs effects twice)

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    authService.verifyEmail(token)
      .then((res) => {
        setMessage(res.message || 'Email verified.');
        setState('done');
        updateUserProfile({ emailVerified: true });
      })
      .catch((err) => {
        setMessage(err?.message || 'This verification link is invalid or has expired.');
        setState('error');
      });
  }, [token, updateUserProfile]);

  if (state === 'loading') {
    return <LoadingState message="Verifying your email..." />;
  }

  const ok = state === 'done';
  const Icon = ok ? CheckCircle2 : XCircle;
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-warm-ivory)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem' }}>
      <div className="card-static" style={{ width: '100%', maxWidth: '460px', background: 'var(--color-white)', borderRadius: 'var(--radius-2xl)', padding: '2.5rem', border: '1px solid var(--color-border-subtle)', textAlign: 'center' }}>
        <Icon size={44} color={ok ? 'var(--color-emerald)' : 'var(--color-error)'} style={{ marginBottom: '1rem' }} />
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem', color: 'var(--color-deep-forest)', margin: '0 0 0.5rem' }}>
          {ok ? 'Email verified' : 'Verification failed'}
        </h2>
        <p style={{ color: 'var(--color-muted-green)', marginBottom: '1.5rem' }}>{message}</p>
        <Link to={isAuthenticated ? '/dashboard' : '/login'}>
          <Button variant="primary" size="lg" style={{ width: '100%' }}>{isAuthenticated ? 'Go to dashboard' : 'Go to Sign In'}</Button>
        </Link>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
