import React, { useState } from 'react';
import { Sidebar } from '../components/common/Sidebar';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { studentService } from '../services/studentService';
import { useToast } from '../context/ToastContext';
import { authService } from '../services/authService';
import { isStrongPassword, PASSWORD_HINT } from '../utils/password';
import {
  User,
  Shield,
  Bell,
  Sliders,
  Palette,
  Lock,
  LogOut,
  CheckCircle2,
  KeyRound,
} from 'lucide-react';

export const SettingsPage = () => {
  const { user, logout, updateUserProfile } = useAuth();
  const hasPassword = user?.hasPassword !== false;
  const { showPreviousQuestionInsights, togglePreviousQuestionInsights } = useSettings();
  const { addToast } = useToast();

  const [activeSection, setActiveSection] = useState('preferences');
  const [emailNotifications, setEmailNotifications] = useState(Boolean(user?.emailNotifications)); // saved on the server; off by default
  const [emailSaving, setEmailSaving] = useState(false);
  const [placementAlerts, setPlacementAlerts] = useState(true);

  // Security / Change Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const handleEmailToggle = async (enabled) => {
    setEmailNotifications(enabled);
    setEmailSaving(true);
    try {
      await studentService.saveSettings(enabled);
      updateUserProfile({ emailNotifications: enabled });
      addToast(enabled ? 'Email notifications are on.' : 'Email notifications are off.', 'success');
    } catch (err) {
      setEmailNotifications(!enabled);
      addToast(err?.message || 'The setting could not be saved. Please try again.', 'error');
    } finally {
      setEmailSaving(false);
    }
  };

  const handleSavePreferences = (e) => {
    e.preventDefault();
    localStorage.setItem('skillsense_setting_placement_alerts', String(placementAlerts));
    addToast('Preferences saved successfully!', 'success');
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');

    if ((hasPassword && !currentPassword) || !newPassword || !confirmPassword) {
      setPasswordError('Please fill in all password fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirm password do not match.');
      return;
    }

    if (!isStrongPassword(newPassword)) {
      setPasswordError(PASSWORD_HINT);
      return;
    }

    setPasswordLoading(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      addToast(hasPassword ? 'Password updated. Your other devices have been signed out.' : 'Password set. You can now sign in with email and password too.', 'success');
      updateUserProfile({ hasPassword: true, authProvider: user?.authProvider === 'google' ? 'both' : user?.authProvider });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err?.message || 'Password update failed. Please check your current password.');
      addToast(err?.message || 'Current password incorrect.', 'error');
    } finally {
      setPasswordLoading(false);
    }
  };

  const sections = [
    { id: 'preferences', label: 'Career & Practice', icon: Sliders },
    { id: 'security', label: 'Security & Password', icon: Shield },
    { id: 'account', label: 'Account Profile', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
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
              Customize your SkillSense learning environment, assessment simulation modes, and password credentials.
            </p>
          </div>

          {/* SETTINGS LAYOUT */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '260px minmax(0, 1fr)',
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
                        data-testid="email-notifications"
                        checked={emailNotifications}
                        disabled={emailSaving}
                        onChange={(e) => handleEmailToggle(e.target.checked)}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--color-emerald)' }}
                      />
                      <span>
                        Email me about matching placements and deadlines
                        <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--color-muted-green)' }}>
                          Off by default. Sent only to a verified address{user?.emailVerified ? '' : ' (yours is not verified yet)'}, each with a one-click unsubscribe link.
                        </span>
                      </span>
                    </label>
                  </div>

                  <Button variant="primary" size="md" onClick={handleSavePreferences}>
                    Save Preferences
                  </Button>
                </div>
              )}

              {/* Security & Change Password */}
              {activeSection === 'security' && (
                <div>
                  <h3 style={{ fontSize: '1.35rem', fontFamily: 'var(--font-serif)', color: 'var(--color-deep-forest)', margin: '0 0 0.5rem 0' }}>
                    {hasPassword ? 'Account Security & Password' : 'Set a password'}
                  </h3>
                  <p style={{ fontSize: '0.885rem', color: 'var(--color-muted-green)', marginBottom: '1.5rem' }}>
                    Change your authentication password. {hasPassword ? 'Passwords are hashed with bcrypt before they are stored. Changing it signs out your other devices.' : 'You signed up with Google, so this account has no password yet. Set one to also sign in with your email.'}
                  </p>

                  {passwordError && (
                    <div style={{ background: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)', borderRadius: 'var(--radius-md)', padding: '0.875rem 1rem', marginBottom: '1.25rem', color: 'var(--color-error)', fontSize: '0.875rem', fontWeight: 500 }}>
                      {passwordError}
                    </div>
                  )}

                  <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '440px' }}>
                    {hasPassword && (
                    <Input
                      label="Current Password"
                      type="password"
                      placeholder="Enter current password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                    )}

                    <Input
                      label="New Password"
                      type="password"
                      placeholder="8+ characters, with a letter and a number"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />

                    <Input
                      label="Confirm New Password"
                      type="password"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />

                    <div style={{ marginTop: '0.5rem' }}>
                      <Button type="submit" variant="primary" size="md" disabled={passwordLoading} icon={KeyRound}>
                        {passwordLoading ? 'Updating Password...' : 'Update Password →'}
                      </Button>
                    </div>
                  </form>
                </div>
              )}

              {/* Account Info */}
              {activeSection === 'account' && (
                <div>
                  <h3 style={{ fontSize: '1.35rem', fontFamily: 'var(--font-serif)', color: 'var(--color-deep-forest)', margin: '0 0 0.5rem 0' }}>
                    Account Information
                  </h3>
                  <p style={{ fontSize: '0.885rem', color: 'var(--color-muted-green)', marginBottom: '1.5rem' }}>
                    Verified candidate identity details.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '440px' }}>
                    <Input
                      label="Full Name"
                      value={user?.name || ''}
                      disabled
                    />

                    <Input
                      label="Registered Candidate Email"
                      value={user?.email || ''}
                      disabled
                    />

                    <Input
                      label="Account Role"
                      value={user?.role || 'student'}
                      disabled
                    />
                  </div>
                </div>
              )}

              {/* Notifications */}
              {activeSection === 'notifications' && (
                <div>
                  <h3 style={{ fontSize: '1.35rem', fontFamily: 'var(--font-serif)', color: 'var(--color-deep-forest)', margin: '0 0 0.5rem 0' }}>
                    Notification Preferences
                  </h3>
                  <p style={{ fontSize: '0.885rem', color: 'var(--color-muted-green)', marginBottom: '1.5rem' }}>
                    Configure recruitment alert digests.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: 'var(--color-deep-forest)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={placementAlerts}
                        onChange={(e) => setPlacementAlerts(e.target.checked)}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--color-emerald)' }}
                      />
                      <span>New Placement Opportunity Alerts</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: 'var(--color-deep-forest)', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        data-testid="email-notifications-2"
                        checked={emailNotifications}
                        disabled={emailSaving}
                        onChange={(e) => handleEmailToggle(e.target.checked)}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--color-emerald)' }}
                      />
                      <span>
                        Email me about matching placements and deadlines
                        <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--color-muted-green)' }}>
                          Off by default. Sent only to a verified address{user?.emailVerified ? '' : ' (yours is not verified yet)'}, each with a one-click unsubscribe link.
                        </span>
                      </span>
                    </label>
                  </div>

                  <Button variant="primary" size="md" onClick={handleSavePreferences}>
                    Save Preferences
                  </Button>
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

export default SettingsPage;
