import React from 'react';

export const Card = ({
  children,
  variant = 'floating', // 'floating' | 'static' | 'flat' | 'dark'
  className = '',
  style = {},
  onClick,
  ...props
}) => {
  let baseStyle = {
    padding: '1.5rem',
    borderRadius: 'var(--radius-lg)',
    backgroundColor: 'var(--color-white)',
    border: '1px solid var(--color-border-subtle)',
    boxShadow: variant === 'floating' ? 'var(--shadow-md)' : 'var(--shadow-sm)',
    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
    ...style,
  };

  if (variant === 'dark') {
    baseStyle.backgroundColor = 'var(--color-deep-forest)';
    baseStyle.borderColor = 'rgba(199, 243, 107, 0.15)';
    baseStyle.color = 'var(--color-warm-ivory)';
  } else if (variant === 'flat') {
    baseStyle.boxShadow = 'none';
    baseStyle.backgroundColor = 'var(--color-ivory-surface)';
  }

  return (
    <div
      className={`${variant === 'floating' ? 'card-floating' : 'card-static'} ${className}`}
      style={baseStyle}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
};
