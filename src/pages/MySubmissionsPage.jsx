import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Code2 } from 'lucide-react';
import { Sidebar } from '../components/common/Sidebar';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { LoadingState } from '../components/common/LoadingState';
import { practiceService } from '../services/practiceService';
import { verdictTone } from '../utils/practiceHelpers';

const PAGE_SIZE = 10;
const TONE_VARIANT = { success: 'success', warning: 'warning', danger: 'error' };
const DIFFICULTY_VARIANT = { Easy: 'success', Medium: 'warning', Hard: 'error' };
const LANGUAGE_NAMES = { python: 'Python', javascript: 'JavaScript', java: 'Java', cpp: 'C++', c: 'C' };
const VERDICTS = ['Accepted', 'Wrong Answer', 'Runtime Error', 'Time Limit Exceeded', 'Output Limit Exceeded', 'Compile Error'];

// The API sends UTC times without a zone marker: read them as UTC, show them in the student's own time zone.
const when = (iso) => {
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  return Number.isFinite(d.getTime()) ? d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '';
};

const FilterSelect = ({ label, value, onChange, options, testId }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', minWidth: 0 }}>
    {label}
    <select className="form-input" style={{ minHeight: 40, padding: '0.4rem 0.7rem' }} value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId}>
      <option value="">All</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </label>
);

export const MySubmissionsPage = () => {
  const [filters, setFilters] = useState({ verdict: '', language: '', difficulty: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null); // null = loading
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null); // { loading, error, detail }
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setError('');
    try {
      setData(await practiceService.getMySubmissions({ page, pageSize: PAGE_SIZE, ...filters }));
    } catch (err) {
      setError(err?.message || 'Your submissions could not be loaded.');
      setData((d) => d || { items: [], total: 0, verdicts: [], languages: [] });
    }
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);

  const setFilter = (name) => (value) => { setPage(1); setFilters((f) => ({ ...f, [name]: value })); };
  const openSubmission = async (row) => {
    setOpen({ loading: true, row });
    try {
      setOpen({ detail: await practiceService.getMySubmission(row.id), row });
    } catch (err) {
      setOpen({ error: err?.message || 'This submission could not be opened.', row });
    }
  };

  const items = data?.items || [];
  const total = data?.total || 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(filters.verdict || filters.language || filters.difficulty);

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <main className="dashboard-main">
        <div className="dashboard-content animate-fade-in">
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--accent)', marginBottom: '0.4rem' }}>✦ Practice history</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2rem, 4vw, 2.5rem)', color: 'var(--text)', margin: 0 }}>My submissions</h1>
            <p style={{ fontSize: '1rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Every solution you submitted in the Practice Arena. Only you can open your code. Hidden test cases are never shown.
            </p>
          </div>

          <div className="card-static" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem', backgroundColor: 'var(--surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: '0.85rem', alignItems: 'end' }}>
              <FilterSelect label="Verdict" value={filters.verdict} onChange={setFilter('verdict')} testId="filter-verdict" options={VERDICTS.map((v) => ({ value: v, label: v }))} />
              <FilterSelect label="Language" value={filters.language} onChange={setFilter('language')} testId="filter-language"
                options={(data?.languages?.length ? data.languages : Object.keys(LANGUAGE_NAMES)).map((l) => ({ value: l, label: LANGUAGE_NAMES[l] || l }))} />
              <FilterSelect label="Difficulty" value={filters.difficulty} onChange={setFilter('difficulty')} testId="filter-difficulty" options={['Easy', 'Medium', 'Hard'].map((d) => ({ value: d, label: d }))} />
              {filtered && <Button variant="ghost" size="sm" onClick={() => { setPage(1); setFilters({ verdict: '', language: '', difficulty: '' }); }} data-testid="filter-clear">Clear filters</Button>}
            </div>
          </div>

          {data === null && <LoadingState message="Loading your submissions..." subtitle="One moment" />}
          {error && <ErrorBanner message={error} onRetry={load} />}

          {data !== null && !error && items.length === 0 && (
            <EmptyState
              title={filtered ? 'No submissions match these filters' : 'You have not submitted anything yet'}
              description={filtered ? 'Try a different verdict, language or difficulty.' : 'Solve a problem in the Practice Arena and submit it. It will appear here.'}
              actionText={filtered ? undefined : 'Open the Practice Arena'}
              onAction={filtered ? undefined : () => navigate('/practice')}
            />
          )}

          {items.length > 0 && (
            <div className="card-static" style={{ backgroundColor: 'var(--surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto', position: 'relative' }}>
                <table data-testid="submissions-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', minWidth: 620 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {['Problem', 'Language', 'Verdict', 'Runtime', 'Submitted', ''].map((h) => <th key={h || 'open'} scope="col" style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border-mid)' }}>{h || <span className="sr-only">Open</span>}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((r) => (
                      <tr key={r.id} data-testid="submission-row" style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.8rem 1rem' }}>
                          <div style={{ fontWeight: 700, color: 'var(--text)' }}>{r.problem_title}</div>
                          {r.difficulty && <Badge variant={DIFFICULTY_VARIANT[r.difficulty] || 'neutral'} size="sm">{r.difficulty}</Badge>}
                        </td>
                        <td style={{ padding: '0.8rem 1rem', color: 'var(--text)' }}>{LANGUAGE_NAMES[r.language] || r.language}</td>
                        <td style={{ padding: '0.8rem 1rem' }}>
                          <Badge variant={TONE_VARIANT[verdictTone(r.verdict)] || 'neutral'} size="sm">{r.verdict}</Badge>
                          {r.total_count != null && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{r.passed_count ?? 0}/{r.total_count} tests</div>}
                        </td>
                        <td style={{ padding: '0.8rem 1rem', color: 'var(--text)', whiteSpace: 'nowrap' }}>{r.runtime_ms != null ? `${r.runtime_ms} ms` : '-'}</td>
                        <td style={{ padding: '0.8rem 1rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{when(r.created_at)}</td>
                        <td style={{ padding: '0.8rem 1rem', textAlign: 'right' }}>
                          <Button variant="outline" size="sm" icon={Code2} onClick={() => openSubmission(r)} data-testid="open-submission" aria-label={`View code for ${r.problem_title}, ${r.verdict}`}>View code</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <nav aria-label="Pagination" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.85rem 1rem', flexWrap: 'wrap' }}>
                <span data-testid="submissions-count" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{total} {total === 1 ? 'submission' : 'submissions'}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Button variant="outline" size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => setPage((p) => p - 1)} data-testid="page-prev" aria-label="Previous page">Previous</Button>
                  <span data-testid="page-label" style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>Page {page} of {pages}</span>
                  <Button variant="outline" size="sm" icon={ChevronRight} iconPosition="right" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} data-testid="page-next" aria-label="Next page">Next</Button>
                </span>
              </nav>
            </div>
          )}
        </div>
      </main>

      <Modal isOpen={Boolean(open)} onClose={() => setOpen(null)} title={open?.row?.problem_title || 'Submission'} subtitle={open?.row ? `${LANGUAGE_NAMES[open.row.language] || open.row.language} · ${open.row.verdict} · ${when(open.row.created_at)}` : ''}>
        {open?.loading && <p style={{ color: 'var(--text-muted)' }}>Loading the code...</p>}
        {open?.error && <ErrorBanner message={open.error} />}
        {open?.detail && (
          <div data-testid="submission-detail">
            <pre data-testid="submission-code" tabIndex={0} style={{ margin: '0 0 1rem', padding: '1rem', maxHeight: '50vh', overflow: 'auto', borderRadius: 'var(--radius-md)', background: 'var(--code-bg)', color: 'var(--code-text)', border: '1px solid var(--border-mid)', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', lineHeight: 1.55, whiteSpace: 'pre' }}>
              {open.detail.code || '(no code)'}
            </pre>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <Link to={`/practice?problem=${encodeURIComponent(open.detail.problem_slug)}`} className="btn btn-primary btn-sm" data-testid="open-problem">Open this problem</Link>
              {open.detail.total_count != null && <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{open.detail.passed_count ?? 0} of {open.detail.total_count} test cases passed</span>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MySubmissionsPage;
