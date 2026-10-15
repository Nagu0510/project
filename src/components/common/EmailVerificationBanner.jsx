import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { authService } from '../../services/authService';

/** Shown to signed-in students whose email address is not verified yet. */
export const EmailVerificationBanner = () => {
  const { user, isStudent } = useAuth();
  const { addToast } = useToast();
  const [sending, setSending] = useState(false);

  const ref = useRef(null);
  const visible = Boolean(isStudent && user && !user.emailVerified);

  // The fixed sidebar and mobile top bar start below this banner (see --banner-height in index.css)
  useEffect(() => {
    const root = document.documentElement;
    if (!visible || !ref.current) {
      root.style.removeProperty('--banner-height');
      return undefined;
    }
    const el = ref.current;
    const sync = () => root.style.setProperty('--banner-height', `${el.offsetHeight}px`);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => { observer.disconnect(); root.style.removeProperty('--banner-height'); };
  }, [visible]);

  if (!visible) return null;

  const resend = async () => {
    setSending(true);
    try {
      const res = await authService.sendVerification();
      addToast(res.message || 'Verification email sent.', 'success');
    } catch (err) {
      addToast(err?.message || 'Could not send the email. Please try again.', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      ref={ref}
      role="status"
      style={{
        position: 'sticky', top: 0, zIndex: 200, display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem',
        alignItems: 'center', justifyContent: 'center', padding: '0.5rem 1rem', textAlign: 'center',
        background: 'var(--color-lime-soft, #eef7c8)', color: 'var(--color-deep-forest, #0f3d2e)',
        fontSize: '0.85rem', borderBottom: '1px solid var(--color-border-subtle)',
      }}
    >
      <span>Verify your email to get placement updates.</span>
      <button type="button" className="btn btn-outline btn-sm" onClick={resend} disabled={sending}>
        {sending ? 'Sending...' : 'Resend verification email'}
      </button>
    </div>
  );
};

export default EmailVerificationBanner;
