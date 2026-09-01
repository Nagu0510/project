import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { normalizeUser } from '../utils/normalizers';
import { safeStorage } from '../utils/storage';

const AuthContext = createContext(null);

export const DEFAULT_STUDENT_USER = {
  id: "usr-student-01",
  name: "Nagappa Gongadi",
  email: "nagappa@skillsense.ai",
  role: "student",
  college: "Engineering College",
  department: "Computer Science & Engineering",
  year: "Final Year (2026)",
  careerInterest: "Backend Developer",
  currentPath: "Backend Developer",
  preferredLanguage: "Python 3",
  skillLevel: "Intermediate",
  readinessScore: 87,
  skillProgress: 74,
  assessmentsCompleted: 1,
  strongSkills: ["Python", "SQL", "Java", "REST APIs"],
  gapSkills: ["System Design", "Docker", "Kubernetes"],
  avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
};

export const DEFAULT_ADMIN_USER = {
  id: "usr-admin-01",
  name: "SkillSense Admin",
  email: "admin@skillsense.ai",
  role: "admin",
  department: "Platform Engineering & Placement Intelligence",
  managedPapersCount: 46,
  extractedQuestionsCount: 2840,
  verifiedCompanies: 18,
  avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
};

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

  // Verify session with FastAPI backend on mount
  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      const token = localStorage.getItem('skillsense_token');
      if (token) {
        try {
          const me = await authService.getMe();
          if (me && isMounted) {
            const normalized = normalizeUser(me);
            setUser(normalized);
            setIsAuthenticated(true);
            safeStorage.set('user', normalized);
            safeStorage.set('auth', 'true');
          }
        } catch (err) {
          console.warn('[Auth] Session validation terminated:', err.message);
          if (isMounted) {
            authService.logout();
            safeStorage.clearSkillSenseKeys();
            setUser(null);
            setIsAuthenticated(false);
          }
        }
      } else {
        if (isMounted) {
          setUser(null);
          setIsAuthenticated(false);
        }
      }

      if (isMounted) {
        setIsAuthLoading(false);
      }
    };

    checkSession();
    return () => {
      isMounted = false;
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

  // Student Login with FastAPI & JWT
  const login = async (email, password) => {
    const resp = await authService.login(email, password);
    const apiUser = resp.user;
    const updatedUser = normalizeUser(apiUser);
    setUser(updatedUser);
    setIsAuthenticated(true);
    safeStorage.set('user', updatedUser);
    safeStorage.set('auth', 'true');
    closeAuthModal();
    return { success: true, user: updatedUser };
  };

  // Dedicated Admin Login
  const adminLogin = async (email, password) => {
    const resp = await authService.adminLogin(email, password);
    const apiAdmin = resp.user;
    const updatedAdmin = {
      ...DEFAULT_ADMIN_USER,
      ...apiAdmin,
      role: 'admin',
    };
    setUser(updatedAdmin);
    setIsAuthenticated(true);
    safeStorage.set('user', updatedAdmin);
    safeStorage.set('auth', 'true');
    closeAuthModal();
    return { success: true, user: updatedAdmin };
  };

  // Student Registration
  const signup = async (fullName, email, password, careerInterest) => {
    const resp = await authService.register(fullName, email, password, careerInterest);
    const apiUser = resp.user;
    const newUser = normalizeUser(apiUser);
    setUser(newUser);
    setIsAuthenticated(true);
    safeStorage.set('user', newUser);
    safeStorage.set('auth', 'true');
    closeAuthModal();
    return { success: true, user: newUser };
  };

  const logout = () => {
    authService.logout();
    safeStorage.clearSkillSenseKeys();
    setUser(null);
    setIsAuthenticated(false);
  };

  const updateUserProfile = (updatedFields) => {
    if (user) {
      setUser((prev) => {
        const nextUser = normalizeUser({
          ...prev,
          ...updatedFields,
        });
        safeStorage.set('user', nextUser);
        return nextUser;
      });
    }
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
