import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ListChecks, Play, RotateCcw, Send, Settings2 } from 'lucide-react';
import { Sidebar } from '../components/common/Sidebar';
import { Navbar } from '../components/common/Navbar';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import { LoadingState } from '../components/common/LoadingState';
import { CodeEditor } from '../components/practice/CodeEditor';
import { ProblemDescription } from '../components/practice/ProblemDescription';
import { HintsPanel } from '../components/practice/HintsPanel';
import { SubmissionsPanel } from '../components/practice/SubmissionsPanel';
import { TestcasePanel } from '../components/practice/TestcasePanel';
import { ResultPanel } from '../components/practice/ResultPanel';
import { ProblemListDrawer } from '../components/practice/ProblemListDrawer';
import '../components/practice/practice.css';
import { practiceService } from '../services/practiceService';
import { DailyChallengeCard } from '../components/practice/DailyChallengeCard';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  caseErrorsFromApi,
  clearDraft,
  explainExecutionError,
  formatCaseText,
  initialCode,
  languageChoices,
  loadEditorSettings,
  MAX_CUSTOM_CASES,
  neighbour,
  saveDraft,
  saveEditorSettings,
  validateCase,
  valuesFromArgs,
} from '../utils/practiceHelpers';

const LANGUAGE_KEY = 'skillsense.practice.language';
const PANE_KEY = 'skillsense.practice.panes';

const rememberedLanguage = () => {
  try { return localStorage.getItem(LANGUAGE_KEY) || 'python'; } catch { return 'python'; }
};
const rememberedPanes = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(PANE_KEY) || 'null');
    return { left: Math.min(70, Math.max(25, Number(raw?.left) || 42)), console: Math.min(520, Math.max(120, Number(raw?.console) || 260)) };
  } catch { return { left: 42, console: 260 }; }
};

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

const buildCases = (problem) => problem.exampleArgs.map((args, i) => {
  const values = valuesFromArgs(problem.params, args);
  return { id: `ex${i}`, custom: false, edited: false, base: values, values };
});

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
  const [matchData, setMatchData] = useState(null);

  const [language, setLanguage] = useState(rememberedLanguage);
  const [code, setCode] = useState('');
  const [settings, setSettings] = useState(loadEditorSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [listOpen, setListOpen] = useState(false);

  const [leftTab, setLeftTab] = useState('description');
  const [consoleTab, setConsoleTab] = useState('testcase');
  const [mobileTab, setMobileTab] = useState('description');
  const [cases, setCases] = useState([]);
  const [activeCase, setActiveCase] = useState(0);
  const [caseErrors, setCaseErrors] = useState({});
  const [result, setResult] = useState(null);
  const [resultCode, setResultCode] = useState(null);
  const [running, setRunning] = useState(null); // { kind, total, current }
  const [submissionsKey, setSubmissionsKey] = useState(0);
  const [panes, setPanes] = useState(rememberedPanes);

  const splitRef = useRef(null);
  const rightRef = useRef(null);
  const customCounter = useRef(0);

  const currentProblem = problems.find((p) => p.slug === requestedSlug || p.id === requestedSlug) || problems[0] || null;
  const unknownRequested = Boolean(requestedSlug) && problems.length > 0 && !problems.some((p) => p.slug === requestedSlug || p.id === requestedSlug);
  const slug = currentProblem?.slug;
  const choices = useMemo(() => languageChoices(currentProblem), [currentProblem]);

  // The catalogue comes from the API only; there is no built-in list to fall back to.
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

  const refreshSolved = useCallback(() => {
    if (!isStudent) { setSolved([]); return; }
    practiceService.getSolved().then(setSolved).catch(() => setSolved([]));
  }, [isStudent]);
  useEffect(refreshSolved, [refreshSolved]);

  // C is greyed out for a problem whose types do not fit: fall back to Python
  const effectiveLanguage = choices.find((c) => c.value === language && !c.disabled) ? language : 'python';

  // A new problem or language: the student's remembered code, else the generated starter
  useEffect(() => {
    if (!currentProblem) return;
    setCode(initialCode(currentProblem, effectiveLanguage));
    setResult(null);
    setResultCode(null);
  }, [slug, effectiveLanguage]); // eslint-disable-line react-hooks/exhaustive-deps

  // A new problem: its examples are the first cases; hints / submissions / results start fresh
  useEffect(() => {
    if (!currentProblem) return undefined;
    setCases(buildCases(currentProblem));
    setActiveCase(0);
    setCaseErrors({});
    setLeftTab('description');
    setConsoleTab('testcase');
    setMobileTab('description');
    setRunning(null);
    let alive = true;
    practiceService
      .matchQuestionIntelligence(currentProblem.id, `${currentProblem.title} ${currentProblem.description}`)
      .then((match) => { if (alive) setMatchData(match && match.matched ? match : null); });
    return () => { alive = false; };
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Running case n of N": the cases run in one execution, so this counter only paces the wait
  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => setRunning((r) => (r && r.current < r.total ? { ...r, current: r.current + 1 } : r)), 900);
    return () => clearInterval(timer);
  }, [running?.kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCodeChange = (value) => {
    setCode(value);
    if (slug) saveDraft(slug, effectiveLanguage, value);
  };

  const changeLanguage = (value) => {
    setLanguage(value);
    try { localStorage.setItem(LANGUAGE_KEY, value); } catch { /* not remembered */ }
  };

  const selectProblem = (next) => setSearchParams({ problem: next });

  // ---- test cases -------------------------------------------------------------------------------------------
  const updateCase = (index, name, value) => {
    setCases((list) => list.map((c, i) => {
      if (i !== index) return c;
      const values = { ...c.values, [name]: value };
      return { ...c, values, edited: !c.custom && JSON.stringify(values) !== JSON.stringify(c.base) };
    }));
    setCaseErrors((errs) => {
      const id = cases[index]?.id;
      if (!id || !errs[id]) return errs;
      const { [name]: _gone, ...rest } = errs[id];
      return { ...errs, [id]: rest };
    });
  };

  const addCase = () => {
    if (cases.filter((c) => c.custom).length >= MAX_CUSTOM_CASES) return;
    customCounter.current += 1;
    const source = cases[activeCase] || cases[0];
    setCases((list) => [...list, { id: `custom${customCounter.current}`, custom: true, edited: false, base: source.values, values: { ...source.values } }]);
    setActiveCase(cases.length);
    setConsoleTab('testcase');
  };

  const removeCase = (index) => {
    setCases((list) => list.filter((_, i) => i !== index));
    setActiveCase((a) => Math.max(0, Math.min(a, cases.length - 2)));
  };

  // ---- running and judging ------------------------------------------------------------------------------------
  const finishWithError = (err) => {
    setResult({ kind: 'error', ...explainExecutionError(err) });
    setResultCode(null);
    setConsoleTab('result');
    setMobileTab('result');
  };

  const handleRun = () => {
    if (running || !currentProblem) return;
    requireAuth(async () => {
      const errors = {};
      cases.forEach((c) => {
        const problems = validateCase(currentProblem.params, c.values);
        if (Object.keys(problems).length) errors[c.id] = problems;
      });
      if (Object.keys(errors).length) {
        setCaseErrors(errors);
        setActiveCase(Math.max(0, cases.findIndex((c) => errors[c.id])));
        setConsoleTab('testcase');
        setMobileTab('result');
        return;
      }
      setCaseErrors({});
      setRunning({ kind: 'run', total: cases.length, current: 1 });
      setConsoleTab('result');
      setMobileTab('result');
      try {
        const res = await practiceService.runCode(slug, effectiveLanguage, code, cases.map((c) => formatCaseText(currentProblem.params, c.values)));
        setResult(res);
        setResultCode(code);
      } catch (err) {
        if (err?.status === 422 && err.detail && typeof err.detail === 'object') {
          const mapped = caseErrorsFromApi(err.detail);
          const byId = {};
          Object.entries(mapped).forEach(([n, fieldErrors]) => { const c = cases[Number(n) - 1]; if (c) byId[c.id] = fieldErrors; });
          setCaseErrors(byId);
          setConsoleTab('testcase');
        }
        finishWithError(err);
      } finally {
        setRunning(null);
      }
    }, '/practice');
  };

  const handleSubmit = () => {
    if (running || !currentProblem) return;
    requireAuth(async () => {
      setRunning({ kind: 'submit', total: currentProblem.totalCases || 1, current: 1 });
      setConsoleTab('result');
      setMobileTab('result');
      try {
        const res = await practiceService.submitCode(slug, effectiveLanguage, code);
        setResult(res);
        setResultCode(code);
        if (res.status === 'Accepted') { refreshSolved(); addToast('Accepted! Every test case passed.', 'success'); }
        if (res.status !== 'Judge unavailable') setSubmissionsKey((k) => k + 1);
      } catch (err) {
        finishWithError(err);
      } finally {
        setRunning(null);
      }
    }, '/practice');
  };

  // Chip colours on the Testcase tab come from the last run
  const outcomes = useMemo(() => {
    const map = {};
    if (result?.kind === 'run' && result.cases.length === cases.length) {
      result.cases.forEach((c, i) => { map[cases[i].id] = c.passed === true ? 'pass' : c.passed === false ? 'fail' : 'warn'; });
    }
    return map;
  }, [result, cases]);

  const errorLines = result && resultCode === code && result.kind !== 'error' ? result.errorLines : [];

  // ---- panes -----------------------------------------------------------------------------------------------------
  const savePanes = (next) => {
    setPanes(next);
    try { localStorage.setItem(PANE_KEY, JSON.stringify(next)); } catch { /* not remembered */ }
  };
  const dragColumn = (e) => {
    const rect = splitRef.current?.getBoundingClientRect();
    if (rect) setPanes((p) => ({ ...p, left: clamp(((e.clientX - rect.left) / rect.width) * 100, 25, 70) }));
  };
  const dragRow = (e) => {
    const rect = rightRef.current?.getBoundingClientRect();
    if (rect) setPanes((p) => ({ ...p, console: clamp(rect.bottom - e.clientY - 6, 120, Math.max(160, rect.height - 200)) }));
  };
  const startDrag = (move) => (e) => {
    e.preventDefault();
    const target = e.currentTarget;
    target.setPointerCapture?.(e.pointerId);
    target.classList.add('dragging');
    const up = () => {
      target.classList.remove('dragging');
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      setPanes((p) => { savePanes(p); return p; });
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
  };
  const keyResize = (axis) => (e) => {
    const step = { ArrowLeft: -3, ArrowUp: 24, ArrowRight: 3, ArrowDown: -24 }[e.key];
    if (step === undefined || (axis === 'col') === (e.key === 'ArrowUp' || e.key === 'ArrowDown')) return;
    e.preventDefault();
    savePanes(axis === 'col' ? { ...panes, left: clamp(panes.left + step, 25, 70) } : { ...panes, console: clamp(panes.console + step, 120, 520) });
  };

  const updateSettings = (patch) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveEditorSettings(next);
  };

  const resetToStarter = () => {
    clearDraft(slug, effectiveLanguage);
    setCode(currentProblem.starterCode?.[effectiveLanguage] ?? '');
    setResult(null);
    setConfirmReset(false);
    addToast('Starter code restored.', 'success');
  };

  const loadSubmission = (s) => {
    const known = choices.find((c) => c.value === s.language && !c.disabled);
    if (known) changeLanguage(s.language);
    setCode(s.code);
    saveDraft(slug, known ? s.language : effectiveLanguage, s.code);
    setMobileTab('code');
    addToast('Submitted code loaded into the editor.', 'success');
  };

  const nextProblem = currentProblem ? neighbour(problems, slug, 1) : null;
  const prevProblem = currentProblem ? neighbour(problems, slug, -1) : null;

  return (
    <div className={isAuthenticated ? 'dashboard-layout' : ''} style={{ minHeight: '100vh', backgroundColor: 'var(--bg)' }}>
      {isAuthenticated ? <Sidebar /> : <Navbar />}

      <main className={isAuthenticated ? 'dashboard-main' : 'container-custom'} style={{ padding: isAuthenticated ? undefined : '2rem 1.5rem 2rem' }}>
        <div className="dashboard-content animate-fade-in" style={{ padding: isAuthenticated ? undefined : 0, maxWidth: '1500px', margin: '0 auto', width: '100%' }}>
          {loading && <LoadingState message="Loading coding problems..." subtitle="One moment" />}
          {!loading && error && (
            <EmptyState title="Problems could not be loaded" description="The problem catalog is unavailable right now. Check your connection and try again." actionText="Try again" onAction={() => setReloadKey((k) => k + 1)} />
          )}
          {!loading && !error && !currentProblem && (
            <EmptyState title="No coding problems yet" description="The problem bank is empty. Problems appear here once they have been loaded into the database." />
          )}
          {unknownRequested && (
            <div role="status" data-testid="unknown-problem" style={{ marginBottom: '0.75rem', padding: '0.6rem 1rem', borderRadius: 'var(--radius-md)', background: 'var(--warning-soft)', border: '1px solid var(--warning-border)', fontSize: '0.875rem', color: 'var(--text)' }}>
              The problem "{requestedSlug}" is not available. Showing "{currentProblem?.title}" instead.
            </div>
          )}

          {!loading && currentProblem && (
            <div className="pa-root" data-testid="practice-arena" data-mobile-tab={mobileTab} style={isAuthenticated ? undefined : { height: 'calc(100vh - 7rem)' }}>
              {/* top bar */}
              <div className="pa-topbar">
                <button type="button" className="pa-iconbtn" data-testid="pa-problem-list" onClick={() => setListOpen(true)}><ListChecks size={16} aria-hidden="true" /> Problems</button>
                <button type="button" className="pa-iconbtn" aria-label="Previous problem" data-testid="pa-prev" disabled={!prevProblem} onClick={() => prevProblem && selectProblem(prevProblem.slug)}><ChevronLeft size={16} /></button>
                <button type="button" className="pa-iconbtn" aria-label="Next problem" data-testid="pa-next" disabled={!nextProblem} onClick={() => nextProblem && selectProblem(nextProblem.slug)}><ChevronRight size={16} /></button>
                <div className="pa-brand"><small>Practice Arena</small>{currentProblem.title}</div>
                <DailyChallengeCard variant="chip" onSolve={selectProblem} />
                <div className="pa-spacer" />
                <div className="pa-lang" title={!currentProblem.cAvailable ? currentProblem.cDisabledReason : undefined}>
                  <select aria-label="Language" data-testid="pa-language" value={effectiveLanguage} onChange={(e) => changeLanguage(e.target.value)}>
                    {choices.map((c) => <option key={c.value} value={c.value} disabled={c.disabled} title={c.reason || undefined}>{c.label}</option>)}
                  </select>
                </div>
                <div style={{ position: 'relative' }}>
                  <button type="button" className="pa-iconbtn" aria-label="Editor settings" aria-expanded={settingsOpen} data-testid="pa-settings" onClick={() => setSettingsOpen((o) => !o)}><Settings2 size={16} /></button>
                  {settingsOpen && (
                    <div className="pa-menu" role="dialog" aria-label="Editor settings">
                      <label>Font size
                        <select value={settings.fontSize} onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })} data-testid="pa-font-size">
                          {[12, 13, 14, 15, 16, 18, 20].map((n) => <option key={n} value={n}>{n}px</option>)}
                        </select>
                      </label>
                      <label>Tab size
                        <select value={settings.tabSize} onChange={(e) => updateSettings({ tabSize: Number(e.target.value) })} data-testid="pa-tab-size">
                          {[2, 4, 8].map((n) => <option key={n} value={n}>{n} spaces</option>)}
                        </select>
                      </label>
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Ctrl+Enter runs, Ctrl+Shift+Enter submits.</div>
                    </div>
                  )}
                </div>
                <Button variant="lime" size="sm" data-testid="pa-run" onClick={handleRun} disabled={Boolean(running)} title="Ctrl+Enter"><Play size={14} aria-hidden="true" /> Run</Button>
                <Button variant="primary" size="sm" data-testid="pa-submit" onClick={handleSubmit} disabled={Boolean(running)} title="Ctrl+Shift+Enter"><Send size={14} aria-hidden="true" /> Submit</Button>
              </div>

              <div className="pa-mobile-tabs" role="tablist" aria-label="Sections">
                {[['description', 'Description'], ['code', 'Code'], ['result', 'Result']].map(([key, label]) => (
                  <button key={key} type="button" role="tab" aria-selected={mobileTab === key} data-testid={`pa-mobile-${key}`} onClick={() => setMobileTab(key)}>{label}</button>
                ))}
              </div>

              <div className="pa-split" ref={splitRef}>
                {/* left: description / hints / submissions */}
                <section className="pa-pane pa-left" style={{ width: `${panes.left}%`, flex: '0 0 auto' }} aria-label="Problem">
                  <div className="pa-tabs" role="tablist" aria-label="Problem sections">
                    {[['description', 'Description'], ['hints', 'Hints'], ['submissions', 'Submissions']].map(([key, label]) => (
                      <button key={key} type="button" role="tab" className="pa-tab" aria-selected={leftTab === key} data-testid={`pa-tab-${key}`} onClick={() => setLeftTab(key)}>{label}</button>
                    ))}
                  </div>
                  <div className="pa-tabbody">
                    {leftTab === 'description' && <ProblemDescription problem={currentProblem} solved={solved.includes(slug)} matchData={matchData} />}
                    {leftTab === 'hints' && <HintsPanel slug={slug} hintCount={currentProblem.hintCount} authenticated={isAuthenticated} />}
                    {leftTab === 'submissions' && <SubmissionsPanel slug={slug} authenticated={isAuthenticated} refreshKey={submissionsKey} onLoad={loadSubmission} />}
                  </div>
                </section>

                <div
                  className="pa-handle" role="separator" aria-orientation="vertical" aria-label="Resize the problem and code panes" aria-valuenow={Math.round(panes.left)} aria-valuemin={25} aria-valuemax={70}
                  tabIndex={0} data-testid="pa-resize-columns" onPointerDown={startDrag(dragColumn)} onKeyDown={keyResize('col')}
                />

                {/* right: editor on top, console below */}
                <section className="pa-pane pa-right" ref={rightRef} aria-label="Code">
                  <div className="pa-editor-wrap">
                    <div className="pa-editor-bar">
                      <span>{currentProblem.functionName} · {effectiveLanguage}</span>
                      <button type="button" className="pa-iconbtn" data-testid="pa-reset" onClick={() => setConfirmReset(true)}><RotateCcw size={13} aria-hidden="true" /> Reset to starter code</button>
                    </div>
                    {!isAuthenticated && (
                      <div data-testid="signin-hint" style={{ margin: '0 0 0.5rem', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--on-dark-lime-soft)', border: '1px solid var(--pa-accent)', color: 'var(--pa-text)', fontSize: '0.78rem' }}>
                        You need to be signed in to run or submit code.{' '}
                        <Link to="/login" style={{ color: 'var(--pa-accent)', fontWeight: 700, textDecoration: 'underline' }}>Sign in</Link> or <Link to="/signup" style={{ color: 'var(--pa-accent)', fontWeight: 700, textDecoration: 'underline' }}>create a free account</Link>.
                      </div>
                    )}
                    <div className="pa-editor-host">
                      <CodeEditor
                        value={code} onChange={handleCodeChange} language={effectiveLanguage} fontSize={settings.fontSize} tabSize={settings.tabSize}
                        errorLines={errorLines} onRun={handleRun} onSubmit={handleSubmit}
                      />
                    </div>
                  </div>

                  <div
                    className="pa-handle-h" role="separator" aria-orientation="horizontal" aria-label="Resize the editor and console" tabIndex={0} data-testid="pa-resize-rows"
                    onPointerDown={startDrag(dragRow)} onKeyDown={keyResize('row')}
                  />

                  <div className="pa-console" style={{ height: `${panes.console}px` }} data-testid="pa-console">
                    <div className="pa-tabs" role="tablist" aria-label="Console">
                      <button type="button" role="tab" className="pa-tab" aria-selected={consoleTab === 'testcase'} data-testid="pa-tab-testcase" onClick={() => setConsoleTab('testcase')}>Testcase</button>
                      <button type="button" role="tab" className="pa-tab" aria-selected={consoleTab === 'result'} data-testid="pa-tab-result" onClick={() => setConsoleTab('result')}>Test Result</button>
                    </div>
                    <div className="pa-console-body">
                      {consoleTab === 'testcase' ? (
                        <TestcasePanel
                          problem={currentProblem} cases={cases} active={activeCase} errors={caseErrors} outcomes={outcomes} exampleCount={currentProblem.exampleArgs.length}
                          onSelect={setActiveCase} onChange={updateCase} onAdd={addCase} onRemove={removeCase}
                        />
                      ) : (
                        <ResultPanel running={running} result={result} problem={currentProblem} hasNext={Boolean(nextProblem)} onNext={() => nextProblem && selectProblem(nextProblem.slug)} />
                      )}
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      </main>

      <ProblemListDrawer open={listOpen} onClose={() => setListOpen(false)} problems={problems} solved={solved} currentSlug={slug} onSelect={selectProblem} />

      <Modal isOpen={confirmReset} onClose={() => setConfirmReset(false)} title="Reset to starter code?" subtitle="Your current code for this problem and language will be replaced." maxWidth="440px">
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <Button variant="outline" size="sm" onClick={() => setConfirmReset(false)} data-testid="pa-reset-cancel">Keep my code</Button>
          <Button variant="danger" size="sm" onClick={resetToStarter} data-testid="pa-reset-confirm">Reset</Button>
        </div>
      </Modal>
    </div>
  );
};

export default CodingPracticePage;
