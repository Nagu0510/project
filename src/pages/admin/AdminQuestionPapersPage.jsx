import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { QuestionPaperUpload } from '../../components/shared/QuestionPaperUpload';
import { QuestionPaperTable } from '../../components/shared/QuestionPaperTable';
import { QuestionReviewCard } from '../../components/shared/QuestionReviewCard';
import {
  initialMockPapers,
  initialMockExtractedQuestions,
  mockQuestionPaperStats,
} from '../../data/mockQuestionPapers';
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
  const [papers, setPapers] = useState(initialMockPapers);
  const [questions, setQuestions] = useState(initialMockExtractedQuestions);
  const [selectedPaperForReview, setSelectedPaperForReview] = useState(null);

  const handleUploadComplete = (newPaper) => {
    setPapers((prev) => [newPaper, ...prev]);
    setActiveTab('review');
  };

  const handleViewPaper = (paper) => {
    setSelectedPaperForReview(paper);
    setActiveTab('review');
  };

  const handleEditPaper = (paper) => {
    addToast(`Editing parameters for ${paper.company} ${paper.exam}`, 'info');
  };

  const handleDeletePaper = (paperId) => {
    setPapers((prev) => prev.filter((p) => p.id !== paperId));
    addToast('Question paper removed from index.', 'info');
  };

  const handleApproveQuestion = (qId) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === qId ? { ...q, status: 'Approved' } : q))
    );
  };

  const handleEditQuestion = (qId, newTitle) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === qId ? { ...q, title: newTitle } : q))
    );
  };

  const handleDeleteQuestion = (qId) => {
    setQuestions((prev) => prev.filter((q) => q.id !== qId));
  };

  return (
    <div className="dashboard-layout">
      <AdminSidebar />

      <main className="dashboard-main">
        <div className="dashboard-content animate-fade-in">
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
                Review Extracted ({questions.length})
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
                46
              </div>
              <div style={{ fontSize: '0.885rem', fontWeight: 600, color: 'var(--color-charcoal-subtle)', marginTop: '6px' }}>
                Question Papers
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted-green)', marginTop: '2px' }}>
                Verified archival drives
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
                2,840
              </div>
              <div style={{ fontSize: '0.885rem', fontWeight: 600, color: 'var(--color-charcoal-subtle)', marginTop: '6px' }}>
                Questions Extracted
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted-green)', marginTop: '2px' }}>
                Clean semantic vectors
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
                18
              </div>
              <div style={{ fontSize: '0.885rem', fontWeight: 600, color: 'var(--color-charcoal-subtle)', marginTop: '6px' }}>
                Companies
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted-green)', marginTop: '2px' }}>
                TCS, Infosys, Accenture & more
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
                367
              </div>
              <div style={{ fontSize: '0.885rem', fontWeight: 600, color: 'var(--color-charcoal-subtle)', marginTop: '6px' }}>
                Repeated Questions
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted-green)', marginTop: '2px' }}>
                Cross-company matches
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

              <QuestionPaperTable
                papers={papers}
                onViewPaper={handleViewPaper}
                onEditPaper={handleEditPaper}
                onDeletePaper={handleDeletePaper}
              />
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
                  <Badge variant="warning">Needs Review: {questions.filter((q) => q.status === 'Needs Review').length}</Badge>
                  <Badge variant="success">Approved: {questions.filter((q) => q.status === 'Approved').length}</Badge>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {questions.map((q) => (
                  <QuestionReviewCard
                    key={q.id}
                    question={q}
                    onApprove={handleApproveQuestion}
                    onEdit={handleEditQuestion}
                    onDelete={handleDeleteQuestion}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
