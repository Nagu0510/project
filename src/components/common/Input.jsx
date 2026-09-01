import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export const Input = ({
  label,
  type = 'text',
  name,
  value,
  onChange,
  placeholder,
  error,
  helperText,
  icon: Icon,
  required = false,
  disabled = false,
  className = '',
  style = {},
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPasswordType = type === 'password';
  const effectiveType = isPasswordType ? (showPassword ? 'text' : 'password') : type;

  return (
    <div className={`form-control ${className}`} style={{ marginBottom: '1rem', width: '100%' }}>
      {label && (
        <label
          style={{
            display: 'block',
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--color-deep-forest)',
            marginBottom: '0.4rem',
          }}
        >
          {label} {required && <span style={{ color: 'var(--color-emerald)' }}>*</span>}
        </label>
      )}

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {Icon && (
          <div
            style={{
              position: 'absolute',
              left: '14px',
              color: 'var(--color-muted-green)',
              pointerEvents: 'none',
              display: 'flex',
            }}
          >
            <Icon size={18} />
          </div>
        )}

        <input
          type={effectiveType}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          style={{
            width: '100%',
            padding: '0.7rem 1rem',
            paddingLeft: Icon ? '42px' : '1rem',
            paddingRight: isPasswordType ? '42px' : '1rem',
            borderRadius: 'var(--radius-md)',
            border: `1px solid ${error ? 'var(--color-error)' : 'var(--color-border-medium)'}`,
            backgroundColor: disabled ? 'var(--color-ivory-muted)' : 'var(--color-white)',
            color: 'var(--color-deep-forest)',
            fontSize: '0.925rem',
            outline: 'none',
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            ...style,
          }}
          onFocus={(e) => {
            if (!error) {
              e.target.style.borderColor = 'var(--color-emerald)';
              e.target.style.boxShadow = '0 0 0 3px var(--color-emerald-alpha)';
            }
          }}
          onBlur={(e) => {
            if (!error) {
              e.target.style.borderColor = 'var(--color-border-medium)';
              e.target.style.boxShadow = 'none';
            }
          }}
          {...props}
        />

        {isPasswordType && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: '12px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-muted-green)',
              display: 'flex',
              padding: '4px',
            }}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>

      {error && (
        <p style={{ color: 'var(--color-error)', fontSize: '0.8rem', marginTop: '4px', marginBottom: 0 }}>
          {error}
        </p>
      )}
      {!error && helperText && (
        <p style={{ color: 'var(--color-muted-green)', fontSize: '0.8rem', marginTop: '4px', marginBottom: 0 }}>
          {helperText}
        </p>
      )}
    </div>
  );
};
