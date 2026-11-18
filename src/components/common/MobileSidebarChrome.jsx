import React from 'react';
import { Menu, X } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

/**
 * Top bar + backdrop for the off-canvas sidebar. Rendered ONLY at 768px and below
 * (see useMobileSidebar), so on desktop there is no mobile header in the page at all.
 */
export const MobileSidebarChrome = ({ title, open, onToggle, onClose }) => (
  <>
    <header className="mobile-topbar" data-testid="mobile-topbar">
      <div className="mobile-topbar-brand">
        <span className="mobile-topbar-logo" aria-hidden="true">✦</span>
        <span className="mobile-topbar-title">{title}</span>
      </div>
      <div className="mobile-topbar-actions">
      <ThemeToggle />
      <button
        type="button"
        className="mobile-topbar-toggle"
        onClick={onToggle}
        aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={open}
      >
        {open ? <X size={24} /> : <Menu size={24} />}
      </button>
      </div>
    </header>
    {open && <div className="sidebar-backdrop" data-testid="sidebar-backdrop" onClick={onClose} aria-hidden="true" />}
  </>
);

export default MobileSidebarChrome;
