import React from 'react';

export const Badge = ({
  children,
  variant = 'neutral', // 'lime' | 'emerald' | 'forest' | 'success' | 'warning' | 'error' | 'neutral'
  size = 'md', // 'sm' | 'md'
  icon: Icon,
  className = '',
  style = {},
}) => {
  let badgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    borderRadius: 'var(--radius-full)',
    fontWeight: 600,
    letterSpacing: '0.02em',
    fontSize: size === 'sm' ? '0.7rem' : '0.785rem',
    padding: size === 'sm' ? '2px 8px' : '4px 10px',
    textTransform: 'none',
    ...style,
  };

  if (variant === 'lime') {
    badgeStyle.backgroundColor = 'var(--color-lime-soft)';
    badgeStyle.color = 'var(--color-deep-forest)';
    badgeStyle.border = '1px solid rgba(199, 243, 107, 0.4)';
  } else if (variant === 'emerald') {
    badgeStyle.backgroundColor = 'rgba(15, 118, 110, 0.08)';
    badgeStyle.color = 'var(--color-emerald)';
    badgeStyle.border = '1px solid rgba(15, 118, 110, 0.22)';
  } else if (variant === 'forest') {
    badgeStyle.backgroundColor = 'var(--color-deep-forest)';
    badgeStyle.color = 'var(--color-lime)';
  } else if (variant === 'success' || variant === 'Approved' || variant === 'Published') {
    badgeStyle.backgroundColor = '#ECFDF5';
    badgeStyle.color = '#059669';
    badgeStyle.border = '1px solid rgba(5, 150, 105, 0.2)';
  } else if (variant === 'warning' || variant === 'Needs Review' || variant === 'Processing') {
    badgeStyle.backgroundColor = '#FFFBEB';
    badgeStyle.color = '#D97706';
    badgeStyle.border = '1px solid rgba(217, 119, 6, 0.2)';
  } else if (variant === 'error' || variant === 'Rejected') {
    badgeStyle.backgroundColor = '#FEF2F2';
    badgeStyle.color = '#DC2626';
    badgeStyle.border = '1px solid rgba(220, 38, 38, 0.2)';
  } else {
    badgeStyle.backgroundColor = 'var(--color-ivory-muted)';
    badgeStyle.color = 'var(--color-charcoal-subtle)';
    badgeStyle.border = '1px solid var(--color-border-subtle)';
  }

  return (
    <span className={`badge ${className}`} style={badgeStyle}>
      {Icon && <Icon size={size === 'sm' ? 11 : 13} />}
      {children}
    </span>
  );
};
