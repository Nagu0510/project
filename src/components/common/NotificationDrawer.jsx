import React from 'react';
import { Link } from 'react-router-dom';
import { Bell, X, CheckCheck, ExternalLink, Building2 } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';

const TYPE_LABELS = {
  course_completed: 'Course completed',
  assessment_completed: 'Assessment',
  course_recommended: 'Recommended course',
  placement_match: 'New placement',
  placement_deadline: 'Deadline',
  paper_approved: 'Question paper',
};

export const NotificationDrawer = () => {
  const {
    notifications,
    unreadCount,
    isDrawerOpen,
    closeDrawer,
    markAsRead,
    markAllAsRead
  } = useNotifications();

  if (!isDrawerOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(6, 46, 37, 0.4)',
          backdropFilter: 'blur(3px)',
          zIndex: 1000,
          transition: 'opacity 0.2s ease'
        }}
        onClick={closeDrawer}
      />

      {/* Drawer Container */}
      <aside
        data-testid="notification-drawer"
        className="animate-slide-in-right"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: '420px',
          backgroundColor: 'var(--color-white)',
          boxShadow: 'var(--shadow-2xl)',
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '1px solid var(--color-border-subtle)'
        }}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--color-border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--color-ivory-surface)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-deep-forest)',
                color: 'var(--color-lime)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Bell size={18} />
            </div>
            <div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', color: 'var(--color-deep-forest)', margin: 0 }}>
                Notifications
              </h3>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-muted-green)' }}>
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {unreadCount > 0 && (
              <button
                data-testid="read-all"
                onClick={markAllAsRead}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-emerald)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-sm)'
                }}
                title="Mark all as read"
              >
                <CheckCheck size={16} /> Read all
              </button>
            )}
            <button
              onClick={closeDrawer}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-charcoal-subtle)',
                padding: '6px',
                borderRadius: 'var(--radius-md)'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* List of Notifications */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--color-charcoal-subtle)' }}>
              <Building2 size={40} style={{ opacity: 0.4, marginBottom: '0.75rem' }} />
              <p style={{ margin: 0, fontSize: '0.9rem' }}>No notifications yet. Complete an assessment, scan a resume or follow a placement and updates show up here.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {notifications.map((item) => (
                <div
                  key={item.id}
                  data-testid="notification-item"
                  data-read={item.read}
                  onClick={() => markAsRead(item.id)}
                  style={{
                    padding: '1rem',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--color-border-subtle)',
                    backgroundColor: item.read ? 'var(--color-white)' : 'rgba(15, 118, 110, 0.04)',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    cursor: 'pointer'
                  }}
                >
                  {!item.read && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--color-emerald)'
                      }}
                    />
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.4rem' }}>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: 'var(--color-lime-soft)',
                        color: 'var(--color-deep-forest)'
                      }}
                    >
                      {TYPE_LABELS[item.type] || 'Update'}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-muted-green)', marginLeft: 'auto' }}>
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ''}
                    </span>
                  </div>

                  <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-deep-forest)', margin: '0 0 0.35rem 0' }}>
                    {item.title}
                  </h4>

                  <p style={{ fontSize: '0.82rem', color: 'var(--color-charcoal-subtle)', margin: '0 0 0.75rem 0', lineHeight: 1.45 }}>
                    {item.message}
                  </p>

                  {item.link && (
                    <Link
                      to={item.link}
                      onClick={closeDrawer}
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        color: 'var(--color-emerald)',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      Open <ExternalLink size={13} />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
