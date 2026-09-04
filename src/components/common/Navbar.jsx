import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';

const NAV_LINK_STYLE = (active) => ({
  fontSize: '0.9rem',
  fontWeight: active ? 700 : 500,
  color: active ? 'var(--color-forest)' : 'var(--color-text-muted)',
  textDecoration: 'none',
  padding: '0.35rem 0',
  position: 'relative',
  transition: 'color 200ms ease',
  letterSpacing: '-0.01em',
});

const NavLink = ({ to, children }) => {
  const location = useLocation();
  const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
  return (
    <Link to={to} style={NAV_LINK_STYLE(active)}>
      {children}
      {active && (
        <motion.span
          layoutId="nav-active-dot"
          style={{
            position: 'absolute',
            bottom: '-2px',
            left: 0,
            right: 0,
            height: '2px',
            background: 'var(--color-emerald)',
            borderRadius: '2px',
          }}
        />
      )}
    </Link>
  );
};

export const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { isAuthenticated, user, isStudent, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
    setMobileMenuOpen(false);
  };

  const studentLinks = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/career-paths', label: 'Career Path' },
    { to: '/roadmap', label: 'Roadmap' },
    { to: '/assessment', label: 'Assessments' },
    { to: '/practice', label: 'Practice' },
    { to: '/resume-analyzer', label: 'Resume' },
    { to: '/placement-tracker', label: 'Placements' },
    { to: '/previous-questions', label: 'Questions' },
  ];

  const publicLinks = [
    { to: '/career-paths', label: 'Career Paths' },
    { to: '/assessment', label: 'Assessments' },
    { to: '/practice', label: 'Practice' },
    { to: '/placement-tracker', label: 'Placements' },
    { to: '/about', label: 'About' },
  ];

  const adminLinks = [
    { to: '/admin/dashboard', label: 'Dashboard' },
    { to: '/admin/question-papers', label: 'Papers' },
    { to: '/admin/questions', label: 'Questions' },
    { to: '/admin/students', label: 'Students' },
    { to: '/admin/analytics', label: 'Analytics' },
  ];

  const activeLinks = isAdmin ? adminLinks : isStudent ? studentLinks : publicLinks;

  const headerBg = scrolled
    ? 'rgba(244, 240, 231, 0.96)'
    : 'rgba(244, 240, 231, 0.8)';

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: headerBg,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: scrolled ? '1px solid var(--color-border-subtle)' : '1px solid transparent',
        transition: 'background-color 300ms ease, border-color 300ms ease, box-shadow 300ms ease',
        boxShadow: scrolled ? 'var(--shadow-sm)' : 'none',
      }}
    >
      <div
        className="container-custom"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 'var(--header-height)',
        }}
      >
        {/* LOGO */}
        <Link
          to={isAdmin ? '/admin/dashboard' : isStudent ? '/dashboard' : '/'}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', flexShrink: 0 }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '34px',
              height: '34px',
              borderRadius: '9px',
              background: 'var(--color-forest)',
              color: 'var(--color-lime)',
              fontSize: '1rem',
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            ✦
          </span>
          <span
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.35rem',
              fontWeight: 400,
              color: 'var(--color-forest)',
              letterSpacing: '-0.015em',
              lineHeight: 1,
            }}
          >
            SkillSense{' '}
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: 800,
                fontSize: '0.7rem',
                color: 'var(--color-emerald)',
                background: 'var(--color-lime-soft)',
                padding: '2px 7px',
                borderRadius: '4px',
                verticalAlign: 'middle',
                letterSpacing: '0.04em',
              }}
            >
              AI
            </span>
          </span>
        </Link>

        {/* DESKTOP NAV */}
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.75rem',
          }}
          className="desktop-nav-links"
        >
          {activeLinks.map((link) => (
            <NavLink key={link.to} to={link.to}>
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* DESKTOP ACTIONS */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}
          className="desktop-actions"
        >
          {isAuthenticated && user ? (
            <>
              {/* Avatar + Name */}
              <Link
                to={isAdmin ? '/admin/dashboard' : '/profile'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '5px 10px 5px 5px',
                  border: '1px solid var(--color-border-medium)',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--color-white)',
                  textDecoration: 'none',
                  transition: 'border-color 200ms, box-shadow 200ms',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-emerald)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border-medium)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <span
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: 'var(--color-forest)',
                    color: 'var(--color-lime)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    flexShrink: 0,
                  }}
                >
                  {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                </span>
                <span
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: 'var(--color-forest)',
                    maxWidth: '100px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {(user.name || '').split(' ')[0] || 'Profile'}
                </span>
              </Link>
              <button
                onClick={handleLogout}
                className="btn btn-outline btn-sm"
                style={{ borderColor: 'var(--color-border-medium)' }}
              >
                Log Out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">
                Log In
              </Link>
              <Link to="/signup" className="btn btn-primary btn-sm">
                Get Started
              </Link>
            </>
          )}
        </div>

        {/* MOBILE MENU TOGGLE */}
        <button
          onClick={() => setMobileMenuOpen((v) => !v)}
          className="mobile-menu-btn"
          aria-label="Toggle menu"
          style={{
            display: 'none',
            background: 'transparent',
            border: '1px solid var(--color-border-medium)',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 10px',
            cursor: 'pointer',
            color: 'var(--color-forest)',
            fontSize: '1.1rem',
            lineHeight: 1,
          }}
        >
          {mobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* MOBILE MENU */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{
              overflow: 'hidden',
              borderTop: '1px solid var(--color-border-subtle)',
              background: 'var(--color-ivory-soft)',
            }}
          >
            <div style={{ padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {activeLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMobileMenuOpen(false)}
                  style={{
                    padding: '0.75rem 0',
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: 'var(--color-forest)',
                    borderBottom: '1px solid var(--color-border-subtle)',
                    textDecoration: 'none',
                  }}
                >
                  {link.label}
                </Link>
              ))}
              <div style={{ paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {isAuthenticated ? (
                  <button onClick={handleLogout} className="btn btn-outline" style={{ width: '100%' }}>
                    Log Out
                  </button>
                ) : (
                  <>
                    <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="btn btn-outline" style={{ width: '100%', textAlign: 'center' }}>
                      Log In
                    </Link>
                    <Link to="/signup" onClick={() => setMobileMenuOpen(false)} className="btn btn-primary" style={{ width: '100%', textAlign: 'center' }}>
                      Get Started
                    </Link>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Responsive CSS */}
      <style>{`
        @media (min-width: 1024px) {
          .desktop-nav-links { display: flex !important; }
          .desktop-actions { display: flex !important; }
          .mobile-menu-btn { display: none !important; }
        }
        @media (max-width: 1023px) {
          .desktop-nav-links { display: none !important; }
          .desktop-actions { display: none !important; }
          .mobile-menu-btn { display: flex !important; }
        }
      `}</style>
    </header>
  );
};

export default Navbar;
