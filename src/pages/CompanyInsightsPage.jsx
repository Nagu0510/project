import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Sidebar } from '../components/common/Sidebar';
import { Navbar } from '../components/common/Navbar';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingState } from '../components/common/LoadingState';
import { ProgressBar } from '../components/common/ProgressBar';
import { questionIntelligenceService } from '../services/questionIntelligenceService';
import { useAuth } from '../context/AuthContext';
import { Code2 } from 'lucide-react';

const slug = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const Card = ({ title, aside, children }) => (
  <div
    className="card-static"
    style={{
      padding: '1.75rem',
      backgroundColor: 'var(--color-white)',
      borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--color-border-subtle)',
      boxShadow: 'var(--shadow-md)',
      minWidth: 0,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
      <h3 style={{ fontSize: '1.2rem', fontFamily: 'var(--font-serif)', color: 'var(--color-deep-forest)', margin: 0 }}>{title}</h3>
      {aside && <span style={{ fontSize: '0.78rem', color: 'var(--color-muted-green)', fontWeight: 600 }}>{aside}</span>}
    </div>
    {children}
  </div>
);

export const CompanyInsightsPage = () => {
  const { companyId } = useParams();
  const { isAuthenticated } = useAuth();
  const [companies, setCompanies] = useState(null); // null = loading
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    questionIntelligenceService.getCompanies()
      .then((data) => alive && setCompanies(data || {}))
      .catch(() => alive && (setFailed(true), setCompanies({})));
    return () => { alive = false; };
  }, []);

  const keys = Object.keys(companies || {});
  const key = companyId ? slug(companyId) : keys[0];
  const company = companies && key ? companies[key] : null;
  const topics = company?.top_topics || [];
  const mix = Object.entries(company?.difficulty_mix || {});
  const mixTotal = mix.reduce((n, [, c]) => n + c, 0);

  return (
    <div className={isAuthenticated ? 'dashboard-layout' : ''} style={{ minHeight: '100vh', backgroundColor: 'var(--color-warm-ivory)' }}>
      {isAuthenticated ? <Sidebar /> : <Navbar />}

      <main className={isAuthenticated ? 'dashboard-main' : 'container-custom'} style={{ padding: isAuthenticated ? undefined : '3rem 1.5rem 5rem' }}>
        <div className="dashboard-content animate-fade-in" style={{ padding: isAuthenticated ? undefined : 0 }}>
          {companies === null && <LoadingState message="Loading company intelligence..." subtitle="One moment" />}

          {companies !== null && keys.length === 0 && (
            <EmptyState
              title={failed ? 'Company intelligence is unavailable right now' : 'No company data yet'}
              description={failed ? 'We could not load it. Please try again in a moment.' : 'Insights appear here once previous-year placement questions have been published.'}
            />
          )}

          {companies !== null && keys.length > 0 && (
            <>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '2rem', overflowX: 'auto', paddingBottom: '4px' }}>
                {keys.map((k) => (
                  <Link
                    key={k}
                    to={`/company-prep/${k}`}
                    style={{
                      padding: '0.5rem 1.15rem',
                      borderRadius: 'var(--radius-full)',
                      border: `1px solid ${k === key ? 'var(--color-emerald)' : 'var(--color-border-medium)'}`,
                      backgroundColor: k === key ? 'var(--color-emerald)' : 'var(--color-white)',
                      color: k === key ? 'var(--color-white)' : 'var(--color-deep-forest)',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {companies[k].short_name || k.toUpperCase()}
                  </Link>
                ))}
              </div>

              {!company ? (
                <EmptyState title="No published questions for this company yet" description="Pick another company above." />
              ) : (
                <>
                  <div style={{ marginBottom: '2.5rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.25rem' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-emerald)', marginBottom: '0.4rem' }}>
                        ✦ Placement Intelligence Report
                      </div>
                      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem, 3.5vw, 2.75rem)', color: 'var(--color-deep-forest)', margin: 0 }}>
                        {company.name} Preparation Intelligence
                      </h1>
                      <p style={{ fontSize: '1rem', color: 'var(--color-charcoal-subtle)', marginTop: '4px', maxWidth: '680px' }}>
                        Based on {company.total_questions} published previous-year {company.total_questions === 1 ? 'question' : 'questions'}.
                      </p>
                    </div>
                    <Link to="/practice">
                      <Button variant="lime" size="md" icon={Code2}>Practice coding</Button>
                    </Link>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                    <Card title="Topic weightage" aside={`${company.total_questions} questions`}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                        {topics.map((t) => (
                          <div key={t.topic}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '4px', fontSize: '0.85rem' }}>
                              <span style={{ fontWeight: 600, color: 'var(--color-deep-forest)' }}>{t.topic}</span>
                              <span style={{ fontWeight: 700, color: 'var(--color-emerald)' }}>{t.percentage}%</span>
                            </div>
                            <ProgressBar value={t.percentage} color="var(--color-emerald)" height="8px" />
                          </div>
                        ))}
                        {topics.length === 0 && <span style={{ color: 'var(--color-charcoal-subtle)', fontSize: '0.9rem' }}>No topics recorded yet.</span>}
                      </div>
                    </Card>

                    <Card title="Difficulty mix">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                        {mix.map(([level, count]) => (
                          <div key={level}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.85rem' }}>
                              <span style={{ fontWeight: 600, color: 'var(--color-deep-forest)' }}>{level}</span>
                              <span style={{ fontWeight: 700, color: 'var(--color-emerald)' }}>{count} {count === 1 ? 'question' : 'questions'}</span>
                            </div>
                            <ProgressBar value={Math.round((count / mixTotal) * 100)} color="var(--color-emerald)" height="8px" />
                          </div>
                        ))}
                        {mix.length === 0 && <span style={{ color: 'var(--color-charcoal-subtle)', fontSize: '0.9rem' }}>No difficulty data yet.</span>}
                      </div>
                    </Card>
                  </div>

                  <div
                    className="card-static"
                    style={{ padding: '1.75rem', backgroundColor: 'var(--color-ivory-surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border-subtle)' }}
                  >
                    {company.exam_patterns?.length > 0 && (
                      <>
                        <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', color: 'var(--color-deep-forest)', margin: '0 0 0.75rem 0' }}>Exams in the question bank</h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '1rem' }}>
                          {company.exam_patterns.map((exam) => (
                            <span key={exam} style={{ backgroundColor: 'var(--color-white)', border: '1px solid var(--color-border-medium)', padding: '4px 12px', borderRadius: 'var(--radius-full)', fontSize: '0.825rem', fontWeight: 600, color: 'var(--color-deep-forest)' }}>
                              {exam}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                    {company.recent_questions?.length > 0 && (
                      <div style={{ fontSize: '0.875rem', color: 'var(--color-charcoal-subtle)' }}>
                        Recent questions: {company.recent_questions.join(' · ')}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default CompanyInsightsPage;
