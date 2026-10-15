import React from 'react';
import { useMobileSidebar } from '../../hooks/useMobileLayout';
import { MobileSidebarChrome } from '../common/MobileSidebarChrome';
import { NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  FileSpreadsheet,
  Database,
  PencilRuler,
  FileCheck2,
  Building2,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Sparkles,
  Menu,
  X,
  ShieldCheck,
  ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export const AdminSidebar = () => {
  const { user, logout } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile, open: mobileOpen, setOpen: setMobileOpen, close: closeMobile, toggle: toggleMobile } = useMobileSidebar();

  const handleLogout = () => {
    logout();
    addToast('Admin logged out successfully.', 'info');
    navigate('/admin/login');
  };

  const adminNavItems = [
    { label: 'Admin Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Question Papers', path: '/admin/question-papers', icon: FileSpreadsheet, badge: 'Active' },
    { label: 'Question Bank', path: '/admin/question-bank', icon: Database },
    { label: 'Assessments', path: '/admin/assessments', icon: FileCheck2 },
    { label: 'Content Editor', path: '/admin/content', icon: PencilRuler },
    { label: 'Companies', path: '/admin/companies', icon: Building2 },
    { label: 'Students', path: '/admin/students', icon: Users },
    { label: 'Analytics', path: '/admin/analytics', icon: BarChart3 },
  ];

  const adminBottomItems = [
    { label: 'Admin Settings', path: '/admin/settings', icon: Settings },
  ];

  return (
    <>
      {isMobile && <MobileSidebarChrome title="SkillSense Admin" open={mobileOpen} onToggle={toggleMobile} onClose={closeMobile} />}

            {/* Admin Sidebar Container */}
      <aside className={`app-sidebar ${mobileOpen ? 'open' : ''}`} aria-label="Main navigation">
        {/* Admin Brand Header */}
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
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: 'var(--color-deep-forest)',
              color: 'var(--color-lime)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.15rem',
              boxShadow: '0 2px 8px rgba(6, 46, 37, 0.25)',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: 'var(--color-deep-forest)',
                  backgroundColor: 'var(--color-lime-soft)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                }}
              >
                Admin Console
              </span>
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
            Management
          </div>

          {adminNavItems.map((item) => {
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
                      backgroundColor: 'rgba(15, 118, 110, 0.12)',
                      color: 'var(--color-emerald)',
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
            System
          </div>

          {adminBottomItems.map((item) => {
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

          {/* Quick link to Student View */}
          <div style={{ marginTop: '0.75rem', padding: '0 0.25rem' }}>
            <Link
              to="/dashboard"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.55rem 0.75rem',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-ivory-surface)',
                border: '1px solid var(--color-border-subtle)',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: 'var(--color-emerald)',
                textDecoration: 'none',
              }}
            >
              <span>View Student Portal</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>

        {/* Admin Profile & Logout */}
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
                backgroundColor: 'var(--color-deep-forest)',
                color: 'var(--color-lime)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '0.9rem',
                flexShrink: 0,
              }}
            >
              A
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: 'var(--color-deep-forest)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user?.name || 'Administrator'}
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
                Role: Platform Admin
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
            title="Log Out Admin"
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
