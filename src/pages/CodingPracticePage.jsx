import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from '../components/common/Sidebar';
import { Navbar } from '../components/common/Navbar';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingState } from '../components/common/LoadingState';
import { practiceService } from '../services/practiceService';
import { Link } from 'react-router-dom';
import { formatExamOrigin } from '../utils/examOrigin';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Play,
  CheckCircle2,
  AlertCircle,
  Code2,
  Send,
  SlidersHorizontal,
  Check,
  X,
  HelpCircle,
  Building2,
  Terminal,
  FileCode,
  Layers,
} from 'lucide-react';

const DIFFICULTY_OPTIONS = ['All', 'Easy', 'Medium', 'Hard'];
const LANGUAGES = [
  ['python', 'Python 3'],
  ['java', 'Java (class Main)'],
  ['c', 'C (GCC)'],
  ['cpp', 'C++ (G++)'],
  ['javascript', 'JavaScript (Node.js)'],
];
const BUSY_TITLE = 'Online compiler is busy';

// Turn a failed run/submit request into a message a student can act on. Never returns an empty string.
const explainExecutionError = (err) => {
  const detail = err?.message || '';
  switch (err?.status) {
    case 401:
      return { tone: 'warning', title: 'Please sign in', message: 'You need to be signed in as a student to run code. Sign in and try again.' };
    case 403:
      return { tone: 'warning', title: 'Student account required', message: 'Only student accounts can run code in the practice arena.' };
    case 413:
      return { tone: 'warning', title: 'Code too large', message: detail || 'Your code or input is larger than the allowed limit (20 KB of code).' };
    case 429:
      if (/online compiler/i.test(detail)) {
        return { tone: 'warning', title: BUSY_TITLE, message: detail };
      }
      return { tone: 'warning', title: 'Slow down a little', message: 'You are running code too quickly. The limit is 10 runs or submissions per minute. Wait a moment and try again.' };
    case 503:
      if (/online compiler/i.test(detail)) {
        return { tone: 'error', title: BUSY_TITLE, message: detail };
      }
      return { tone: 'error', title: 'Code runner unavailable', message: detail || 'The code runner is not available right now. Please try again later.' };
    default:
      if (err?.isNetworkError || err?.isTimeout || /reach the server|timed out/i.test(detail)) {
        return { tone: 'error', title: 'Cannot reach the server', message: 'The request did not reach the server. Check your connection and try again.' };
      }
      return { tone: 'error', title: 'Something went wrong', message: detail || 'The code could not be run. Please try again.' };
  }
};

// Results that need more than a status word: show what to do next.
const noticeForResult = (res) => {
  if (res.status === 'Judge unavailable') {
    return { tone: 'warning', title: BUSY_TITLE, message: `${res.message || 'Try again in a moment.'} Your code was not judged and nothing was recorded.` };
  }
  if (res.status === 'Time Limit Exceeded') {
    return { tone: 'warning', title: 'Time limit exceeded', message: 'Your program ran too long and was stopped. Check for an infinite loop or a slow approach.' };
  }
  return null;
};

const VERDICT_TONE = {
  Accepted: { color: 'var(--color-lime)', bg: 'rgba(183, 228, 74, 0.14)', border: 'rgba(183, 228, 74, 0.45)' },
  'Judge unavailable': { color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.5)' },
};
const VERDICT_FAIL = { color: '#EF4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.45)' };

// The result of a submit: verdict, how many cases passed, and what failed (input and expected only for a shown case).
const VerdictPanel = ({ result }) => {
  const tone = VERDICT_TONE[result.status] || VERDICT_FAIL;
  const failing = (result.test_results || []).find((t) => t.case === result.failed_case);
  const judged = result.status !== 'Judge unavailable' && result.status !== 'Compile Error';
  return (
    <div
      data-testid="verdict"
      data-verdict={result.status}
      style={{ marginBottom: '0.75rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-lg)', background: tone.bg, border: `1px solid ${tone.border}`, color: 'var(--color-ivory)', fontSize: '0.85rem' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '6px' }}>
        <strong data-testid="verdict-status" style={{ color: tone.color, fontSize: '1.05rem' }}>
          {result.status === 'Judge unavailable' ? BUSY_TITLE : result.status}
        </strong>
        {judged && (
          <span style={{ fontSize: '0.75rem', color: 'rgba(244, 240, 231, 0.7)' }}>
            {result.passed_count}/{result.total_count} test cases passed &middot; {result.runtime_ms} ms
          </span>
        )}
      </div>
      {result.message && result.status !== 'Compile Error' && !failing && (
        <div data-testid="submit-message" style={{ marginTop: '4px', color: 'rgba(244, 240, 231, 0.85)' }}>{result.message}</div>
      )}
      {result.status === 'Compile Error' && result.compile_output && (
        <pre style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap', color: '#F59E0B', fontSize: '0.78rem', maxHeight: '110px', overflow: 'auto' }}>{result.compile_output}</pre>
      )}
      {failing && result.status !== 'Accepted' && (
        <div data-testid="failed-case" style={{ marginTop: '8px', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
          <div style={{ fontWeight: 700 }}>Failed on test case {failing.case}{failing.is_hidden ? ' (hidden)' : ''}</div>
          {failing.is_hidden ? (
            <div style={{ color: 'rgba(244, 240, 231, 0.7)' }}>The input and expected output of hidden cases are not shown.</div>
          ) : (
            <>
              <div style={{ whiteSpace: 'pre-wrap' }}><strong>Input:</strong> {failing.input}</div>
              <div style={{ whiteSpace: 'pre-wrap' }}><strong>Expected:</strong> {failing.expected}</div>
              <div style={{ whiteSpace: 'pre-wrap' }}><strong>Your output:</strong> {failing.actual || '(nothing printed)'}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export const CodingPracticePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSlug = searchParams.get('problem');

  const { isAuthenticated, isStudent, requireAuth } = useAuth();
  const { addToast } = useToast();

  const [problems, setProblems] = useState([]);
  const [solved, setSolved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Question Intelligence state
  const [matchData, setMatchData] = useState(null);

  // Filter States
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [selectedTopic, setSelectedTopic] = useState('All');

  // IDE / Execution States
  const [selectedLanguage, setSelectedLanguage] = useState('python');
  const [code, setCode] = useState('');
  const [customStdin, setCustomStdin] = useState('');
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [outputTab, setOutputTab] = useState('output'); // 'output' | 'testcases' | 'stdin'
  const drafts = useRef({}); // what the student typed per problem + language, so switching never loses work

  // Real execution output object
  const [executionResult, setExecutionResult] = useState(null);

  const requestedProblem = problems.find((p) => p.slug === requestedSlug || p.id === requestedSlug);
  const currentProblem = requestedProblem || problems[0] || null;
  const unknownRequested = Boolean(requestedSlug) && problems.length > 0 && !requestedProblem;
  const slug = currentProblem?.slug;

  const topics = ['All', ...Array.from(new Set(problems.map((p) => p.topic).filter(Boolean)))];
  const visibleProblems = problems.filter(
    (p) => (selectedDifficulty === 'All' || p.difficulty === selectedDifficulty)
      && (selectedTopic === 'All' || p.topic === selectedTopic)
  );
  const selectable = currentProblem && !visibleProblems.includes(currentProblem) ? [currentProblem, ...visibleProblems] : visibleProblems;

  // The catalog comes from the API only; there is no built-in list to fall back to.
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const fetched = await practiceService.getProblems();
        if (alive) setProblems(fetched);
      } catch {
        if (alive) setError('Failed to load coding problem catalog.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [reloadKey]);

  const refreshSolved = () => {
    if (!isStudent) { setSolved([]); return; }
    practiceService.getSolved().then(setSolved).catch(() => setSolved([]));
  };
  useEffect(refreshSolved, [isStudent]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load this problem's code for the chosen language: the student's own draft, else the starter code
  useEffect(() => {
    if (!currentProblem) return;
    setCode(drafts.current[`${slug}:${selectedLanguage}`] ?? currentProblem.starterCode?.[selectedLanguage] ?? '');
    setExecutionResult(null);
  }, [slug, selectedLanguage]); // eslint-disable-line react-hooks/exhaustive-deps

  // A new problem starts with its first sample as the custom input, and is checked against Question Intelligence
  useEffect(() => {
    if (!currentProblem) return undefined;
    setCustomStdin(currentProblem.examples?.[0]?.input || '');
    let alive = true;
    practiceService
      .matchQuestionIntelligence(currentProblem.id, `${currentProblem.title} ${currentProblem.description}`)
      .then((matchRes) => { if (alive) setMatchData(matchRes && matchRes.matched ? matchRes : null); });
    return () => { alive = false; };
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCodeChange = (value) => {
    setCode(value);
    drafts.current[`${slug}:${selectedLanguage}`] = value;
  };

  const handleSelectProblem = (nextSlug) => {
    setSearchParams({ problem: nextSlug });
  };

  const showExecutionError = (err) => {
    const notice = explainExecutionError(err);
    setExecutionResult({ type: 'error', status: notice.title, notice, stdout: '', stderr: '', compile_output: '' });
    setOutputTab('output'); // the inline notice in the output panel is the message; no extra toast stack
  };

  const handleRunCode = () => {
    requireAuth(async () => {
      setRunning(true);
      setExecutionResult(null);
      try {
        const res = await practiceService.runCode(
          currentProblem?.id || currentProblem?.slug,
          selectedLanguage,
          code,
          customStdin
        );
        setExecutionResult({
          type: 'run',
          status: res.status,
          stdout: res.stdout,
          stderr: res.stderr,
          compile_output: res.compile_output,
          runtime_ms: res.runtime_ms,
          memory_kb: res.memory_kb,
          notice: noticeForResult(res),
        });
        setOutputTab('output');
        if (res.status === 'Success') {
          addToast('Code executed successfully!', 'success');
        } else {
          addToast(`Execution ended with ${res.status}`, 'warning');
        }
      } catch (err) {
        showExecutionError(err);
      } finally {
        setRunning(false);
      }
    }, '/practice');
  };

  const handleSubmit = () => {
    requireAuth(async () => {
      setSubmitting(true);
      setExecutionResult(null);
      try {
        const res = await practiceService.submitCode(
          currentProblem?.id || currentProblem?.slug,
          selectedLanguage,
          code
        );
        setExecutionResult({
          type: 'submit',
          status: res.status,
          passed_count: res.passed_count,
          total_count: res.total_count,
          stdout: res.stdout,
          stderr: res.stderr,
          compile_output: res.compile_output,
          runtime_ms: res.runtime_ms,
          memory_kb: res.memory_kb,
          test_results: res.test_results || [],
          failed_case: res.failed_case,
          message: res.message,
          notice: noticeForResult(res),
        });
        setOutputTab(res.test_results?.length ? 'testcases' : 'output');
        if (res.status === 'Accepted') {
          addToast(`Accepted! Passed ${res.passed_count}/${res.total_count} test cases.`, 'success');
          refreshSolved();
        } else if (res.status === 'Judge unavailable') {
          addToast(`${BUSY_TITLE}. Nothing was recorded, try again.`, 'warning');
        } else {
          addToast(`${res.status}: passed ${res.passed_count}/${res.total_count} test cases.`, 'warning');
        }
      } catch (err) {
        showExecutionError(err);
      } finally {
        setSubmitting(false);
      }
    }, '/practice');
  };

  const examples = Array.isArray(currentProblem?.examples) ? currentProblem.examples : [];

  // Determine active company tags (prioritize DB Question Intelligence matches)
  const displayCompanies = matchData?.companies?.length > 0
    ? matchData.companies
    : (currentProblem?.companies || []);

  return (
    <div className={isAuthenticated ? "dashboard-layout" : ""} style={{ minHeight: '100vh', backgroundColor: 'var(--color-ivory)' }}>
      {isAuthenticated ? <Sidebar /> : <Navbar />}

      <main className={isAuthenticated ? "dashboard-main" : "container-custom"} style={{ padding: isAuthenticated ? undefined : '2rem 1.5rem 5rem' }}>
        <div className="dashboard-content animate-fade-in" style={{ padding: isAuthenticated ? undefined : 0, maxWidth: '1400px', margin: '0 auto' }}>

          {/* Question Intelligence Match Banner Notification */}
          {matchData && matchData.matched && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                backgroundColor: 'var(--color-lime-soft)',
                border: '1px solid rgba(183, 228, 74, 0.4)',
                borderRadius: 'var(--radius-xl)',
                padding: '0.85rem 1.25rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Building2 size={20} color="var(--color-forest)" />
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-forest)' }}>
                  Question Intelligence Match:
                  <span style={{ fontWeight: 500, marginLeft: '6px' }}>
                    {matchData.best_match ? (
                      <>This question was asked in <strong>{formatExamOrigin(matchData.best_match.company, matchData.best_match.exam, matchData.best_match.year)}</strong>.</>
                    ) : (
                      <>Previously asked in <strong>{matchData.exam_origin}</strong>.</>
                    )}
                  </span>
                </span>
              </div>
              <Badge variant="lime" size="sm">
                ✦ {Math.round((matchData.similarity || 0.90) * 100)}% Verified Match
              </Badge>
            </motion.div>
          )}

          {/* Header & Filter Controls */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              background: 'var(--color-white)',
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-2xl)',
              padding: '1.25rem 1.5rem',
              marginBottom: '1.5rem',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
            }}
          >
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--color-emerald)' }}>✦</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-emerald)', letterSpacing: '0.06em' }}>
                  Online Compiler &middot; needs internet
                </span>
              </div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem', color: 'var(--color-forest)', margin: 0, lineHeight: 1.1 }}>
                Coding & Skill Practice Arena
              </h1>
            </div>

            {/* Filter Dropdowns */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-forest)' }}>Topic:</span>
                <select
                  aria-label="Filter by topic"
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  style={{
                    padding: '0.5rem 0.85rem',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--color-border-medium)',
                    backgroundColor: 'var(--color-ivory-soft)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: 'var(--color-forest)',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {topics.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-forest)' }}>Difficulty:</span>
                <select
                  aria-label="Filter by difficulty"
                  value={selectedDifficulty}
                  onChange={(e) => setSelectedDifficulty(e.target.value)}
                  style={{
                    padding: '0.5rem 0.85rem',
                    borderRadius: 'var(--radius-full)',
                    border: '1px solid var(--color-border-medium)',
                    backgroundColor: 'var(--color-ivory-soft)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    color: 'var(--color-forest)',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {DIFFICULTY_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
          </motion.div>

          {loading && <LoadingState message="Loading coding problems..." subtitle="One moment" />}
          {!loading && error && (
            <EmptyState
              title="Problems could not be loaded"
              description="The problem catalog is unavailable right now. Check your connection and try again."
              actionText="Try again"
              onAction={() => setReloadKey((k) => k + 1)}
            />
          )}
          {!loading && !error && !currentProblem && (
            <EmptyState
              title="No coding problems yet"
              description="The problem bank is empty. Problems appear here once they have been loaded into the database."
            />
          )}
          {unknownRequested && (
            <div role="status" data-testid="unknown-problem" style={{ marginBottom: '1rem', padding: '0.7rem 1rem', borderRadius: 'var(--radius-md)', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.4)', fontSize: '0.875rem', color: 'var(--color-forest)' }}>
              The problem "{requestedSlug}" is not available. Showing "{currentProblem?.title}" instead.
            </div>
          )}

          {/* Main IDE Workspace */}
          {!loading && currentProblem && (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentProblem.id || currentProblem.slug}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '1.5rem',
                }}
                className="practice-workspace-grid"
              >
                {/* Left Panel: Problem Statement */}
                <div
                  style={{
                    background: 'var(--color-white)',
                    border: '1px solid var(--color-border-subtle)',
                    borderRadius: 'var(--radius-2xl)',
                    padding: '1.75rem',
                    boxShadow: 'var(--shadow-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Badge variant={currentProblem.difficulty === 'Easy' ? 'emerald' : currentProblem.difficulty === 'Medium' ? 'medium' : 'hard'}>
                          {currentProblem.difficulty}
                        </Badge>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                          {currentProblem.category || currentProblem.topic || 'Coding'}
                        </span>
                        {solved.includes(currentProblem.slug) && (
                          <span data-testid="solved-badge"><Badge variant="success">✓ Solved</Badge></span>
                        )}
                      </div>

                      {problems.length > 1 && (
                        <select
                          aria-label="Choose a problem"
                          data-testid="problem-select"
                          value={currentProblem.slug}
                          onChange={(e) => handleSelectProblem(e.target.value)}
                          style={{
                            padding: '4px 10px',
                            maxWidth: '100%',
                            minWidth: 0,
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border-medium)',
                            backgroundColor: 'var(--color-ivory-soft)',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: 'var(--color-forest)',
                            cursor: 'pointer',
                          }}
                        >
                          {selectable.map((p) => (
                            <option key={p.id} value={p.slug}>
                              {solved.includes(p.slug) ? '✓ ' : ''}{p.title} ({p.difficulty})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem', color: 'var(--color-forest)', margin: '0 0 1rem 0' }}>
                      {currentProblem.title}
                    </h2>

                    <p style={{ fontSize: '0.9375rem', color: 'var(--color-charcoal)', lineHeight: 1.7, marginBottom: '1.5rem', whiteSpace: 'pre-line' }}>
                      {currentProblem.description}
                    </p>

                    {(currentProblem.inputFormat || currentProblem.outputFormat || currentProblem.constraints?.length > 0) && (
                      <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem', color: 'var(--color-charcoal)', lineHeight: 1.6 }}>
                        {currentProblem.inputFormat && (
                          <div><strong style={{ color: 'var(--color-forest)' }}>Input format. </strong>{currentProblem.inputFormat}</div>
                        )}
                        {currentProblem.outputFormat && (
                          <div><strong style={{ color: 'var(--color-forest)' }}>Output format. </strong>{currentProblem.outputFormat}</div>
                        )}
                        {currentProblem.constraints?.length > 0 && (
                          <div>
                            <strong style={{ color: 'var(--color-forest)' }}>Constraints</strong>
                            <ul style={{ margin: '4px 0 0', paddingLeft: '1.25rem' }}>
                              {currentProblem.constraints.map((c) => <li key={c}>{c}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Examples Section */}
                    {examples.length > 0 && (
                      <div style={{ marginBottom: '1.5rem' }}>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-forest)', marginBottom: '0.75rem' }}>
                          Example Cases
                        </h4>
                        {examples.map((ex, idx) => (
                          <div
                            key={idx}
                            style={{
                              background: 'var(--color-ivory-soft)',
                              border: '1px solid var(--color-border-medium)',
                              borderRadius: 'var(--radius-md)',
                              padding: '0.875rem 1rem',
                              marginBottom: '0.625rem',
                              fontSize: '0.85rem',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            <div style={{ whiteSpace: 'pre-wrap' }}><strong>Input:</strong> {ex.input}</div>
                            <div style={{ whiteSpace: 'pre-wrap' }}><strong>Output:</strong> {ex.output}</div>
                            {ex.explanation && <div style={{ color: 'var(--color-text-muted)', marginTop: '4px', fontFamily: 'var(--font-sans)', fontSize: '0.8rem' }}>{ex.explanation}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Company Tagging Footer */}
                  {displayCompanies.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--color-border-subtle)', paddingTop: '1rem' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: '6px' }}>
                        {matchData?.matched ? 'Verified in corporate placement drives:' : 'Recently asked by:'}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {displayCompanies.map((c) => (
                          <span key={c} className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                            ✦ {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Panel: Code Editor IDE (dark surface: native option lists use the .dark-panel colours) */}
                <div
                  className="dark-panel"
                  style={{
                    background: 'var(--color-forest)',
                    borderRadius: 'var(--radius-2xl)',
                    padding: '1.5rem',
                    boxShadow: 'var(--shadow-xl)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    {/* Header bar: Language Switcher + Run/Submit buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <select
                        aria-label="Language"
                        data-testid="language-select"
                        value={selectedLanguage}
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                        style={{
                          padding: '0.4rem 0.85rem',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid rgba(183, 228, 74, 0.3)',
                          backgroundColor: 'rgba(244, 240, 231, 0.08)',
                          color: 'var(--color-ivory)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.825rem',
                          outline: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        {LANGUAGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Button variant="lime" size="sm" onClick={handleRunCode} disabled={running || submitting}>
                          {running ? 'Running...' : 'Run Code ▶'}
                        </Button>
                        <Button variant="outline" className="btn-outline-light" size="sm" onClick={handleSubmit} disabled={running || submitting}>
                          {submitting ? 'Evaluating...' : 'Submit'}
                        </Button>
                      </div>
                    </div>

                    {!isAuthenticated && (
                      <div
                        data-testid="signin-hint"
                        style={{ marginBottom: '0.75rem', padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-md)', background: 'rgba(183, 228, 74, 0.12)', border: '1px solid rgba(183, 228, 74, 0.3)', color: 'var(--color-ivory)', fontSize: '0.8rem' }}
                      >
                        You need to be signed in to run or submit code.{' '}
                        <Link to="/login" style={{ color: 'var(--color-lime)', fontWeight: 700 }}>Sign in</Link>
                        {' '}or{' '}
                        <Link to="/signup" style={{ color: 'var(--color-lime)', fontWeight: 700 }}>create a free account</Link>.
                      </div>
                    )}

                    {/* Code Editor Textarea */}
                    <textarea
                      value={code}
                      onChange={(e) => handleCodeChange(e.target.value)}
                      aria-label="Code editor"
                      spellCheck={false}
                      style={{
                        width: '100%',
                        height: '280px',
                        background: 'rgba(0, 0, 0, 0.25)',
                        border: '1px solid rgba(183, 228, 74, 0.15)',
                        borderRadius: 'var(--radius-lg)',
                        padding: '1rem',
                        color: 'var(--color-lime-soft)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.875rem',
                        lineHeight: 1.6,
                        outline: 'none',
                        resize: 'vertical',
                      }}
                    />
                  </div>

                  {/* Output Terminal & Test Case Results Panel */}
                  <div style={{ marginTop: '1rem' }}>
                    {executionResult?.type === 'submit' && <VerdictPanel result={executionResult} />}

                    {/* Navigation Tabs */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', borderBottom: '1px solid rgba(244, 240, 231, 0.15)', pb: '4px' }}>
                      <button
                        onClick={() => setOutputTab('output')}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '4px 10px',
                          color: outputTab === 'output' ? 'var(--color-lime)' : 'rgba(244, 240, 231, 0.6)',
                          fontWeight: outputTab === 'output' ? 700 : 500,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          borderBottom: outputTab === 'output' ? '2px solid var(--color-lime)' : 'none',
                        }}
                      >
                        Terminal Output
                      </button>
                      <button
                        onClick={() => setOutputTab('testcases')}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '4px 10px',
                          color: outputTab === 'testcases' ? 'var(--color-lime)' : 'rgba(244, 240, 231, 0.6)',
                          fontWeight: outputTab === 'testcases' ? 700 : 500,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          borderBottom: outputTab === 'testcases' ? '2px solid var(--color-lime)' : 'none',
                        }}
                      >
                        Test Cases {executionResult?.test_results ? `(${executionResult.passed_count}/${executionResult.total_count})` : ''}
                      </button>
                      <button
                        onClick={() => setOutputTab('stdin')}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '4px 10px',
                          color: outputTab === 'stdin' ? 'var(--color-lime)' : 'rgba(244, 240, 231, 0.6)',
                          fontWeight: outputTab === 'stdin' ? 700 : 500,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          borderBottom: outputTab === 'stdin' ? '2px solid var(--color-lime)' : 'none',
                        }}
                      >
                        Custom Stdin
                      </button>
                    </div>

                    {/* Tab 1: Terminal Output */}
                    {outputTab === 'output' && (
                      <div
                        style={{
                          background: 'rgba(0, 0, 0, 0.35)',
                          border: '1px solid rgba(183, 228, 74, 0.2)',
                          borderRadius: 'var(--radius-lg)',
                          padding: '0.85rem 1rem',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.8125rem',
                          minHeight: '110px',
                          maxHeight: '180px',
                          overflowY: 'auto',
                        }}
                      >
                        {executionResult ? (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <span style={{
                                fontWeight: 700,
                                color: executionResult.status === 'Success' || executionResult.status === 'Accepted'
                                  ? 'var(--color-lime)'
                                  : '#EF4444'
                              }}>
                                Status: {executionResult.status}
                              </span>
                              {executionResult.type !== 'error' && (
                                <span style={{ fontSize: '0.75rem', color: 'rgba(244, 240, 231, 0.5)' }}>
                                  {executionResult.runtime_ms} ms{executionResult.memory_kb != null ? ` | ${executionResult.memory_kb} KB` : ''}
                                </span>
                              )}
                            </div>

                            {executionResult.notice && (
                              <div
                                role="alert"
                                data-testid="execution-notice"
                                style={{
                                  marginBottom: '8px',
                                  padding: '8px 10px',
                                  borderRadius: 'var(--radius-md)',
                                  border: `1px solid ${executionResult.notice.tone === 'error' ? 'rgba(239, 68, 68, 0.5)' : 'rgba(245, 158, 11, 0.5)'}`,
                                  background: executionResult.notice.tone === 'error' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                                  color: 'var(--color-ivory)',
                                  whiteSpace: 'pre-wrap',
                                }}
                              >
                                <strong>{executionResult.notice.title}.</strong> {executionResult.notice.message}
                              </div>
                            )}

                            {/* Compilation / Compiler Output */}
                            {executionResult.compile_output && (
                              <div style={{ color: '#F59E0B', whiteSpace: 'pre-wrap', marginBottom: '6px' }}>
                                <strong>Compile Output:</strong><br />
                                {executionResult.compile_output}
                              </div>
                            )}

                            {/* Stderr / Runtime Error Output */}
                            {executionResult.stderr && (
                              <div style={{ color: '#EF4444', whiteSpace: 'pre-wrap', marginBottom: '6px' }}>
                                <strong>Error Log (stderr):</strong><br />
                                {executionResult.stderr}
                              </div>
                            )}

                            {/* Stdout Output */}
                            {executionResult.stdout ? (
                              <div style={{ color: 'var(--color-ivory)', whiteSpace: 'pre-wrap' }}>
                                <strong>Standard Output (stdout):</strong><br />
                                {executionResult.stdout}
                              </div>
                            ) : (
                              !executionResult.stderr && !executionResult.compile_output && !executionResult.notice && (
                                <div style={{ color: 'rgba(244, 240, 231, 0.5)' }}>[No stdout produced]</div>
                              )
                            )}
                          </div>
                        ) : (
                          <div style={{ color: 'rgba(244, 240, 231, 0.4)', fontStyle: 'italic' }}>
                            Click "Run Code" to try your program on the custom input, or "Submit" to judge it.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab 2: Test Cases */}
                    {outputTab === 'testcases' && (
                      <div
                        style={{
                          background: 'rgba(0, 0, 0, 0.35)',
                          border: '1px solid rgba(183, 228, 74, 0.2)',
                          borderRadius: 'var(--radius-lg)',
                          padding: '0.85rem 1rem',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.8125rem',
                          minHeight: '110px',
                          maxHeight: '180px',
                          overflowY: 'auto',
                        }}
                      >
                        {executionResult?.test_results && executionResult.test_results.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {executionResult.test_results.map((tr, idx) => (
                              <div
                                key={idx}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: 'var(--radius-md)',
                                  backgroundColor: tr.passed ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                  border: `1px solid ${tr.passed ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: tr.passed ? '#10B981' : '#EF4444' }}>
                                  <span>Case {tr.case} {tr.is_hidden ? '(Hidden)' : ''}: {tr.passed ? 'PASSED ✓' : 'FAILED ✗'}</span>
                                </div>
                                {!tr.is_hidden && (
                                  <div style={{ marginTop: '4px', fontSize: '0.75rem', color: 'rgba(244, 240, 231, 0.8)' }}>
                                    <div><strong>Input:</strong> {tr.input}</div>
                                    <div><strong>Expected:</strong> {tr.expected}</div>
                                    <div><strong>Actual:</strong> {tr.actual}</div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ color: 'rgba(244, 240, 231, 0.4)', fontStyle: 'italic' }}>
                            Click "Submit" to judge your solution against the sample and hidden test cases.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab 3: Custom Stdin */}
                    {outputTab === 'stdin' && (
                      <textarea
                        value={customStdin}
                        onChange={(e) => setCustomStdin(e.target.value)}
                        aria-label="Custom input"
                        placeholder="Type the input your program should read (stdin)..."
                        style={{
                          width: '100%',
                          height: '110px',
                          background: 'rgba(0, 0, 0, 0.35)',
                          border: '1px solid rgba(183, 228, 74, 0.2)',
                          borderRadius: 'var(--radius-lg)',
                          padding: '0.85rem 1rem',
                          color: 'var(--color-ivory)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.8125rem',
                          outline: 'none',
                          resize: 'none',
                        }}
                      />
                    )}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </main>

      <style>{`
        .practice-workspace-grid > * { min-width: 0; }
        @media (max-width: 900px) {
          .practice-workspace-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
};

export default CodingPracticePage;
