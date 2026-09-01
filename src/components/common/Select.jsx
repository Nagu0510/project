import React from 'react';
import { ChevronDown } from 'lucide-react';

export const Select = ({
  label,
  name,
  value,
  onChange,
  options = [],
  placeholder = 'Select an option',
  error,
  helperText,
  required = false,
  disabled = false,
  className = '',
  style = {},
  ...props
}) => {
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
        <select
          name={name}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
          style={{
            width: '100%',
            padding: '0.7rem 2.5rem 0.7rem 1rem',
            borderRadius: 'var(--radius-md)',
            border: `1px solid ${error ? 'var(--color-error)' : 'var(--color-border-medium)'}`,
            backgroundColor: disabled ? 'var(--color-ivory-muted)' : 'var(--color-white)',
            color: 'var(--color-deep-forest)',
            fontSize: '0.925rem',
            outline: 'none',
            appearance: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
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
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => {
            const isObj = typeof opt === 'object' && opt !== null;
            const val = isObj ? opt.value : opt;
            const labelText = isObj ? opt.label : opt;
            return (
              <option key={val} value={val}>
                {labelText}
              </option>
            );
          })}
        </select>

        <div
          style={{
            position: 'absolute',
            right: '12px',
            pointerEvents: 'none',
            color: 'var(--color-muted-green)',
            display: 'flex',
          }}
        >
          <ChevronDown size={18} />
        </div>
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
