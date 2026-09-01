import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingState } from './LoadingState';

export const AdminRoute = ({ children }) => {
  const { isAuthenticated, isAdmin, isAuthLoading } = useAuth();
  const { addToast } = useToast();

  useEffect(() => {
    if (!isAuthLoading && isAuthenticated && !isAdmin) {
      addToast('Access Denied: Administrator privileges required.', 'error');
    }
  }, [isAuthLoading, isAuthenticated, isAdmin, addToast]);

  if (isAuthLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-warm-ivory)' }}>
        <LoadingState message="Verifying administrator credentials..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default AdminRoute;
