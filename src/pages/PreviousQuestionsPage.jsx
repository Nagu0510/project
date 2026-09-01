import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Sidebar } from '../components/common/Sidebar';
import { Navbar } from '../components/common/Navbar';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { PreviousQuestionCard } from '../components/shared/PreviousQuestionCard';
import { TopicFrequencyCard } from '../components/shared/TopicFrequencyCard';
import { CompanyInsightCard } from '../components/shared/CompanyInsightCard';
import { mockPreviousQuestionsList, mockTopicFrequencies } from '../data/mockPreviousQuestions';
import { mockCompaniesData } from '../data/mockCompanies';
import { questionIntelligenceService } from '../services/questionIntelligenceService';
import { useAuth } from '../context/AuthContext';
import { normalizePreviousQuestionList } from '../utils/normalizers';
import { Search, Filter, HelpCircle, Layers, Building2 } from 'lucide-react';

export const PreviousQuestionsPage = () => {
  const [searchParams] = useSearchParams();
  const initialTopic = searchParams.get('topic') || 'All';
  const initialCompany = searchParams.get('company') || 'All';

  const { isAuthenticated, requireAuth } = useAuth();

  const [questions, setQuestions] = useState(() => normalizePreviousQuestionList(mockPreviousQuestionsList));
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState(initialCompany);
  const [selectedTopic, setSelectedTopic] = useState(initialTopic);
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchQuestions = async () => {
      setLoading(true);
      try {
        const fetched = await questionIntelligenceService.getPreviousQuestions({
          company: selectedCompany,
          topic: selectedTopic,
          difficulty: selectedDifficulty,
          search: searchTerm,
        });
        if (isMounted && Array.isArray(fetched) && fetched.length > 0) {
          setQuestions(fetched);
        }
      } catch (err) {
        console.warn("Using offline previous questions", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchQuestions();
    return () => {
      isMounted = false;
    };
  }, [selectedCompany, selectedTopic, selectedDifficulty]);

  const companiesList = ['All', 'TCS', 'Infosys', 'Accenture', 'Cognizant', 'Wipro', 'Amazon', 'Capgemini', 'Deloitte'];
  const topicsList = ['All', 'Arrays', 'Strings', 'SQL & Databases', 'Stacks', 'Data Structures', 'Linked Lists', 'Dynamic Programming', 'Trees'];
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
                <span><strong>Public Question Bank Preview:</strong> Browse and filter 2,840+ real placement questions freely. Sign in to start interactive practice.</span>
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
                Sorted by cross-company frequency
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '1rem',
              }}
            >
              {(mockTopicFrequencies || []).map((topic) => (
                <TopicFrequencyCard key={topic.id} topic={topic} />
              ))}
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
              {Object.entries(mockCompaniesData || {}).slice(0, 4).map(([key, data]) => (
                <CompanyInsightCard key={key} companyKey={key} companyData={data} />
              ))}
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
