import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    const newToast = { id, message, type, duration };

    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {/* Floating Toast Container */}
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxWidth: '420px',
          width: 'calc(100% - 48px)',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((toast) => {
          let bg = 'var(--surface-raised)';
          let border = 'var(--border-mid)';
          let iconColor = 'var(--accent)';
          let Icon = Info;

          if (toast.type === 'success') {
            border = 'var(--success-border)';
            iconColor = 'var(--success)';
            Icon = CheckCircle2;
          } else if (toast.type === 'error') {
            border = 'var(--danger-border)';
            iconColor = 'var(--danger)';
            Icon = AlertCircle;
          } else if (toast.type === 'warning') {
            border = 'var(--warning-border)';
            iconColor = 'var(--warning)';
            Icon = AlertTriangle;
          }

          return (
            <div
              key={toast.id}
              className="animate-fade-in"
              style={{
                pointerEvents: 'auto',
                backgroundColor: bg,
                border: `1px solid ${border}`,
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-xl)',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Icon size={18} color={iconColor} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}>
                  {toast.message}
                </span>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-muted-green)',
                  display: 'flex',
                  padding: '2px',
                }}
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
