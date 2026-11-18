import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { normalizeUser } from '../utils/normalizers';
import { safeStorage } from '../utils/storage';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // AuthGate Modal State
  const [authModal, setAuthModal] = useState({
    isOpen: false,
    redirectPath: null,
    title: 'Unlock Your Personalized Experience',
    message: 'Create a free SkillSense AI account to continue.',
  });

  const clearSession = () => {
    setUser(null);
    setIsAuthenticated(false);
  };

  // Restore the session from the httpOnly refresh cookie on mount
  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      try {
        const session = await authService.restoreSession();
        if (isMounted && session?.user) {
          setUser(normalizeUser(session.user));
          setIsAuthenticated(true);
        }
      } catch (err) {
        console.warn('[Auth] Session restore failed:', err.message);
      }
      if (isMounted) setIsAuthLoading(false);
    };

    const handleExpired = () => {
      safeStorage.clearSkillSenseKeys();
      if (isMounted) clearSession();
    };

    window.addEventListener('skillsense:auth:expired', handleExpired);
    checkSession();
    return () => {
      isMounted = false;
      window.removeEventListener('skillsense:auth:expired', handleExpired);
    };
  }, []);

  const openAuthModal = ({ redirectPath = null, title = null, message = null } = {}) => {
    setAuthModal({
      isOpen: true,
      redirectPath: redirectPath || window.location.pathname,
      title: title || 'Unlock Your Personalized Experience',
      message: message || 'Create a free SkillSense AI account to continue.',
    });
  };

  const closeAuthModal = () => {
    setAuthModal((prev) => ({ ...prev, isOpen: false }));
  };

  const requireAuth = (callback, targetRedirectPath = null) => {
    if (isAuthenticated && user) {
      if (typeof callback === 'function') callback();
      return true;
    }
    openAuthModal({ redirectPath: targetRedirectPath || window.location.pathname });
    return false;
  };

  const finishLogin = (apiUser) => {
    const nextUser = normalizeUser(apiUser);
    setUser(nextUser);
    setIsAuthenticated(true);
    closeAuthModal();
    return { success: true, user: nextUser };
  };

  const login = async (email, password) => finishLogin((await authService.login(email, password)).user);

  const adminLogin = async (email, password) => finishLogin((await authService.adminLogin(email, password)).user);

  const googleLogin = async (credential) => finishLogin((await authService.googleLogin(credential)).user);

  const signup = async (fullName, email, password, careerInterest) =>
    finishLogin((await authService.register(fullName, email, password, careerInterest)).user);

  const logout = async () => {
    clearSession(); // sign out in the UI immediately; revoke on the server in the background
    await authService.logout();
  };

  const updateUserProfile = (updatedFields) => {
    setUser((prev) => (prev ? normalizeUser({ ...prev, ...updatedFields }) : prev));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || 'guest',
        isAdmin: user?.role === 'admin',
        isStudent: user?.role === 'student',
        isGuest: !isAuthenticated || !user,
        isAuthenticated,
        isAuthLoading,
        authModal,
        openAuthModal,
        closeAuthModal,
        requireAuth,
        login,
        adminLogin,
        googleLogin,
        signup,
        logout,
        updateUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
