import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Compass,
  MapPin,
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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export const Sidebar = () => {
  const { user, logout } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

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
      {/* Mobile Top Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.85rem 1.25rem',
          backgroundColor: 'var(--color-white)',
          borderBottom: '1px solid var(--color-border-subtle)',
          position: 'sticky',
          top: 0,
          zIndex: 90,
        }}
        className="mobile-dashboard-header"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              backgroundColor: 'var(--color-deep-forest)',
              color: 'var(--color-lime)',
              fontSize: '1rem',
            }}
          >
            ✦
          </span>
          <span style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', color: 'var(--color-deep-forest)' }}>
            SkillSense AI
          </span>
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-deep-forest)',
            cursor: 'pointer',
            padding: '4px',
          }}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Backdrop for mobile */}
      {mobileOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(6, 46, 37, 0.4)',
            zIndex: 95,
          }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Student Sidebar Container */}
      <aside
        className={`sidebar-container ${mobileOpen ? 'mobile-open' : ''}`}
        style={{
          width: 'var(--sidebar-width)',
          height: '100vh',
          position: 'sticky',
          top: 0,
          backgroundColor: 'var(--color-white)',
          borderRight: '1px solid var(--color-border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 100,
          transition: 'transform 0.25s ease',
        }}
      >
        {/* Brand Header */}
        <div
          style={{
            padding: '1.5rem 1.35rem 1.25rem',
            borderBottom: '1px solid var(--color-border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
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
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-full)',
                backgroundColor: 'var(--color-emerald)',
                color: 'var(--color-white)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '0.85rem',
                flexShrink: 0,
              }}
            >
              {user?.name ? user.name.charAt(0) : 'N'}
            </div>
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
                {user?.name || 'Nagappa'}
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
                Student · {user?.careerInterest || 'Backend Dev'}
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

      <style>{`
        .mobile-dashboard-header { display: none; }
        @media (max-width: 860px) {
          .mobile-dashboard-header { display: flex !important; }
          .sidebar-container {
            position: fixed !important;
            top: 0;
            left: 0;
            bottom: 0;
            transform: translateX(-100%);
            box-shadow: var(--shadow-xl);
          }
          .sidebar-container.mobile-open {
            transform: translateX(0);
          }
        }
      `}</style>
    </>
  );
};
