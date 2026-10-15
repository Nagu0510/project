import React, { useState } from 'react';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Settings, ShieldCheck, Database, Sliders, Lock } from 'lucide-react';

export const AdminSettingsPage = () => {
  const { user, switchRole } = useAuth();
  const { addToast } = useToast();

  const handleSave = (e) => {
    e.preventDefault();
    addToast('Admin platform parameters updated.', 'success');
  };

  return (
    <div className="dashboard-layout">
      <AdminSidebar />

      <main className="dashboard-main">
        <div className="dashboard-content animate-fade-in">
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '0.4rem' }}>
              <span style={{ color: 'var(--color-emerald)' }}>✦</span>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-emerald)' }}>
                System Administration
              </span>
            </div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', color: 'var(--color-deep-forest)', margin: 0 }}>
              Platform & Vector Indexing Configuration
            </h1>
            <p style={{ fontSize: '1rem', color: 'var(--color-charcoal-subtle)', marginTop: '4px' }}>
              Configure question extraction thresholds, vector similarity index parameters, and security policies.
            </p>
          </div>

          <div
            className="card-static"
            style={{
              padding: '2rem',
              backgroundColor: 'var(--color-white)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border-subtle)',
              maxWidth: '680px',
            }}
          >
            <form onSubmit={handleSave}>
              <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: 'var(--color-deep-forest)', margin: '0 0 1rem 0' }}>
                Extraction & Similarity Thresholds
              </h3>

              <Input
                label="Historical Similarity Match Threshold (%)"
                defaultValue="85"
                helperText="Questions with cosine similarity above this threshold will trigger candidate Previously Asked popups."
              />

              <Input
                label="Max Questions Extracted Per Paper"
                defaultValue="150"
              />

              <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '1.25rem', marginTop: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <Button variant="outline" size="sm" onClick={() => switchRole('student')}>
                  Switch to Student View (Testing)
                </Button>

                <Button type="submit" variant="primary" size="md">
                  Save Admin Config
                </Button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminSettingsPage;
