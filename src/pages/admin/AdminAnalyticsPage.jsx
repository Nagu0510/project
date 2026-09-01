import React from 'react';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { ProgressBar } from '../../components/common/ProgressBar';
import { mockTopicFrequencies } from '../../data/mockPreviousQuestions';
import { BarChart3, TrendingUp, Sparkles, Repeat, Layers } from 'lucide-react';

export const AdminAnalyticsPage = () => {
  return (
    <div className="dashboard-layout">
      <AdminSidebar />

      <main className="dashboard-main">
        <div className="dashboard-content animate-fade-in">
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '0.4rem' }}>
              <span style={{ color: 'var(--color-emerald)' }}>✦</span>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-emerald)' }}>
                System-Wide Intelligence Analytics
              </span>
            </div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', color: 'var(--color-deep-forest)', margin: 0 }}>
              Question Recurrence & Placement Trends
            </h1>
            <p style={{ fontSize: '1rem', color: 'var(--color-charcoal-subtle)', marginTop: '4px' }}>
              Deep statistical breakdown of cross-company repeated questions, candidate bottleneck topics, and drive trends.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            {/* Top Recurrent Topics */}
            <div
              className="card-static"
              style={{
                padding: '1.75rem',
                backgroundColor: 'var(--color-white)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: 'var(--color-deep-forest)', margin: '0 0 1rem 0' }}>
                Cross-Exam Recurrence by Topic
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {mockTopicFrequencies.map((t) => (
                  <div key={t.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-deep-forest)' }}>{t.name}</span>
                      <span style={{ fontWeight: 700, color: 'var(--color-emerald)' }}>{t.appearances} appearances</span>
                    </div>
                    <ProgressBar value={(t.appearances / 30) * 100} color="var(--color-emerald)" height="6px" />
                  </div>
                ))}
              </div>
            </div>

            {/* Candidate Readiness Distribution */}
            <div
              className="card-static"
              style={{
                padding: '1.75rem',
                backgroundColor: 'var(--color-white)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: 'var(--color-deep-forest)', margin: '0 0 1rem 0' }}>
                  Student Cohort Placement Preparedness
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-deep-forest)' }}>Tier-1 Ready (&gt;85% Score)</span>
                      <span style={{ fontWeight: 700, color: '#059669' }}>34% (482 Students)</span>
                    </div>
                    <ProgressBar value={34} color="#10B981" height="6px" />
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-deep-forest)' }}>Placement Track Ready (70-85%)</span>
                      <span style={{ fontWeight: 700, color: 'var(--color-emerald)' }}>48% (681 Students)</span>
                    </div>
                    <ProgressBar value={48} color="var(--color-emerald)" height="6px" />
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-deep-forest)' }}>Requires Foundation Support (&lt;70%)</span>
                      <span style={{ fontWeight: 700, color: '#D97706' }}>18% (257 Students)</span>
                    </div>
                    <ProgressBar value={18} color="#F59E0B" height="6px" />
                  </div>
                </div>
              </div>

              <div style={{ padding: '0.85rem', backgroundColor: 'var(--color-lime-soft)', borderRadius: 'var(--radius-md)', fontSize: '0.825rem', color: 'var(--color-deep-forest)', fontWeight: 600 }}>
                ✦ Cohort average readiness improved +14% over the last 30 days.
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
