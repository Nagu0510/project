import React, { useState } from 'react';
import { Eye, Edit3, Trash2, Search, Filter, CheckCircle2 } from 'lucide-react';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { useToast } from '../../context/ToastContext';

export const QuestionPaperTable = ({
  papers = [],
  onViewPaper,
  onEditPaper,
  onDeletePaper,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [companyFilter, setCompanyFilter] = useState('All');
  const { addToast } = useToast();

  const filteredPapers = papers.filter((paper) => {
    const matchesSearch =
      paper.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      paper.exam.toLowerCase().includes(searchTerm.toLowerCase()) ||
      paper.type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCompany = companyFilter === 'All' || paper.company === companyFilter;
    return matchesSearch && matchesCompany;
  });

  const companiesList = ['All', ...new Set(papers.map((p) => p.company))];

  return (
    <div
      className="card-static"
      style={{
        backgroundColor: 'var(--color-white)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--color-border-subtle)',
        boxShadow: 'var(--shadow-md)',
        overflow: 'hidden',
      }}
    >
      {/* Table Filter Header */}
      <div
        style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--color-border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
          backgroundColor: 'var(--color-ivory-surface)',
        }}
      >
        <div style={{ position: 'relative', minWidth: '240px', flex: 1 }}>
          <Search
            size={16}
            color="var(--color-muted-green)"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            placeholder="Search papers by company, exam or type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 1rem 0.55rem 2.25rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-medium)',
              fontSize: '0.875rem',
              outline: 'none',
              backgroundColor: 'var(--color-white)',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-muted-green)', fontWeight: 600 }}>
            Company:
          </span>
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-medium)',
              fontSize: '0.85rem',
              outline: 'none',
              backgroundColor: 'var(--color-white)',
              cursor: 'pointer',
            }}
          >
            {companiesList.map((comp) => (
              <option key={comp} value={comp}>
                {comp}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Responsive Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.885rem' }}>
          <thead>
            <tr
              style={{
                borderBottom: '1px solid var(--color-border-subtle)',
                backgroundColor: 'rgba(6, 46, 37, 0.02)',
                color: 'var(--color-muted-green)',
                fontWeight: 700,
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              <th style={{ padding: '1rem 1.25rem' }}>Company</th>
              <th style={{ padding: '1rem 1.25rem' }}>Exam / Drive</th>
              <th style={{ padding: '1rem 1.25rem' }}>Year</th>
              <th style={{ padding: '1rem 1.25rem' }}>Questions</th>
              <th style={{ padding: '1rem 1.25rem' }}>Type</th>
              <th style={{ padding: '1rem 1.25rem' }}>Status</th>
              <th style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPapers.length > 0 ? (
              filteredPapers.map((paper) => (
                <tr
                  key={paper.id}
                  style={{
                    borderBottom: '1px solid var(--color-border-subtle)',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-ivory-surface)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <td style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--color-deep-forest)' }}>
                    {paper.company}
                  </td>
                  <td style={{ padding: '1rem 1.25rem', color: 'var(--color-charcoal-subtle)' }}>
                    {paper.exam}
                  </td>
                  <td style={{ padding: '1rem 1.25rem', fontWeight: 600, color: 'var(--color-deep-forest)' }}>
                    {paper.year}
                  </td>
                  <td style={{ padding: '1rem 1.25rem', fontWeight: 700, color: 'var(--color-emerald)' }}>
                    {paper.questions}
                  </td>
                  <td style={{ padding: '1rem 1.25rem' }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--color-ivory-surface)',
                        border: '1px solid var(--color-border-subtle)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: 'var(--color-deep-forest)',
                      }}
                    >
                      {paper.type}
                    </span>
                  </td>
                  <td style={{ padding: '1rem 1.25rem' }}>
                    <Badge variant={paper.status}>{paper.status}</Badge>
                  </td>
                  <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <button
                        onClick={() => onViewPaper(paper)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '6px',
                          color: 'var(--color-emerald)',
                          borderRadius: 'var(--radius-sm)',
                        }}
                        title="View & Review Questions"
                      >
                        <Eye size={17} />
                      </button>
                      <button
                        onClick={() => onEditPaper(paper)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '6px',
                          color: 'var(--color-muted-green)',
                          borderRadius: 'var(--radius-sm)',
                        }}
                        title="Edit Details"
                      >
                        <Edit3 size={17} />
                      </button>
                      <button
                        onClick={() => onDeletePaper(paper.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '6px',
                          color: 'var(--color-error)',
                          borderRadius: 'var(--radius-sm)',
                        }}
                        title="Delete Paper"
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--color-muted-green)' }}>
                  No question papers matching current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
