import React, { useState, useEffect } from 'react';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { useSearchParams } from 'react-router-dom';
import { Sidebar } from '../components/common/Sidebar';
import { Navbar } from '../components/common/Navbar';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { PreviousQuestionCard } from '../components/shared/PreviousQuestionCard';
import { TopicFrequencyCard } from '../components/shared/TopicFrequencyCard';
import { CompanyInsightCard } from '../components/shared/CompanyInsightCard';
import { questionIntelligenceService } from '../services/questionIntelligenceService';
import { useAuth } from '../context/AuthContext';
import { normalizePreviousQuestionList } from '../utils/normalizers';
import { Search, Filter, HelpCircle, Layers, Building2 } from 'lucide-react';

export const PreviousQuestionsPage = () => {
  const [searchParams] = useSearchParams();
  const initialTopic = searchParams.get('topic') || 'All';
  const initialCompany = searchParams.get('company') || 'All';

  const { isAuthenticated, requireAuth } = useAuth();

  const [questions, setQuestions] = useState([]);
  const [allQuestions, setAllQuestions] = useState([]); // unfiltered, for the topic and company summaries
  const [companyStats, setCompanyStats] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState(initialCompany);
  const [selectedTopic, setSelectedTopic] = useState(initialTopic);
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    const fail = (err) => alive && setLoadError(err?.message || 'Please try again.');
    questionIntelligenceService.getPreviousQuestions({}).then((rows) => alive && setAllQuestions(rows)).catch(fail);
    questionIntelligenceService.getCompanies().then((data) => alive && setCompanyStats(data || {})).catch(fail);
    return () => { alive = false; };
  }, [reloadKey]);

  useEffect(() => {
    let isMounted = true;
    const fetchQuestions = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const fetched = await questionIntelligenceService.getPreviousQuestions({
          company: selectedCompany,
          topic: selectedTopic,
          difficulty: selectedDifficulty,
          search: searchTerm,
        });
        if (isMounted) setQuestions(Array.isArray(fetched) ? fetched : []);
      } catch (err) {
        if (isMounted) setLoadError(err?.message || 'Please try again.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchQuestions();
    return () => {
      isMounted = false;
    };
  }, [selectedCompany, selectedTopic, selectedDifficulty, reloadKey]);

  const companiesList = ['All', ...new Set(allQuestions.flatMap((q) => (q.companies?.length ? q.companies : [q.company])).filter(Boolean))];
  const topicsList = ['All', ...new Set(allQuestions.map((q) => q.topic).filter(Boolean))];
  const topicFrequencies = Object.values(allQuestions.reduce((acc, q) => {
    if (!q.topic) return acc;
    const entry = acc[q.topic] || (acc[q.topic] = { id: q.topic, name: q.topic, appearances: 0, companies: new Set() });
    entry.appearances += 1;
    (q.companies?.length ? q.companies : [q.company]).filter(Boolean).forEach((c) => entry.companies.add(c));
    return acc;
  }, {})).map((t) => ({ ...t, companies: [...t.companies] })).sort((a, b) => b.appearances - a.appearances).slice(0, 8);
  const companyCards = Object.entries(companyStats).slice(0, 4).map(([key, c]) => [key, {
    name: c.name, shortName: c.short_name || c.name, analyzedQuestionsCount: c.total_questions, topTopics: (c.top_topics || []).map((t) => t.topic),
  }]);
  const difficultiesList = ['All', 'Easy', 'Medium', 'Hard'];

  const safeQuestions = Array.isArray(questions) ? questions : [];

  const filteredQuestions = safeQuestions.filter((q) => {
    if (!q) return false;
    const title = (q.title || '').toLowerCase();
    const exam = (q.examOrigin || q.exam || '').toLowerCase();
    const topic = (q.topic || '').toLowerCase();
    const search = searchTerm.toLowerCase();

    const matchesSearch = !searchTerm || title.includes(search) || exam.includes(search) || topic.includes(search);
    const qCompanies = Array.isArray(q.companies) ? q.companies : [q.company || ''];
    const matchesCompany = selectedCompany === 'All' || qCompanies.some((c) => (c || '').toLowerCase() === selectedCompany.toLowerCase());
    const matchesTopic = selectedTopic === 'All' || topic.includes(selectedTopic.toLowerCase());
    const matchesDifficulty = selectedDifficulty === 'All' || q.difficulty === selectedDifficulty;

    return matchesSearch && matchesCompany && matchesTopic && matchesDifficulty;
  });

  return (
    <div className={isAuthenticated ? "dashboard-layout" : ""} style={{ minHeight: '100vh', backgroundColor: 'var(--color-warm-ivory)' }}>
      {isAuthenticated ? <Sidebar /> : <Navbar />}

      <main className={isAuthenticated ? "dashboard-main" : "container-custom"} style={{ padding: isAuthenticated ? undefined : '3rem 1.5rem 5rem' }}>
        <div className="dashboard-content animate-fade-in" style={{ padding: isAuthenticated ? undefined : 0 }}>
          {loadError && <ErrorBanner title="Previous questions could not be loaded." message={loadError} onRetry={() => setReloadKey((k) => k + 1)} />}
          {/* Guest Preview Banner */}
          {!isAuthenticated && (
            <div
              style={{
                backgroundColor: 'var(--color-lime-soft)',
                border: '1px solid rgba(6, 46, 37, 0.1)',
                borderRadius: 'var(--radius-lg)',
                padding: '0.85rem 1.25rem',
                marginBottom: '2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.885rem', color: 'var(--color-deep-forest)', fontWeight: 600 }}>
                <span style={{ color: 'var(--color-emerald)' }}>✦</span>
                <span><strong>Public Question Bank Preview:</strong> Browse and filter the published previous-year questions freely. Sign in to start interactive practice.</span>
              </div>
              <Button variant="primary" size="sm" onClick={() => requireAuth(null, '/previous-questions')}>
                Sign In to Practice →
              </Button>
            </div>
          )}

          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '0.4rem' }}>
              <span style={{ color: 'var(--color-emerald)' }}>✦</span>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-emerald)' }}>
                Historical Placement Archive
              </span>
              {!isAuthenticated && <Badge variant="lime" size="sm">Public Archive</Badge>}
            </div>
            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'clamp(2rem, 3.5vw, 2.75rem)',
                color: 'var(--color-deep-forest)',
                margin: 0,
              }}
            >
              Previous Placement Questions
            </h1>
            <p style={{ fontSize: '1rem', color: 'var(--color-charcoal-subtle)', marginTop: '4px', maxWidth: '680px' }}>
              Explore questions that appeared in previous placement and technical assessments across premier IT companies.
            </p>
          </div>

          {/* =========================================================================
              Section 35: FREQUENTLY ASKED TOPICS GRID
              ========================================================================= */}
          <div style={{ marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: 'var(--color-deep-forest)', margin: 0 }}>
                Frequently Asked Topics
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-muted-green)' }}>
                Sorted by number of published questions
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '1rem',
              }}
            >
              {topicFrequencies.map((topic) => (
                <TopicFrequencyCard key={topic.id} topic={topic} />
              ))}
              {!loading && topicFrequencies.length === 0 && (
                <p style={{ color: 'var(--color-charcoal-subtle)', fontSize: '0.9rem' }}>Topics will appear once previous questions are published.</p>
              )}
            </div>
          </div>

          {/* =========================================================================
              Section 33: PREPARE FOR A COMPANY
              ========================================================================= */}
          <div style={{ marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-serif)', color: 'var(--color-deep-forest)', margin: 0 }}>
                Prepare for a Company
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-muted-green)' }}>
                Company-specific test intelligence
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1.25rem',
              }}
            >
              {companyCards.map(([key, data]) => (
                <CompanyInsightCard key={key} companyKey={key} companyData={data} />
              ))}
              {!loading && companyCards.length === 0 && (
                <p style={{ color: 'var(--color-charcoal-subtle)', fontSize: '0.9rem' }}>Company insights will appear once previous questions are published.</p>
              )}
            </div>
          </div>

          {/* =========================================================================
              FILTERS & SEARCH BAR
              ========================================================================= */}
          <div
            className="card-static"
            style={{
              padding: '1.25rem 1.5rem',
              backgroundColor: 'var(--color-white)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border-subtle)',
              marginBottom: '1.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            {/* Search */}
            <div style={{ position: 'relative', minWidth: '240px', flex: 1 }}>
              <Search size={16} color="var(--color-muted-green)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search questions by title, topic, or exam..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem 1rem 0.55rem 2.25rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-medium)',
                  backgroundColor: 'var(--color-ivory-surface)',
                  fontSize: '0.885rem',
                  outline: 'none',
                }}
              />
            </div>

            {/* Dropdown Filters */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                style={{
                  padding: '0.55rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-medium)',
                  backgroundColor: 'var(--color-white)',
                  fontSize: '0.825rem',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {companiesList.map((c) => (
                  <option key={c} value={c}>
                    Company: {c}
                  </option>
                ))}
              </select>

              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                style={{
                  padding: '0.55rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-medium)',
                  backgroundColor: 'var(--color-white)',
                  fontSize: '0.825rem',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {topicsList.map((t) => (
                  <option key={t} value={t}>
                    Topic: {t}
                  </option>
                ))}
              </select>

              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                style={{
                  padding: '0.55rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-medium)',
                  backgroundColor: 'var(--color-white)',
                  fontSize: '0.825rem',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {difficultiesList.map((d) => (
                  <option key={d} value={d}>
                    Difficulty: {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* =========================================================================
              QUESTION CARDS GRID
              ========================================================================= */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {filteredQuestions.length > 0 ? (
              filteredQuestions.map((question) => (
                <PreviousQuestionCard key={question.id} question={question} />
              ))
            ) : (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--color-muted-green)' }}>
                No questions matching the selected filter criteria. Try clearing some filters.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default PreviousQuestionsPage;
