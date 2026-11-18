import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { learningService } from '../services/learningService';

const NotificationContext = createContext(null);

// Notifications come from the backend (for example "You finished C Programming"). Until something real happens the list is empty.
export const NotificationProvider = ({ children }) => {
  const { isStudent, user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!isStudent) { setNotifications([]); return; }
    try {
      setNotifications(await learningService.getNotifications());
    } catch {
      setNotifications([]); // never show made-up alerts when the request fails
    }
  }, [isStudent]);

  useEffect(() => { refresh(); }, [refresh, user?.id]);
  useEffect(() => { if (isDrawerOpen) refresh(); }, [isDrawerOpen, refresh]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try { await learningService.markNotificationRead(id); } catch { refresh(); }
  };

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try { await learningService.markAllNotificationsRead(); } catch { refresh(); }
  };

  const toggleDrawer = () => setIsDrawerOpen((prev) => !prev);
  const closeDrawer = () => setIsDrawerOpen(false);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, isDrawerOpen, toggleDrawer, closeDrawer, markAsRead, markAllAsRead, refresh }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
