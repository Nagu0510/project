import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LoadingState } from './LoadingState';

export const StudentRoute = ({ children }) => {
  const { isAuthenticated, isStudent, isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-warm-ivory)' }}>
        <LoadingState message="Restoring student session..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Role is enforced by the server too; this just sends other roles to their own area.
  if (!isStudent) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return children;
};

export default StudentRoute;
