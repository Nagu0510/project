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
    badgeStyle.backgroundColor = 'var(--lime-soft)';
    badgeStyle.color = 'var(--text)';
    badgeStyle.border = '1px solid var(--border-mid)';
  } else if (variant === 'emerald') {
    badgeStyle.backgroundColor = 'var(--accent-soft)';
    badgeStyle.color = 'var(--accent)';
    badgeStyle.border = '1px solid var(--accent-soft-strong)';
  } else if (variant === 'forest') {
    badgeStyle.backgroundColor = 'var(--color-deep-forest)';
    badgeStyle.color = 'var(--color-lime)';
  } else if (variant === 'success' || variant === 'Approved' || variant === 'Published') {
    badgeStyle.backgroundColor = 'var(--success-soft)';
    badgeStyle.color = 'var(--success-text)';
    badgeStyle.border = '1px solid var(--success-border)';
  } else if (variant === 'warning' || variant === 'Needs Review' || variant === 'Processing') {
    badgeStyle.backgroundColor = 'var(--warning-soft)';
    badgeStyle.color = 'var(--warning-text)';
    badgeStyle.border = '1px solid var(--warning-border)';
  } else if (variant === 'error' || variant === 'Rejected') {
    badgeStyle.backgroundColor = 'var(--danger-soft)';
    badgeStyle.color = 'var(--danger-text)';
    badgeStyle.border = '1px solid var(--danger-border)';
  } else {
    badgeStyle.backgroundColor = 'var(--bg-subtle)';
    badgeStyle.color = 'var(--text)';
    badgeStyle.border = '1px solid var(--color-border-subtle)';
  }

  return (
    <span className={`badge ${className}`} style={badgeStyle}>
      {Icon && <Icon size={size === 'sm' ? 11 : 13} />}
      {children}
    </span>
  );
};
