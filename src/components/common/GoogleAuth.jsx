import React, { useEffect, useRef, useState } from 'react';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
export const isGoogleAuthEnabled = Boolean(CLIENT_ID);

let gsiLoader = null;
let gsiInitialized = false;
const activeHandlers = { current: null };
const loadGoogleIdentity = () => {
  if (!gsiLoader) {
    gsiLoader = new Promise((resolve, reject) => {
      if (window.google?.accounts?.id) return resolve();
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => {
        gsiLoader = null; // allow a retry on the next mount
        reject(new Error('Could not load Google sign-in. Check your connection and try again.'));
      };
      document.head.appendChild(script);
    });
  }
  return gsiLoader;
};

const FALLBACK_BUTTON = {
  width: '100%', maxWidth: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
  padding: '0.7rem 1rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--color-border-medium)',
  background: 'var(--color-white)', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer',
};

/**
 * "or" divider + the official Google button (Google Identity Services).
 * Not configured: nothing in production, a small note in development.
 * If Google refuses to draw its button (for example this site's address is not an authorized origin
 * for the client) a visible "Continue with Google" button explains that, instead of leaving a blank gap.
 * `onCredential(idToken)` receives the Google ID token; the server verifies it.
 */
export const GoogleAuth = ({ onCredential, onError, text = 'continue_with' }) => {
  const holder = useRef(null);
  const handlers = useRef({ onCredential, onError });
  handlers.current = { onCredential, onError };
  activeHandlers.current = handlers.current;
  const [unavailable, setUnavailable] = useState(false);
  const [explain, setExplain] = useState(false);

  useEffect(() => {
    if (!isGoogleAuthEnabled) return undefined;
    let cancelled = false;
    let timer;
    loadGoogleIdentity()
      .then(() => {
        if (cancelled || !holder.current) return;
        // initialize() may only run once per page load (React StrictMode and remounts re-run this effect).
        // The callback is module-level and forwards to whichever page is mounted now.
        if (!gsiInitialized) {
          gsiInitialized = true;
          window.google.accounts.id.initialize({
            client_id: CLIENT_ID,
            callback: (resp) => activeHandlers.current?.onCredential?.(resp.credential),
          });
        }
        window.google.accounts.id.renderButton(holder.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text,
          width: Math.min(holder.current.offsetWidth || 360, 400),
        });
        // Google answers a refused client with an empty 0x0 iframe and no callback: watch for the real button.
        const started = Date.now();
        timer = setInterval(() => {
          const frame = holder.current?.querySelector('iframe');
          if (frame && frame.offsetWidth > 0) {
            clearInterval(timer);
          } else if (Date.now() - started > 6000) {
            clearInterval(timer);
            if (!cancelled) setUnavailable(true);
          }
        }, 400);
      })
      .catch(() => { if (!cancelled) setUnavailable(true); });
    return () => { cancelled = true; clearInterval(timer); };
  }, [text]);

  if (!isGoogleAuthEnabled) {
    if (!import.meta.env.DEV) return null; // production: no button, no note
    return (
      <p data-testid="google-not-configured" style={{ marginTop: '1.25rem', fontSize: '0.78rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
        Google sign-in not configured (development note): set <code>VITE_GOOGLE_CLIENT_ID</code> in the root <code>.env</code> and restart <code>npm run dev</code>.
      </p>
    );
  }

  const label = text === 'signup_with' ? 'Sign up with Google' : text === 'signin_with' ? 'Sign in with Google' : 'Continue with Google';
  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--color-text-muted)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
        <span style={{ flex: 1, height: 1, background: 'var(--color-border-subtle)' }} />
        or
        <span style={{ flex: 1, height: 1, background: 'var(--color-border-subtle)' }} />
      </div>

      {/* Google draws its own button into this box */}
      <div ref={holder} style={{ display: unavailable ? 'none' : 'flex', justifyContent: 'center', minHeight: 44 }} />

      {unavailable && (
        <div data-testid="google-unavailable" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <button type="button" style={FALLBACK_BUTTON} onClick={() => setExplain(true)}>
            <span aria-hidden="true" style={{ fontWeight: 800, color: '#4285F4' }}>G</span>
            {label}
          </button>
          {explain && (
            <p role="alert" style={{ fontSize: '0.8rem', lineHeight: 1.5, color: 'var(--color-error)', textAlign: 'center', margin: 0 }}>
              Google sign-in isn't available right now. Please use your email and password.
              {import.meta.env.DEV && (
                <>
                  <br />
                  <span style={{ color: 'var(--color-text-muted)' }}>
                    Development: Google refused this address ({window.location.origin}). Add it under Authorized JavaScript origins for the OAuth client in Google Cloud Console, then reload.
                  </span>
                </>
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default GoogleAuth;
