import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, Sparkles } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { useToast } from '../context/ToastContext';
import { authService } from '../services/authService';

export const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      addToast('Please provide a valid email address', 'error');
      return;
    }

    setLoading(true);
    try {
      await authService.forgotPassword(email.trim());
      setSubmitted(true);
    } catch (err) {
      addToast(err?.message || 'Could not start password recovery. Please try again.', 'error');
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
        className="card-static animate-scale-in"
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: 'var(--color-white)',
          borderRadius: 'var(--radius-2xl)',
          padding: '2.5rem',
          border: '1px solid var(--color-border-subtle)',
          boxShadow: 'var(--shadow-xl)',
          textAlign: 'center',
        }}
      >
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            textDecoration: 'none',
            marginBottom: '1.75rem',
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
              fontSize: '1.45rem',
              color: 'var(--color-deep-forest)',
            }}
          >
            SkillSense AI
          </span>
        </Link>

        {!submitted ? (
          <>
            <h2
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.85rem',
                color: 'var(--color-deep-forest)',
                margin: '0 0 0.5rem 0',
              }}
            >
              Reset your password
            </h2>
            <p
              style={{
                fontSize: '0.9rem',
                color: 'var(--color-muted-green)',
                marginBottom: '1.75rem',
                lineHeight: 1.5,
              }}
            >
              Enter the email address associated with your SkillSense account and we will send you a secure verification link.
            </p>

            <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
              <Input
                label="Registered Email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={Mail}
                required
              />

              <div style={{ marginTop: '1.5rem', marginBottom: '1.25rem' }}>
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={loading}
                  style={{ width: '100%' }}
                >
                  Send Recovery Link ↗
                </Button>
              </div>

              <div style={{ textAlign: 'center' }}>
                <Link
                  to="/login"
                  style={{
                    fontSize: '0.885rem',
                    color: 'var(--color-emerald)',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <ArrowLeft size={16} /> Back to Sign In
                </Link>
              </div>
            </form>
          </>
        ) : (
          <div className="animate-fade-in">
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--color-lime-soft)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem',
                color: 'var(--color-deep-forest)',
              }}
            >
              <CheckCircle2 size={32} color="var(--color-emerald)" />
            </div>

            <h3
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '1.65rem',
                color: 'var(--color-deep-forest)',
                margin: '0 0 0.5rem 0',
              }}
            >
              Check your inbox
            </h3>
            <p
              style={{
                fontSize: '0.9rem',
                color: 'var(--color-charcoal-subtle)',
                marginBottom: '1.75rem',
                lineHeight: 1.5,
              }}
            >
              If an account exists for <strong>{email}</strong>, a password reset link has been sent. The link expires in 30 minutes.
            </p>

            <Link to="/login" style={{ display: 'block', width: '100%' }}>
              <Button variant="primary" size="md" style={{ width: '100%' }}>
                Return to Sign In
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
