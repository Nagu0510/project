import React from 'react';
import { RefreshCw } from 'lucide-react';

/** A request failed: say so plainly, and let the person try again. Used by every page that loads data. */
export const ErrorBanner = ({ title = 'This could not be loaded.', message = '', onRetry, className = '', style = {} }) => (
  <div
    role="alert"
    data-testid="error-banner"
    className={className}
    style={{
      background: '#FEF2F2', border: '1.5px solid #F87171', borderRadius: 'var(--radius-xl)', padding: '1rem 1.25rem',
      marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', color: '#991B1B', ...style,
    }}
  >
    <span style={{ fontSize: '0.9rem' }}>
      <strong>{title}</strong>{message ? ` ${message}` : ''}
    </span>
    {onRetry && (
      <button type="button" onClick={onRetry} className="btn btn-outline btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#991B1B', borderColor: '#F87171', background: '#FFFFFF' }}>
        <RefreshCw size={14} /> Try again
      </button>
    )}
  </div>
);

export default ErrorBanner;
