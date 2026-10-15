import React, { useEffect, useState } from 'react';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { LoadingState } from '../../components/common/LoadingState';
import { useToast } from '../../context/ToastContext';
import { adminService } from '../../services/adminService';
import { questionIntelligenceService } from '../../services/questionIntelligenceService';
import { Search, Trash2, Repeat } from 'lucide-react';

export const AdminQuestionBankPage = () => {
  const { addToast } = useToast();
  const [questions, setQuestions] = useState(null); // null = loading
  const [searchTerm, setSearchTerm] = useState('');
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoadError('');
    questionIntelligenceService.getPreviousQuestions()
      .then((rows) => alive && setQuestions(rows))
      .catch((err) => { if (alive) { setLoadError(err?.message || 'Please try again.'); setQuestions([]); } });
    return () => { alive = false; };
  }, [reloadKey]);

  const term = searchTerm.toLowerCase();
  const filtered = (questions || []).filter((q) =>
    [q.title, q.topic, q.examOrigin].some((v) => (v || '').toLowerCase().includes(term))
  );

  // Only questions that came from an uploaded paper (id "pq-<extracted id>") can be removed here
  const handleDelete = async (q) => {
    try {
      await adminService.deleteQuestion(q.id.slice(3));
      setQuestions((prev) => prev.filter((x) => x.id !== q.id));
      addToast('Question removed from the bank.', 'success');
    } catch (err) {
      addToast(err?.message || 'Could not remove the question.', 'error');
    }
  };

  return (
    <div className="dashboard-layout">
      <AdminSidebar />

      <main className="dashboard-main">
        <div className="dashboard-content animate-fade-in">
          {loadError && <ErrorBanner title="The question bank could not be loaded." message={loadError} onRetry={() => setReloadKey((k) => k + 1)} />}
          <div style={{ marginBottom: '2rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-emerald)', marginBottom: '0.4rem' }}>
              ✦ Question repository
            </div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem, 4vw, 2.5rem)', color: 'var(--color-deep-forest)', margin: 0 }}>
              Centralized Question Bank
            </h1>
            <p style={{ fontSize: '1rem', color: 'var(--color-charcoal-subtle)', marginTop: '4px' }}>
              Published placement questions students can search. Add more by uploading and approving a question paper.
            </p>
          </div>

          <div
            className="card-static"
            style={{ padding: '1rem 1.25rem', backgroundColor: 'var(--color-white)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border-subtle)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}
          >
            <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
              <Search size={16} color="var(--color-muted-green)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                aria-label="Search question bank"
                placeholder="Search question bank..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%', padding: '0.55rem 1rem 0.55rem 2.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-medium)', fontSize: '0.875rem', outline: 'none' }}
              />
            </div>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-muted-green)', fontWeight: 600 }}>
              Showing {filtered.length} of {(questions || []).length} questions
            </span>
          </div>

          {questions === null && <LoadingState message="Loading the question bank..." subtitle="One moment" />}
          {questions !== null && !loadError && filtered.length === 0 && (
            <EmptyState
              title={questions.length === 0 ? 'The question bank is empty' : 'No questions match your search'}
              description={questions.length === 0 ? 'Upload a question paper and approve its questions to fill the bank.' : 'Try a different title, topic or exam.'}
            />
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))', gap: '1.25rem' }}>
            {filtered.map((q) => (
              <div
                key={q.id}
                className="card-static"
                style={{ padding: '1.5rem', backgroundColor: 'var(--color-white)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border-subtle)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', gap: '0.5rem' }}>
                    {q.badge ? <Badge variant={q.badgeType === 'lime' ? 'lime' : 'emerald'}>{q.badge}</Badge> : <span />}
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-muted-green)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Repeat size={12} /> {q.appearances} {q.appearances === 1 ? 'appearance' : 'appearances'}
                    </span>
                  </div>

                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', color: 'var(--color-deep-forest)', margin: '0 0 0.35rem 0' }}>{q.title}</h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-emerald)', fontWeight: 600, marginBottom: '0.5rem' }}>
                    {[q.examOrigin, q.topic].filter(Boolean).join(' · ')}
                  </div>
                  {q.description && (
                    <p style={{ fontSize: '0.825rem', color: 'var(--color-charcoal-subtle)', lineHeight: 1.45, marginBottom: '1rem' }}>{q.description}</p>
                  )}
                </div>

                {q.id.startsWith('pq-') && (
                  <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => handleDelete(q)}
                      aria-label={`Remove ${q.title}`}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--color-error)' }}
                      title="Remove from the bank"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminQuestionBankPage;
