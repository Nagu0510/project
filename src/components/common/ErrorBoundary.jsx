import React from 'react';
import { Button } from './Button';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { safeStorage } from '../../utils/storage';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("SkillSense AI ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    try {
      safeStorage.clearSkillSenseKeys();
    } catch {}
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            backgroundColor: 'var(--bg)',
            color: 'var(--text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: '560px',
              width: '100%',
              backgroundColor: 'var(--surface)',
              borderRadius: '24px',
              padding: '2.5rem',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-lg)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'var(--danger-soft)',
                color: 'var(--danger-text)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1.25rem',
              }}
            >
              <AlertTriangle size={28} />
            </div>

            <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', color: 'var(--text)' }}>
              Something went wrong
            </h2>

            <p style={{ fontSize: '0.925rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              A client runtime issue occurred. Click the button below to reset session storage and reload SkillSense AI.
            </p>

            {this.state.error && (
              <pre
                style={{
                  backgroundColor: 'var(--surface-sunken)',
                  padding: '0.85rem',
                  borderRadius: '10px',
                  fontSize: '0.78rem',
                  color: 'var(--danger-text)',
                  textAlign: 'left',
                  overflowX: 'auto',
                  marginBottom: '1.5rem',
                  maxHeight: '160px',
                }}
              >
                {this.state.error.toString()}
              </pre>
            )}

            <button
              onClick={this.handleReload}
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--text-on-accent)',
                border: 'none',
                padding: '0.75rem 1.75rem',
                borderRadius: '9999px',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: 'pointer',
              }}
            >
              Reset Session & Reload SkillSense AI
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
