import React from 'react';
import { Loader2 } from 'lucide-react';

export const Button = ({
  children,
  variant = 'primary', // 'primary' | 'lime' | 'outline' | 'outline-emerald' | 'ghost' | 'danger'
  size = 'md', // 'sm' | 'md' | 'lg'
  icon: Icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  className = '',
  style = {},
  onClick,
  type = 'button',
  ...props
}) => {
  let variantClass = 'btn-primary';
  if (variant === 'lime') variantClass = 'btn-lime';
  if (variant === 'outline') variantClass = 'btn-outline';
  if (variant === 'outline-emerald') variantClass = 'btn-outline-emerald';
  if (variant === 'ghost') variantClass = 'btn-ghost';
  if (variant === 'danger') variantClass = 'btn-danger';

  let sizeClass = '';
  if (size === 'sm') sizeClass = 'btn-sm';
  if (size === 'lg') sizeClass = 'btn-lg';

  return (
    <button
      type={type}
      className={`btn ${variantClass} ${sizeClass} ${className}`}
      disabled={disabled || loading}
      onClick={onClick}
      style={{
        opacity: disabled ? 0.6 : 1,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        ...style,
      }}
      {...props}
    >
      {loading ? (
        <Loader2 size={size === 'sm' ? 14 : 18} className="animate-spin" />
      ) : (
        <>
          {Icon && iconPosition === 'left' && <Icon size={size === 'sm' ? 14 : 18} />}
          {children}
          {Icon && iconPosition === 'right' && <Icon size={size === 'sm' ? 14 : 18} />}
        </>
      )}
    </button>
  );
};
