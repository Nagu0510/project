import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { preferenceLabel } from '../../theme/themeCore';
import { ThemeToggle } from './ThemeToggle';

/** Settings > Appearance: Light / Dark / System plus a small card that is drawn with the live tokens. Saved in this browser only. */
export const AppearanceSection = () => {
  const { preference, resolvedTheme } = useTheme();
  return (
    <div data-testid="appearance-section">
      <h3 style={{ fontSize: '1.35rem', fontFamily: 'var(--font-serif)', color: 'var(--text)', margin: '0 0 0.5rem 0' }}>Appearance</h3>
      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
        Choose how SkillSense AI looks. System follows your device. This choice is saved in this browser only.
      </p>
      <ThemeToggle variant="segmented" />
      <p role="status" data-testid="appearance-status" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.75rem 0 1.25rem' }}>
        Selected: {preferenceLabel(preference)}. Showing the {resolvedTheme} theme.
      </p>
      <div data-testid="appearance-preview" style={{ background: 'var(--bg)', border: '1px solid var(--border-mid)', borderRadius: 'var(--radius-lg)', padding: '1rem', maxWidth: 420 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <strong style={{ color: 'var(--text)', fontSize: '0.95rem' }}>Preview card</strong>
            <span className="badge badge-success">Passed</span>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Text, surfaces and buttons use the same colours as the rest of the app.</p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span className="btn btn-primary btn-sm" aria-hidden="true">Primary</span>
            <span className="btn btn-outline btn-sm" aria-hidden="true">Outline</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppearanceSection;
