import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { Sidebar } from '../components/common/Sidebar';
import { Navbar } from '../components/common/Navbar';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { ProgressBar } from '../components/common/ProgressBar';
import { AIInsightCard } from '../components/shared/AIInsightCard';
import { mockCompaniesData } from '../data/mockCompanies';
import { useAuth } from '../context/AuthContext';
import {
  Building2,
  Sparkles,
  ArrowRight,
  PieChart,
  BarChart3,
  TrendingUp,
  Code2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

export const CompanyInsightsPage = () => {
  const { companyId = 'tcs' } = useParams();
  const { isAuthenticated } = useAuth();
  const company = mockCompaniesData[companyId] || mockCompaniesData.tcs || {};

  const companyKeys = Object.keys(mockCompaniesData || {});
  const paperDistribution = Array.isArray(company.paperDistribution) ? company.paperDistribution : [];
  const userSkillReadiness = Array.isArray(company.userSkillReadiness) ? company.userSkillReadiness : [];
  const activeDrives = Array.isArray(company.activeDrives) ? company.activeDrives : ['Campus Drive 2026'];
  const recentQuestions = Array.isArray(company.recentQuestions) ? company.recentQuestions : ['Two Sum', 'Subarray Sum'];
  const aiInsight = company.aiInsight || {
    headline: 'Focus on Arrays & SQL Queries for placement eligibility.',
    recommendation: 'Complete intermediate DSA test suites.',
    actionText: 'Practice Coding Questions →',
    targetUrl: '/practice',
  };

  return (
    <div className={isAuthenticated ? "dashboard-layout" : ""} style={{ minHeight: '100vh', backgroundColor: 'var(--color-warm-ivory)' }}>
      {isAuthenticated ? <Sidebar /> : <Navbar />}

      <main className={isAuthenticated ? "dashboard-main" : "container-custom"} style={{ padding: isAuthenticated ? undefined : '3rem 1.5rem 5rem' }}>
        <div className="dashboard-content animate-fade-in" style={{ padding: isAuthenticated ? undefined : 0 }}>
          {/* Company Picker Tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '2rem', overflowX: 'auto', paddingBottom: '4px' }}>
            {companyKeys.map((key) => {
              const comp = mockCompaniesData[key];
              const isActive = key === companyId;

              return (
                <Link
                  key={key}
                  to={`/company-prep/${key}`}
                  style={{
                    padding: '0.5rem 1.15rem',
                    borderRadius: 'var(--radius-full)',
                    border: `1px solid ${isActive ? 'var(--color-emerald)' : 'var(--color-border-medium)'}`,
                    backgroundColor: isActive ? 'var(--color-emerald)' : 'var(--color-white)',
                    color: isActive ? 'var(--color-white)' : 'var(--color-deep-forest)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {comp?.shortName || key.toUpperCase()}
                </Link>
              );
            })}
          </div>

          {/* Header */}
          <div style={{ marginBottom: '2.5rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.25rem' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--color-emerald)' }}>✦</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-emerald)' }}>
                  Placement Intelligence Report
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
                {company.name || 'Company'} Preparation Intelligence
              </h1>
              <p style={{ fontSize: '1rem', color: 'var(--color-charcoal-subtle)', marginTop: '4px', maxWidth: '680px' }}>
                {company.tagline || 'Placement exam insights and question weightage.'} · {company.analyzedQuestionsCount || 120} previous assessment questions analyzed.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <Link to="/practice?topic=Arrays">
                <Button variant="lime" size="md" icon={Code2}>
                  Practice {company.shortName || 'Company'} Questions
                </Button>
              </Link>
            </div>
          </div>

          {/* =========================================================================
              Section 34: PAPER DISTRIBUTION & USER READINESS GRID
              ========================================================================= */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '1.5rem',
              marginBottom: '2rem',
            }}
          >
            {/* 1. Previous Paper Distribution */}
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: 'var(--color-deep-forest)', margin: 0 }}>
                  Previous Paper Topic Weightage
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--color-muted-green)', fontWeight: 600 }}>
                  {company.analyzedQuestionsCount || 0} Questions
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                {paperDistribution.map((item) => (
                  <div key={item.topic}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-deep-forest)' }}>{item.topic}</span>
                      <span style={{ fontWeight: 700, color: 'var(--color-emerald)' }}>{item.percentage}% ({item.count} Qs)</span>
                    </div>
                    <ProgressBar value={item.percentage} color={item.color || 'var(--color-emerald)'} height="8px" />
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Your Skill Readiness */}
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: 'var(--color-deep-forest)', margin: 0 }}>
                  Your Skill Readiness for {company.shortName || 'Company'}
                </h3>
                <Badge variant="lime">Candidate Score</Badge>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                {userSkillReadiness.map((item) => (
                  <div key={item.skill}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.85rem' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-deep-forest)' }}>{item.skill}</span>
                      <span style={{ fontWeight: 700, color: item.score >= 75 ? '#059669' : '#D97706' }}>
                        {item.score}% · {item.status}
                      </span>
                    </div>
                    <ProgressBar value={item.score} color={item.color || 'var(--color-emerald)'} height="8px" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* =========================================================================
              AI INSIGHT FOR THIS COMPANY
              ========================================================================= */}
          <div style={{ marginBottom: '2.5rem' }}>
            <AIInsightCard
              headline={aiInsight.headline}
              gap="High-Priority DSA Traversal"
              recommendation={aiInsight.recommendation}
              actionText={aiInsight.actionText}
              actionLink={aiInsight.targetUrl}
            />
          </div>

          {/* Active Drives & Recents */}
          <div
            className="card-static"
            style={{
              padding: '1.75rem',
              backgroundColor: 'var(--color-ivory-surface)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', color: 'var(--color-deep-forest)', margin: '0 0 0.75rem 0' }}>
              Active Drives Tracked for {company.name || 'Company'}
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '1rem' }}>
              {activeDrives.map((drive) => (
                <span
                  key={drive}
                  style={{
                    backgroundColor: 'var(--color-white)',
                    border: '1px solid var(--color-border-medium)',
                    padding: '4px 12px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.825rem',
                    fontWeight: 600,
                    color: 'var(--color-deep-forest)',
                  }}
                >
                  ✦ {drive}
                </span>
              ))}
            </div>

            <div style={{ fontSize: '0.85rem', color: 'var(--color-muted-green)' }}>
              Recent Questions Tested: {recentQuestions.join(' · ')}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CompanyInsightsPage;
