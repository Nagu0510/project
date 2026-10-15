import { Avatar } from './Avatar';
import React from 'react';
import { useMobileSidebar } from '../../hooks/useMobileLayout';
import { MobileSidebarChrome } from './MobileSidebarChrome';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Compass,
  MapPin,
  BookOpen,
  FileCheck2,
  Code2,
  FileText,
  Briefcase,
  HelpCircle,
  Building2,
  User,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNotifications } from '../../context/NotificationContext';

export const Sidebar = () => {
  const { user, logout } = useAuth();
  const { addToast } = useToast();
  const { toggleDrawer, unreadCount } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile, open: mobileOpen, setOpen: setMobileOpen, close: closeMobile, toggle: toggleMobile } = useMobileSidebar();

  const handleLogout = () => {
    logout();
    addToast('Logged out successfully', 'info');
    navigate('/login');
  };

  // Strictly Student navigation items
  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Career Paths', path: '/career-paths', icon: Compass },
    { label: 'Roadmap', path: '/roadmap', icon: MapPin },
    { label: 'Courses', path: '/courses', icon: BookOpen },
    { label: 'Skill Assessment', path: '/assessment', icon: FileCheck2 },
    { label: 'Practice', path: '/practice', icon: Code2 },
    { label: 'Resume Analyzer', path: '/resume-analyzer', icon: FileText },
    { label: 'Placements', path: '/placement-tracker', icon: Briefcase },
    { label: 'Previous Questions', path: '/previous-questions', icon: HelpCircle, badge: 'Hot' },
    { label: 'Company Prep', path: '/company-prep/tcs', icon: Building2 },
  ];

  const bottomItems = [
    { label: 'Profile', path: '/profile', icon: User },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <>
      {isMobile && <MobileSidebarChrome title="SkillSense AI" open={mobileOpen} onToggle={toggleMobile} onClose={closeMobile} />}

            {/* Student Sidebar Container */}
      <aside className={`app-sidebar ${mobileOpen ? 'open' : ''}`} aria-label="Main navigation">
        {/* Brand Header */}
        <div
          style={{
            padding: '1.5rem 1.35rem 1.25rem',
            borderBottom: '1px solid var(--color-border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                backgroundColor: 'var(--color-deep-forest)',
                color: 'var(--color-lime)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem',
                boxShadow: '0 2px 8px rgba(6, 46, 37, 0.2)',
              }}
            >
              ✦
            </div>
            <div>
              <div
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1.35rem',
                  color: 'var(--color-deep-forest)',
                  lineHeight: 1.1,
                }}
              >
                SkillSense AI
              </div>
              <div style={{ fontSize: '0.725rem', color: 'var(--color-muted-green)', fontWeight: 500 }}>
                Student Learning Track
              </div>
            </div>
          </div>

          <button
            onClick={toggleDrawer}
            title="Notifications" aria-label="Notifications"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-deep-forest)',
              padding: '6px',
              borderRadius: 'var(--radius-md)',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  backgroundColor: 'var(--color-emerald)',
                  color: 'var(--color-white)',
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Navigation List */}
        <div
          style={{
            flex: 1,
            padding: '1rem 0.75rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          <div
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--color-muted-green)',
              padding: '0.4rem 0.6rem 0.6rem',
            }}
          >
            Career Learning
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  color: isActive ? 'var(--color-emerald)' : 'var(--color-charcoal-subtle)',
                  backgroundColor: isActive ? 'var(--color-emerald-alpha)' : 'transparent',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.885rem',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                  border: isActive ? '1px solid rgba(15, 118, 110, 0.18)' : '1px solid transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'var(--color-ivory-surface)';
                    e.currentTarget.style.color = 'var(--color-deep-forest)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--color-charcoal-subtle)';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Icon size={18} color={isActive ? 'var(--color-emerald)' : 'var(--color-muted-green)'} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: 'var(--color-lime-soft)',
                      color: 'var(--color-deep-forest)',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}

          <div
            style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--color-muted-green)',
              padding: '1rem 0.6rem 0.4rem',
            }}
          >
            Preferences
          </div>

          {bottomItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  color: isActive ? 'var(--color-emerald)' : 'var(--color-charcoal-subtle)',
                  backgroundColor: isActive ? 'var(--color-emerald-alpha)' : 'transparent',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.885rem',
                  textDecoration: 'none',
                  transition: 'all 0.15s ease',
                  border: isActive ? '1px solid rgba(15, 118, 110, 0.18)' : '1px solid transparent',
                }}
              >
                <Icon size={18} color={isActive ? 'var(--color-emerald)' : 'var(--color-muted-green)'} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>

        {/* User Card & Logout */}
        <div
          style={{
            padding: '1rem 1.15rem',
            borderTop: '1px solid var(--color-border-subtle)',
            backgroundColor: 'var(--color-ivory-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
            <Avatar user={user} size={36} background="var(--color-emerald)" color="var(--color-white)" />
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: 'var(--color-deep-forest)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user?.name || 'Student'}
              </div>
              <div
                style={{
                  fontSize: '0.72rem',
                  color: 'var(--color-muted-green)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                Student{user?.careerInterest ? ` · ${user.careerInterest}` : ''}
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-muted-green)',
              padding: '6px',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.15s ease',
            }}
            title="Log Out"
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-error)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-muted-green)')}
          >
            <LogOut size={17} />
          </button>
        </div>
      </aside>

    </>
  );
};
