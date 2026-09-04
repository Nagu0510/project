import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sidebar } from '../components/common/Sidebar';
import { Navbar } from '../components/common/Navbar';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { practiceService } from '../services/practiceService';
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

const SKILL_OPTIONS = ['All Skills', 'Python', 'Java', 'C', 'C++', 'JavaScript', 'SQL', 'DSA'];
const DIFFICULTY_OPTIONS = ['All', 'Easy', 'Medium', 'Hard'];

export const CodingPracticePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedSlug = searchParams.get('problem') || 'two-sum';

  const { user, isAuthenticated, requireAuth } = useAuth();
  const { addToast } = useToast();

  const [problems, setProblems] = useState([]);
  const [currentProblem, setCurrentProblem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Question Intelligence state
  const [matchData, setMatchData] = useState(null);

  // Filter States
  const [selectedSkill, setSelectedSkill] = useState('All Skills');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [selectedTopic, setSelectedTopic] = useState('All');

  // IDE / Execution States
  const [selectedLanguage, setSelectedLanguage] = useState('python');
  const [code, setCode] = useState('');
  const [customStdin, setCustomStdin] = useState('');
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [outputTab, setOutputTab] = useState('output'); // 'output' | 'testcases' | 'stdin'

  // Real execution output object
  const [executionResult, setExecutionResult] = useState(null);

  // Fetch problems on mount and when filters change
  useEffect(() => {
    let isMounted = true;
    const loadProblems = async () => {
      setLoading(true);
      setError(null);
      try {
        const filters = {};
        if (selectedSkill !== 'All Skills') filters.skill = selectedSkill;
        if (selectedDifficulty !== 'All') filters.difficulty = selectedDifficulty;
        if (selectedTopic !== 'All') filters.topic = selectedTopic;

        const fetched = await practiceService.getProblems(filters);
        if (isMounted) {
          setProblems(fetched);
          const target = fetched.find((p) => p.slug === requestedSlug || p.id === requestedSlug) || fetched[0] || null;
          setCurrentProblem(target);
          if (target) {
            const sc = target.starterCode || target.starter_code || {};
            const initialCode = sc[selectedLanguage] || sc.python || '';
            setCode(initialCode);
          }
        }
      } catch (err) {
        if (isMounted) setError('Failed to load coding problem catalog.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadProblems();
    return () => { isMounted = false; };
  }, [requestedSlug, selectedSkill, selectedDifficulty, selectedTopic]);

  // Sync starter code and trigger Question Intelligence matching on problem load
  useEffect(() => {
    if (currentProblem) {
      const sc = currentProblem.starterCode || currentProblem.starter_code || {};
      const newCode = sc[selectedLanguage] || sc.python || '';
      setCode(newCode);
      setExecutionResult(null);

      // Trigger Question Intelligence scan against Admin-uploaded papers
      const checkQuestionIntelligence = async () => {
        const textToMatch = `${currentProblem.title} ${currentProblem.description}`;
        const matchRes = await practiceService.matchQuestionIntelligence(currentProblem.id, textToMatch);
        if (matchRes && matchRes.matched) {
          setMatchData(matchRes);
        } else {
          setMatchData(null);
        }
      };
      checkQuestionIntelligence();
    }
  }, [selectedLanguage, currentProblem]);

  const handleSelectProblem = (slug) => {
    setSearchParams({ problem: slug });
    const target = problems.find((p) => p.slug === slug || p.id === slug);
    if (target) {
      setCurrentProblem(target);
      setExecutionResult(null);
    }
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
        });
        setOutputTab('output');
        if (res.status === 'Success') {
          addToast('Code executed successfully!', 'success');
        } else {
          addToast(`Execution ended with ${res.status}`, 'warning');
        }
      } catch (e) {
        addToast('Execution failed to communicate with sandbox.', 'error');
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
        });
        setOutputTab('testcases');
        if (res.status === 'Accepted') {
          addToast(`Accepted! Passed ${res.passed_count}/${res.total_count} test cases.`, 'success');
        } else {
          addToast(`${res.status}: Passed ${res.passed_count}/${res.total_count} test cases.`, 'warning');
        }
      } catch (e) {
        addToast('Submission failed.', 'error');
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
                      <>This question was asked in <strong>{matchData.best_match.company} {matchData.best_match.exam} ({matchData.best_match.year})</strong>.</>
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
                  Isolated Secure Execution Sandbox
                </span>
              </div>
              <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem', color: 'var(--color-forest)', margin: 0, lineHeight: 1.1 }}>
                Coding & Skill Practice Arena
              </h1>
            </div>

            {/* Filter Dropdowns */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-forest)' }}>Skill:</span>
                <select
                  value={selectedSkill}
                  onChange={(e) => setSelectedSkill(e.target.value)}
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
                  {SKILL_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-forest)' }}>Difficulty:</span>
                <select
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
                      </div>

                      {problems.length > 1 && (
                        <select
                          value={currentProblem.slug}
                          onChange={(e) => handleSelectProblem(e.target.value)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border-medium)',
                            backgroundColor: 'var(--color-ivory-soft)',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: 'var(--color-forest)',
                            cursor: 'pointer',
                          }}
                        >
                          {problems.map((p) => (
                            <option key={p.id} value={p.slug}>
                              {p.title} ({p.difficulty})
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
                            <div><strong>Input:</strong> {ex.input}</div>
                            <div><strong>Output:</strong> {ex.output}</div>
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

                {/* Right Panel: Code Editor IDE */}
                <div
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
                        <option value="python">Python 3</option>
                        <option value="java">Java 21</option>
                        <option value="c">C (GCC)</option>
                        <option value="cpp">C++ (G++)</option>
                        <option value="javascript">JavaScript (Node.js)</option>
                      </select>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Button variant="lime" size="sm" onClick={handleRunCode} disabled={running || submitting}>
                          {running ? 'Running...' : 'Run Code ▶'}
                        </Button>
                        <Button variant="primary" size="sm" onClick={handleSubmit} disabled={running || submitting}>
                          {submitting ? 'Evaluating...' : 'Submit'}
                        </Button>
                      </div>
                    </div>

                    {/* Code Editor Textarea */}
                    <textarea
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
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
                              <span style={{ fontSize: '0.75rem', color: 'rgba(244, 240, 231, 0.5)' }}>
                                {executionResult.runtime_ms} ms | {executionResult.memory_kb} KB
                              </span>
                            </div>

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
                              !executionResult.stderr && !executionResult.compile_output && (
                                <div style={{ color: 'rgba(244, 240, 231, 0.5)' }}>[No stdout produced]</div>
                              )
                            )}
                          </div>
                        ) : (
                          <div style={{ color: 'rgba(244, 240, 231, 0.4)', fontStyle: 'italic' }}>
                            Click "Run Code" or "Submit" to execute solution in secure sandbox.
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
                            Click "Submit" to evaluate solution against all public and hidden test cases.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab 3: Custom Stdin */}
                    {outputTab === 'stdin' && (
                      <textarea
                        value={customStdin}
                        onChange={(e) => setCustomStdin(e.target.value)}
                        placeholder="Provide custom stdin data to feed into your program..."
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
