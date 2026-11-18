import React, { useRef } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { PREFERENCES, nextPreference, preferenceLabel } from '../../theme/themeCore';
import './ThemeToggle.css';

const ICONS = { light: Sun, dark: Moon, system: Monitor };

/**
 * variant="compact":   one round 36px icon button that cycles Light -> Dark -> System (44px touch target at 768px and below)
 * variant="segmented": a Light / Dark / System radio group (used in Settings > Appearance)
 */
export const ThemeToggle = ({ variant = 'compact', className = '' }) => {
  const { preference, setPreference, cycle } = useTheme();

  if (variant === 'segmented') return <SegmentedToggle preference={preference} setPreference={setPreference} className={className} />;

  const next = nextPreference(preference);
  const label = `Theme: ${preferenceLabel(preference)}. Click to switch to ${preferenceLabel(next)}`;
  return (
    <button type="button" className={`theme-toggle ${className}`} onClick={cycle} aria-label={label} title={label} data-testid="theme-toggle" data-preference={preference}>
      {PREFERENCES.map((name) => {
        const Icon = ICONS[name];
        return <Icon key={name} size={18} aria-hidden="true" className="theme-toggle-icon" data-active={name === preference} />;
      })}
    </button>
  );
};

const SegmentedToggle = ({ preference, setPreference, className }) => {
  const refs = useRef({});
  const onKeyDown = (event) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const target = PREFERENCES[(PREFERENCES.indexOf(preference) + step + PREFERENCES.length) % PREFERENCES.length];
    setPreference(target);
    refs.current[target]?.focus();
  };
  return (
    <div className={`theme-segmented ${className}`} role="radiogroup" aria-label="Theme" data-testid="theme-segmented" onKeyDown={onKeyDown}>
      {PREFERENCES.map((name) => {
        const Icon = ICONS[name];
        const checked = name === preference;
        return (
          <button
            key={name}
            ref={(node) => { refs.current[name] = node; }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            className="theme-segmented-btn"
            data-checked={checked}
            data-testid={`theme-option-${name}`}
            onClick={() => setPreference(name)}
          >
            <Icon size={16} aria-hidden="true" />
            <span>{preferenceLabel(name)}</span>
          </button>
        );
      })}
    </div>
  );
};

export default ThemeToggle;
