import React, { useState } from 'react';
import { Sidebar } from '../components/common/Sidebar';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import {
  User,
  Shield,
  Bell,
  Sliders,
  Palette,
  Lock,
  LogOut,
  CheckCircle2,
} from 'lucide-react';

export const SettingsPage = () => {
  const { user, logout } = useAuth();
  const { showPreviousQuestionInsights, togglePreviousQuestionInsights } = useSettings();
  const { addToast } = useToast();

  const [activeSection, setActiveSection] = useState('preferences');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [placementAlerts, setPlacementAlerts] = useState(true);

  const handleSavePreferences = (e) => {
    e.preventDefault();
    addToast('Preferences saved successfully!', 'success');
  };

  const sections = [
    { id: 'account', label: 'Account', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'preferences', label: 'Career & Practice', icon: Sliders },
    { id: 'appearance', label: 'Appearance & Theme', icon: Palette },
    { id: 'privacy', label: 'Privacy', icon: Lock },
  ];

  return (
    <div className="dashboard-layout">
      <Sidebar />

      <main className="dashboard-main">
        <div className="dashboard-content animate-fade-in">
          {/* Header */}
          <div style={{ marginBottom: '2.5rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '0.4rem' }}>
              <span style={{ color: 'var(--color-emerald)' }}>✦</span>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-emerald)' }}>
                System Configuration
              </span>
            </div>
            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(2rem, 3.5vw, 2.75rem)',
                color: 'var(--color-deep-forest)',
                margin: 0,
              }}
            >
              Account & Practice Settings
            </h1>
            <p style={{ fontSize: '1rem', color: 'var(--color-charcoal-subtle)', marginTop: '4px', maxWidth: '680px' }}>
              Customize your SkillSense learning environment, assessment simulation modes, and alert preferences.
            </p>
          </div>

          {/* =========================================================================
              SETTINGS LAYOUT
              ========================================================================= */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '260px 1fr',
              gap: '2rem',
              alignItems: 'start',
            }}
            className="settings-layout-grid"
          >
            {/* Left Nav List */}
            <div
              className="card-static"
              style={{
                padding: '0.75rem',
                backgroundColor: 'var(--color-white)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              {sections.map((sec) => {
                const Icon = sec.icon;
                const isActive = activeSection === sec.id;

                return (
                  <button
                    key={sec.id}
                    onClick={() => setActiveSection(sec.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: isActive ? 'var(--color-emerald-alpha)' : 'transparent',
                      border: isActive ? '1px solid rgba(15, 118, 110, 0.2)' : '1px solid transparent',
                      color: isActive ? 'var(--color-emerald)' : 'var(--color-charcoal-subtle)',
                      fontWeight: isActive ? 700 : 500,
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Icon size={18} color={isActive ? 'var(--color-emerald)' : 'var(--color-muted-green)'} />
                    <span>{sec.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Right Settings Detail Panel */}
            <div
              className="card-static"
              style={{
                padding: '2rem',
                backgroundColor: 'var(--color-white)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-border-subtle)',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              {/* Practice & Career Preferences */}
              {activeSection === 'preferences' && (
                <div>
                  <h3 style={{ fontSize: '1.35rem', fontFamily: 'var(--font-serif)', color: 'var(--color-deep-forest)', margin: '0 0 1rem 0' }}>
                    Practice & Assessment Modes
                  </h3>

                  <div
                    style={{
                      padding: '1.25rem',
                      borderRadius: 'var(--radius-lg)',
                      backgroundColor: 'var(--color-ivory-surface)',
                      border: '1px solid var(--color-border-subtle)',
                      marginBottom: '1.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-deep-forest)' }}>
                          Previous Question Intelligence Overlay
                        </div>
                        <div style={{ fontSize: '0.825rem', color: 'var(--color-muted-green)', marginTop: '2px' }}>
                          Display the floating historical exam match popup when practicing problems that appeared in TCS, Infosys, etc.
                        </div>
                      </div>

                      <button
                        onClick={togglePreviousQuestionInsights}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 'var(--radius-full)',
                          border: 'none',
                          backgroundColor: showPreviousQuestionInsights ? 'var(--color-emerald)' : 'var(--color-ivory-muted)',
                          color: showPreviousQuestionInsights ? 'var(--color-white)' : 'var(--color-charcoal-subtle)',
                          fontWeight: 700,
                          fontSize: '0.825rem',
                          cursor: 'pointer',
                        }}
                      >
                        {showPreviousQuestionInsights ? 'Practice Mode (ON)' : 'Strict Mock (OFF)'}
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: 'var(--color-deep-forest)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={placementAlerts}
                        onChange={(e) => setPlacementAlerts(e.target.checked)}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--color-emerald)' }}
                      />
                      <span>Notify me when a company releases a new placement question paper</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: 'var(--color-deep-forest)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={emailNotifications}
                        onChange={(e) => setEmailNotifications(e.target.checked)}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--color-emerald)' }}
                      />
                      <span>Weekly AI Career Gap digest & roadmap milestones</span>
                    </label>
                  </div>

                  <Button variant="primary" size="md" onClick={handleSavePreferences}>
                    Save Preferences
                  </Button>
                </div>
              )}

              {/* Account / Security / Appearance Placeholders */}
              {activeSection !== 'preferences' && (
                <div>
                  <h3 style={{ fontSize: '1.35rem', fontFamily: 'var(--font-serif)', color: 'var(--color-deep-forest)', margin: '0 0 0.5rem 0' }}>
                    {sections.find((s) => s.id === activeSection)?.label}
                  </h3>
                  <p style={{ fontSize: '0.885rem', color: 'var(--color-muted-green)', marginBottom: '1.5rem' }}>
                    Standard profile configuration options and preferences.
                  </p>

                  <Input
                    label="Registered Candidate Email"
                    value={user?.email || 'nagappa@skillsense.ai'}
                    disabled
                  />

                  <div style={{ marginTop: '1.5rem' }}>
                    <Button variant="primary" size="md" onClick={() => addToast('Settings updated.', 'info')}>
                      Save Changes
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <style>{`
        @media (max-width: 768px) {
          .settings-layout-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};
