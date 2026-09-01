import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, ArrowUpRight, Menu, X, User } from 'lucide-react';
import { Button } from './Button';
import { useAuth } from '../../context/AuthContext';

export const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isAuthenticated, user, isStudent } = useAuth();
  const navigate = useNavigate();

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: 'rgba(246, 247, 237, 0.94)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--color-border-subtle)',
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
        {/* Brand Logo */}
        <Link
          to="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            textDecoration: 'none',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'var(--color-deep-forest)',
              color: 'var(--color-lime)',
              fontSize: '1.1rem',
            }}
          >
            ✦
          </span>
          <span
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.45rem',
              fontWeight: 400,
              color: 'var(--color-deep-forest)',
              letterSpacing: '-0.01em',
            }}
          >
            SkillSense <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: '0.85rem', color: 'var(--color-emerald)', background: 'var(--color-lime-soft)', padding: '2px 6px', borderRadius: '4px', marginLeft: '2px' }}>AI</span>
          </span>
        </Link>

        {/* Desktop Nav Links */}
        <nav
          style={{
            display: 'none',
            alignItems: 'center',
            gap: '1.75rem',
          }}
          className="desktop-nav"
        >
          {/* If Logged In as Student */}
          {isAuthenticated && isStudent ? (
            <>
              <Link
                to="/dashboard"
                style={{ fontSize: '0.925rem', fontWeight: 600, color: 'var(--color-emerald)' }}
              >
                Dashboard
              </Link>
              <Link
                to="/career-paths"
                style={{ fontSize: '0.925rem', fontWeight: 500, color: 'var(--color-charcoal-subtle)' }}
              >
                Career Paths
              </Link>
              <Link
                to="/roadmap"
                style={{ fontSize: '0.925rem', fontWeight: 500, color: 'var(--color-charcoal-subtle)' }}
              >
                Roadmap
              </Link>
              <Link
                to="/assessment"
                style={{ fontSize: '0.925rem', fontWeight: 500, color: 'var(--color-charcoal-subtle)' }}
              >
                Assessment
              </Link>
              <Link
                to="/practice"
                style={{ fontSize: '0.925rem', fontWeight: 500, color: 'var(--color-charcoal-subtle)' }}
              >
                Practice
              </Link>
              <Link
                to="/previous-questions"
                style={{ fontSize: '0.925rem', fontWeight: 500, color: 'var(--color-charcoal-subtle)' }}
              >
                Previous Questions
              </Link>
              <Link
                to="/placement-tracker"
                style={{ fontSize: '0.925rem', fontWeight: 500, color: 'var(--color-charcoal-subtle)' }}
              >
                Placements
              </Link>
            </>
          ) : (
            /* Guest Public Navbar */
            <>
              <Link
                to="/"
                style={{ fontSize: '0.925rem', fontWeight: 500, color: 'var(--color-charcoal-subtle)' }}
              >
                Home
              </Link>
              <Link
                to="/features"
                style={{ fontSize: '0.925rem', fontWeight: 500, color: 'var(--color-charcoal-subtle)' }}
              >
                Features
              </Link>
              <Link
                to="/career-paths"
                style={{ fontSize: '0.925rem', fontWeight: 500, color: 'var(--color-charcoal-subtle)' }}
              >
                Career Paths
              </Link>
              <Link
                to="/roadmap"
                style={{ fontSize: '0.925rem', fontWeight: 500, color: 'var(--color-charcoal-subtle)' }}
              >
                Roadmaps
              </Link>
              <Link
                to="/previous-questions"
                style={{ fontSize: '0.925rem', fontWeight: 500, color: 'var(--color-charcoal-subtle)' }}
              >
                Previous Questions
              </Link>
              <Link
                to="/placement-tracker"
                style={{ fontSize: '0.925rem', fontWeight: 500, color: 'var(--color-charcoal-subtle)' }}
              >
                Placements
              </Link>
              <Link
                to="/about"
                style={{ fontSize: '0.925rem', fontWeight: 500, color: 'var(--color-charcoal-subtle)' }}
              >
                About
              </Link>
            </>
          )}
        </nav>

        {/* Desktop CTA / Auth */}
        <div style={{ display: 'none', alignItems: 'center', gap: '0.75rem' }} className="desktop-actions">
          {isAuthenticated && user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Link to="/dashboard">
                <Button variant="outline-emerald" size="sm">
                  Go to Dashboard
                </Button>
              </Link>
              <Link
                to="/profile"
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'var(--color-emerald)',
                  color: 'var(--color-white)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  textDecoration: 'none',
                }}
                title={user.name}
              >
                {user.name ? user.name.charAt(0) : 'U'}
              </Link>
            </div>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link to="/signup">
                <Button variant="primary" size="sm" icon={ArrowUpRight} iconPosition="right">
                  Get Started →
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger Toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{
            display: 'flex',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '6px',
            color: 'var(--color-deep-forest)',
          }}
          className="mobile-toggle"
          aria-label="Toggle Navigation Menu"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          style={{
            backgroundColor: 'var(--color-white)',
            borderBottom: '1px solid var(--color-border-subtle)',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          {isAuthenticated ? (
            <>
              <Link
                to="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                style={{ fontWeight: 700, color: 'var(--color-emerald)' }}
              >
                ✦ Student Dashboard
              </Link>
              <Link
                to="/career-paths"
                onClick={() => setMobileMenuOpen(false)}
                style={{ fontWeight: 600, color: 'var(--color-deep-forest)' }}
              >
                Career Paths
              </Link>
              <Link
                to="/roadmap"
                onClick={() => setMobileMenuOpen(false)}
                style={{ fontWeight: 600, color: 'var(--color-deep-forest)' }}
              >
                Career Roadmap
              </Link>
              <Link
                to="/assessment"
                onClick={() => setMobileMenuOpen(false)}
                style={{ fontWeight: 600, color: 'var(--color-deep-forest)' }}
              >
                Skill Assessment
              </Link>
              <Link
                to="/practice"
                onClick={() => setMobileMenuOpen(false)}
                style={{ fontWeight: 600, color: 'var(--color-deep-forest)' }}
              >
                Coding Practice
              </Link>
              <Link
                to="/previous-questions"
                onClick={() => setMobileMenuOpen(false)}
                style={{ fontWeight: 600, color: 'var(--color-deep-forest)' }}
              >
                Previous Questions
              </Link>
              <Link
                to="/placement-tracker"
                onClick={() => setMobileMenuOpen(false)}
                style={{ fontWeight: 600, color: 'var(--color-deep-forest)' }}
              >
                Placement Tracker
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                style={{ fontWeight: 600, color: 'var(--color-deep-forest)' }}
              >
                Home
              </Link>
              <Link
                to="/features"
                onClick={() => setMobileMenuOpen(false)}
                style={{ fontWeight: 600, color: 'var(--color-deep-forest)' }}
              >
                Features Overview
              </Link>
              <Link
                to="/career-paths"
                onClick={() => setMobileMenuOpen(false)}
                style={{ fontWeight: 600, color: 'var(--color-deep-forest)' }}
              >
                Career Paths
              </Link>
              <Link
                to="/roadmap"
                onClick={() => setMobileMenuOpen(false)}
                style={{ fontWeight: 600, color: 'var(--color-deep-forest)' }}
              >
                Roadmap Previews
              </Link>
              <Link
                to="/previous-questions"
                onClick={() => setMobileMenuOpen(false)}
                style={{ fontWeight: 600, color: 'var(--color-deep-forest)' }}
              >
                Previous Questions
              </Link>
              <Link
                to="/placement-tracker"
                onClick={() => setMobileMenuOpen(false)}
                style={{ fontWeight: 600, color: 'var(--color-deep-forest)' }}
              >
                Placement Intelligence
              </Link>
              <Link
                to="/about"
                onClick={() => setMobileMenuOpen(false)}
                style={{ fontWeight: 600, color: 'var(--color-deep-forest)' }}
              >
                About Platform
              </Link>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <Button
                  variant="outline"
                  size="sm"
                  style={{ flex: 1 }}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/login');
                  }}
                >
                  Sign In
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  style={{ flex: 1 }}
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate('/signup');
                  }}
                >
                  Get Started →
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        @media (min-width: 860px) {
          .desktop-nav { display: flex !important; }
          .desktop-actions { display: flex !important; }
          .mobile-toggle { display: none !important; }
        }
      `}</style>
    </header>
  );
};
