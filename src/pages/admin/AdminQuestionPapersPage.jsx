import React, { useState } from 'react';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { useSearchParams } from 'react-router-dom';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { QuestionPaperUpload } from '../../components/shared/QuestionPaperUpload';
import { QuestionPaperTable } from '../../components/shared/QuestionPaperTable';
import { QuestionReviewCard } from '../../components/shared/QuestionReviewCard';
import { EmptyState } from '../../components/common/EmptyState';
import { adminService } from '../../services/adminService';

const STATUS_LABELS = { needs_review: 'Needs Review', approved: 'Approved', published: 'Published', rejected: 'Rejected' };
const toTablePaper = (p) => ({ ...p, type: p.paper_type || '', questions: p.questions_count ?? 0 });
const toCardQuestion = (q, i) => ({
  ...q,
  number: i + 1,
  title: q.question_text,
  type: q.question_type || '',
  status: STATUS_LABELS[q.status] || q.status,
});
import { useToast } from '../../context/ToastContext';
import {
  FileSpreadsheet,
  Upload,
  Layers,
  Sparkles,
  Repeat,
  CheckCircle2,
  Filter,
  ShieldCheck,
} from 'lucide-react';

export const AdminQuestionPapersPage = () => {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'papers';

  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState(initialTab); // 'papers' | 'upload' | 'review'
  const [papers, setPapers] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [selectedPaperForReview, setSelectedPaperForReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 100;

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const [fetchedPapers, fetchedQuestions, dashboard] = await Promise.all([
        adminService.getQuestionPapers(),
        adminService.getExtractedQuestions(null, { page: 1, pageSize: PAGE_SIZE }),
        adminService.getDashboard(),
      ]);
      const rows = Array.isArray(fetchedQuestions) ? fetchedQuestions : [];
      setPapers((Array.isArray(fetchedPapers) ? fetchedPapers : []).map(toTablePaper));
      setQuestions(rows);
      setPage(1);
      setHasMore(rows.length === PAGE_SIZE);
      setTotalQuestions(dashboard?.extracted_questions_count ?? rows.length);
      setLoadError('');
    } catch (err) {
      setLoadError(err?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchAdminData();
  }, []);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const rows = await adminService.getExtractedQuestions(null, { page: page + 1, pageSize: PAGE_SIZE });
      setQuestions((prev) => [...prev, ...(Array.isArray(rows) ? rows : [])]);
      setPage(page + 1);
      setHasMore(Array.isArray(rows) && rows.length === PAGE_SIZE);
    } catch (err) {
      addToast(err?.message || 'Could not load more questions.', 'error');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleUploadComplete = async () => {
    await fetchAdminData();
    setActiveTab('review');
  };

  const handleViewPaper = (paper) => {
    setSelectedPaperForReview(paper);
    setActiveTab('review');
  };

  const handleApproveQuestion = async (qId) => {
    try {
      await adminService.updateQuestionStatus(qId, 'approved');
      setQuestions((prev) => prev.map((q) => (q.id === qId ? { ...q, status: 'approved' } : q)));
      addToast('Question approved and added to the student question bank.', 'success');
    } catch (err) {
      addToast(err?.message || 'Could not approve the question.', 'error');
      throw err; // the card keeps its "Needs Review" state
    }
  };

  const handleRejectQuestion = async (qId) => {
    try {
      await adminService.updateQuestionStatus(qId, 'rejected');
      setQuestions((prev) => prev.map((q) => (q.id === qId ? { ...q, status: 'rejected' } : q)));
      addToast('Question rejected. Students will not see it.', 'info');
    } catch (err) {
      addToast(err?.message || 'Could not reject the question.', 'error');
      throw err;
    }
  };

  const handleDeleteQuestion = async (qId) => {
    try {
      await adminService.deleteQuestion(qId);
      setQuestions((prev) => prev.filter((q) => q.id !== qId));
      addToast('Question deleted.', 'info');
    } catch (err) {
      addToast(err?.message || 'Could not delete the question.', 'error');
    }
  };

  const reviewQuestions = (selectedPaperForReview ? questions.filter((q) => q.paper_id === selectedPaperForReview.id) : questions).map(toCardQuestion);
  const companiesCount = new Set(papers.map((p) => p.company).filter(Boolean)).size;
  const repeatedCount = questions.filter((q) => (q.appearances_count || 1) > 1).length;

  return (
    <div className="dashboard-layout">
      <AdminSidebar />

      <main className="dashboard-main">
        <div className="dashboard-content animate-fade-in">
          {loadError && <ErrorBanner title="Question papers could not be loaded." message={loadError} onRetry={fetchAdminData} />}
          {/* Top Page Header */}
          <div
            style={{
              marginBottom: '2rem',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1.25rem',
            }}
          >
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--color-emerald)' }}>✦</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-emerald)' }}>
                  Admin Paper Processing Engine
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
                Question Paper Intelligence
              </h1>
              <p style={{ fontSize: '1rem', color: 'var(--color-charcoal-subtle)', marginTop: '4px', maxWidth: '680px' }}>
                Upload, review, index and manage previous placement and assessment papers.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Button
                variant={activeTab === 'papers' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('papers')}
              >
                All Papers ({papers.length})
              </Button>
              <Button
                variant={activeTab === 'upload' ? 'lime' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('upload')}
                icon={Upload}
              >
                Upload Paper ↗
              </Button>
              <Button
                variant={activeTab === 'review' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('review')}
              >
                Review Extracted ({totalQuestions})
              </Button>
            </div>
          </div>

          {/* =========================================================================
              TOP 4 STATISTICS CARDS
              ========================================================================= */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1.25rem',
              marginBottom: '2.5rem',
            }}
          >
            <div
              className="card-floating"
              style={{
                padding: '1.5rem',
                backgroundColor: 'var(--color-white)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-border-subtle)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', color: 'var(--color-deep-forest)', lineHeight: 1 }}>
                {papers.length}
              </div>
              <div style={{ fontSize: '0.885rem', fontWeight: 600, color: 'var(--color-charcoal-subtle)', marginTop: '6px' }}>
                Question Papers
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted-green)', marginTop: '2px' }}>
                Uploaded and indexed
              </div>
            </div>

            <div
              className="card-floating"
              style={{
                padding: '1.5rem',
                backgroundColor: 'var(--color-white)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-border-subtle)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', color: 'var(--color-emerald)', lineHeight: 1 }}>
                {totalQuestions}
              </div>
              <div style={{ fontSize: '0.885rem', fontWeight: 600, color: 'var(--color-charcoal-subtle)', marginTop: '6px' }}>
                Questions Extracted
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted-green)', marginTop: '2px' }}>
                Extracted from the papers
              </div>
            </div>

            <div
              className="card-floating"
              style={{
                padding: '1.5rem',
                backgroundColor: 'var(--color-white)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-border-subtle)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', color: 'var(--color-deep-forest)', lineHeight: 1 }}>
                {companiesCount}
              </div>
              <div style={{ fontSize: '0.885rem', fontWeight: 600, color: 'var(--color-charcoal-subtle)', marginTop: '6px' }}>
                Companies
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted-green)', marginTop: '2px' }}>
                With at least one paper
              </div>
            </div>

            <div
              className="card-floating"
              style={{
                padding: '1.5rem',
                backgroundColor: 'var(--color-white)',
                borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--color-border-subtle)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', color: 'var(--color-dark-emerald)', lineHeight: 1 }}>
                {repeatedCount}
              </div>
              <div style={{ fontSize: '0.885rem', fontWeight: 600, color: 'var(--color-charcoal-subtle)', marginTop: '6px' }}>
                Repeated Questions
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted-green)', marginTop: '2px' }}>
                Seen more than once
              </div>
            </div>
          </div>

          {/* =========================================================================
              TAB 1: QUESTION PAPERS TABLE
              ========================================================================= */}
          {activeTab === 'papers' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.35rem', fontFamily: 'var(--font-serif)', color: 'var(--color-deep-forest)', margin: 0 }}>
                  Processed Question Papers Archive
                </h3>
              </div>

              {loadError && (
                <EmptyState title="Papers could not be loaded" description="Refresh the page to try again." />
              )}
              {!loadError && !loading && papers.length === 0 && (
                <EmptyState title="No question papers yet" description="Upload your first paper to extract its questions." actionText="Upload a paper" onAction={() => setActiveTab('upload')} />
              )}
              {papers.length > 0 && <QuestionPaperTable papers={papers} onViewPaper={handleViewPaper} />}
            </div>
          )}

          {/* =========================================================================
              TAB 2: QUESTION PAPER UPLOAD FORM
              ========================================================================= */}
          {activeTab === 'upload' && (
            <div style={{ maxWidth: '820px', margin: '0 auto' }}>
              <QuestionPaperUpload
                onUploadComplete={handleUploadComplete}
                onReviewQuestions={() => setActiveTab('review')}
              />
            </div>
          )}

          {/* =========================================================================
              TAB 3: REVIEW EXTRACTED QUESTIONS
              ========================================================================= */}
          {activeTab === 'review' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.35rem', fontFamily: 'var(--font-serif)', color: 'var(--color-deep-forest)', margin: 0 }}>
                    Review Extracted Questions
                  </h3>
                  <p style={{ fontSize: '0.885rem', color: 'var(--color-muted-green)', marginTop: '2px', marginBottom: 0 }}>
                    Approve, edit, or remove questions extracted from placement papers before publishing to the student bank.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '6px' }}>
                  <Badge variant="warning">Needs Review: {questions.filter((q) => q.status === 'needs_review').length}</Badge>
                  <Badge variant="success">Approved: {questions.filter((q) => q.status === 'approved' || q.status === 'published').length}</Badge>
                </div>
              </div>

              {selectedPaperForReview && (selectedPaperForReview.warnings || []).length > 0 && (
                <div role="note" data-testid="paper-warnings" style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', background: '#FFFBEB', color: '#92400E', fontSize: '0.85rem' }}>
                  {selectedPaperForReview.warnings.join(' ')}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {!loading && reviewQuestions.length === 0 && (
                  <EmptyState title="Nothing to review" description="Questions extracted from uploaded papers appear here for approval." />
                )}
                {reviewQuestions.map((q) => (
                  <QuestionReviewCard
                    key={q.id}
                    question={q}
                    onApprove={handleApproveQuestion}
                    onReject={handleRejectQuestion}
                    onDelete={handleDeleteQuestion}
                  />
                ))}
                {hasMore && (
                  <Button variant="outline" size="md" onClick={loadMore} disabled={loadingMore} data-testid="load-more">
                    {loadingMore ? 'Loading...' : `Load more (showing ${questions.length} of ${totalQuestions})`}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminQuestionPapersPage;
