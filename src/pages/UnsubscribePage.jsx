import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '../components/common/Button';
import { LoadingState } from '../components/common/LoadingState';
import { api } from '../services/api';

/** The one-click unsubscribe link from a placement email. No login needed; the signed token works once. */
export const UnsubscribePage = () => {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [state, setState] = useState(token ? 'loading' : 'error');
  const [message, setMessage] = useState(token ? '' : 'This link is missing its token.');
  const started = useRef(false); // single-use token: never send it twice (React StrictMode runs effects twice)

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    api.post('/notifications/unsubscribe', { token })
      .then((res) => { setMessage(res?.message || 'Email notifications are off.'); setState('done'); })
      .catch((err) => { setMessage(err?.message || 'This unsubscribe link is not valid.'); setState('error'); });
  }, [token]);

  if (state === 'loading') return <LoadingState message="Turning email notifications off..." />;

  const ok = state === 'done';
  const Icon = ok ? CheckCircle2 : XCircle;
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-warm-ivory)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.5rem' }}>
      <div className="card-static" data-testid="unsubscribe-result" data-ok={ok} style={{ width: '100%', maxWidth: '460px', background: 'var(--color-white)', borderRadius: 'var(--radius-2xl)', padding: '2.5rem', border: '1px solid var(--color-border-subtle)', textAlign: 'center' }}>
        <Icon size={44} color={ok ? 'var(--color-emerald)' : 'var(--color-error)'} style={{ marginBottom: '1rem' }} />
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem', color: 'var(--color-deep-forest)', margin: '0 0 0.5rem' }}>
          {ok ? 'You are unsubscribed' : 'Link not valid'}
        </h2>
        <p style={{ color: 'var(--color-muted-green)', marginBottom: '1.5rem' }}>{message}</p>
        <Link to="/settings"><Button variant="primary" size="lg" style={{ width: '100%' }}>Open Settings</Button></Link>
      </div>
    </div>
  );
};

export default UnsubscribePage;
