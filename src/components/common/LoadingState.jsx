import React from 'react';
import { Sparkles, Loader2 } from 'lucide-react';

export const LoadingState = ({ message = 'Analyzing skills & intelligence...', subtitle = 'Please wait while we process the latest insights' }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3.5rem 1.5rem',
        textAlign: 'center',
        width: '100%',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '64px',
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.25rem',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'var(--radius-full)',
            border: '2px solid rgba(15, 118, 110, 0.2)',
            borderTopColor: 'var(--color-emerald)',
            animation: 'spinSlow 1.2s linear infinite',
          }}
        />
        <Sparkles size={24} color="var(--color-emerald)" />
      </div>

      <h4
        style={{
          fontSize: '1.15rem',
          fontFamily: 'var(--font-serif)',
          color: 'var(--color-deep-forest)',
          margin: '0 0 0.4rem 0',
        }}
      >
        {message}
      </h4>
      <p style={{ fontSize: '0.875rem', color: 'var(--color-muted-green)', maxWidth: '380px', margin: 0 }}>
        {subtitle}
      </p>
    </div>
  );
};
