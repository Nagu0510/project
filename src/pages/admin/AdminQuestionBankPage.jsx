import React, { useState } from 'react';
import { AdminSidebar } from '../../components/admin/AdminSidebar';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { mockPreviousQuestionsList } from '../../data/mockPreviousQuestions';
import { useToast } from '../../context/ToastContext';
import { Database, Search, Filter, Trash2, Edit3, Check, Plus, Repeat } from 'lucide-react';

export const AdminQuestionBankPage = () => {
  const { addToast } = useToast();
  const [questions, setQuestions] = useState(mockPreviousQuestionsList);
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = questions.filter((q) =>
    q.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
    q.examOrigin.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = (id) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
    addToast('Question removed from candidate bank.', 'info');
  };

  return (
    <div className="dashboard-layout">
      <AdminSidebar />

      <main className="dashboard-main">
        <div className="dashboard-content animate-fade-in">
          {/* Header */}
          <div style={{ marginBottom: '2rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '0.4rem' }}>
                <span style={{ color: 'var(--color-emerald)' }}>✦</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-emerald)' }}>
                  Question Repository Management
                </span>
              </div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', color: 'var(--color-deep-forest)', margin: 0 }}>
                Centralized Question Bank
              </h1>
              <p style={{ fontSize: '1rem', color: 'var(--color-charcoal-subtle)', marginTop: '4px' }}>
                Manage verified placement questions accessible to students for diagnostic evaluation and practice.
              </p>
            </div>

            <Button variant="primary" size="md" icon={Plus} onClick={() => addToast('Add question dialog opened', 'info')}>
              Add Manual Question
            </Button>
          </div>

          {/* Search Bar */}
          <div
            className="card-static"
            style={{
              padding: '1rem 1.25rem',
              backgroundColor: 'var(--color-white)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-border-subtle)',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
              <Search size={16} color="var(--color-muted-green)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Search question bank..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem 1rem 0.55rem 2.25rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-medium)',
                  fontSize: '0.875rem',
                  outline: 'none',
                }}
              />
            </div>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-muted-green)', fontWeight: 600 }}>
              Showing {filtered.length} of {questions.length} questions
            </span>
          </div>

          {/* Questions Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
            {filtered.map((q) => (
              <div
                key={q.id}
                className="card-static"
                style={{
                  padding: '1.5rem',
                  backgroundColor: 'var(--color-white)',
                  borderRadius: 'var(--radius-xl)',
                  border: '1px solid var(--color-border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <Badge variant={q.badgeType === 'lime' ? 'lime' : 'emerald'}>{q.badge}</Badge>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-muted-green)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Repeat size={12} /> {q.appearances} repeats
                    </span>
                  </div>

                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', color: 'var(--color-deep-forest)', margin: '0 0 0.35rem 0' }}>
                    {q.title}
                  </h3>

                  <div style={{ fontSize: '0.8rem', color: 'var(--color-emerald)', fontWeight: 600, marginBottom: '0.5rem' }}>
                    {q.examOrigin} · {q.topic}
                  </div>

                  <p style={{ fontSize: '0.825rem', color: 'var(--color-charcoal-subtle)', lineHeight: 1.45, marginBottom: '1rem' }}>
                    {q.description}
                  </p>
                </div>

                <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-deep-forest)' }}>
                    Similarity: {q.similarity}%
                  </span>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => addToast(`Editing ${q.title}`, 'info')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--color-emerald)' }}
                      title="Edit"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(q.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--color-error)' }}
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};
