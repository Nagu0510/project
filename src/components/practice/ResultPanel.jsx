import React, { useEffect, useState } from 'react';
import { formatMemory } from '../../utils/practiceHelpers';

const Block = ({ label, children, error = false, testId }) => (
  <div className="pa-block" data-testid={testId}>
    <span className="pa-label">{label}</span>
    <pre className={`pa-pre${error ? ' error' : ''}`}>{children}</pre>
  </div>
);

const Stats = ({ result }) => (
  <div className="pa-stats">
    {result.runtimeMs >= 0 && <span data-testid="pa-runtime">Runtime: {result.runtimeMs} ms</span>}
    {formatMemory(result.memoryKb) && <span data-testid="pa-memory">Memory: {formatMemory(result.memoryKb)}</span>}
    {result.expectedComplexity && <span data-testid="pa-expected-complexity">Expected: {result.expectedComplexity}</span>}
  </div>
);

const CompileBlock = ({ text }) => (text ? <Block label="Compiler / interpreter message" error testId="pa-compile-output">{text}</Block> : null);

// "Test Result" tab: Run (a Passed/Failed badge per case) or Submit (a verdict banner), a running state, or a failed request.
export const ResultPanel = ({ running, result, problem, onNext, hasNext }) => {
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    if (result?.kind !== 'run') return;
    const firstFailing = result.cases.findIndex((c) => c.passed === false);
    setSelected(firstFailing >= 0 ? firstFailing : 0);
  }, [result]);

  if (running) {
    return (
      <div data-testid="pa-running" role="status" aria-live="polite">
        <span className="pa-spinner" aria-hidden="true" />
        {running.kind === 'submit' ? 'Judging' : 'Running'} case {running.current} of {running.total}…
      </div>
    );
  }

  if (!result) {
    return <div style={{ color: 'var(--on-dark-faint)', fontStyle: 'italic' }}>Run your code to try it on the examples, or Submit to judge it on every test case.</div>;
  }

  if (result.kind === 'error') {
    return (
      <div className={`pa-banner ${result.tone}`} role="alert" data-testid="pa-notice">
        <div className="pa-verdict" style={{ fontSize: '1rem' }}>{result.title}</div>
        <div style={{ marginTop: '2px', whiteSpace: 'pre-wrap' }}>{result.message}</div>
      </div>
    );
  }

  if (result.kind === 'submit') {
    const detail = result.failedDetail;
    const accepted = result.status === 'Accepted';
    const judged = !['Judge unavailable', 'Compile Error'].includes(result.status);
    return (
      <div data-testid="pa-verdict" data-verdict={result.status}>
        <div className={`pa-banner ${result.tone}`}>
          <div className="pa-verdict" data-testid="pa-result-status">{result.status === 'Judge unavailable' ? 'Online compiler is busy' : result.status}</div>
          {judged && <div data-testid="pa-passed" style={{ marginTop: '2px' }}>Passed {result.passedCount} of {result.totalCount} test cases</div>}
          {judged && <Stats result={result} />}
          {result.message && result.status !== 'Compile Error' && <div data-testid="pa-message" style={{ marginTop: '6px', color: 'var(--on-dark-muted)' }}>{result.message}</div>}
          {result.status === 'Judge unavailable' && <div style={{ marginTop: '4px' }}>Your code was not judged and nothing was recorded. Try again in a moment.</div>}
          {accepted && hasNext && (
            <button type="button" className="pa-iconbtn" style={{ marginTop: '0.7rem' }} data-testid="pa-next-problem" onClick={onNext}>Next problem →</button>
          )}
        </div>
        <CompileBlock text={result.compileOutput} />
        {detail && (
          <div data-testid="pa-failed-detail">
            <div style={{ fontWeight: 700, marginBottom: '2px' }}>Failed on test case {detail.case}</div>
            <Block label="Input">{detail.input}</Block>
            <Block label="Your output">{detail.yourOutput ?? '(no output)'}</Block>
            <Block label="Expected">{detail.expected}</Block>
            {detail.error && <Block label="Error" error>{detail.error}</Block>}
            {result.stdout && <Block label="Stdout">{result.stdout}</Block>}
          </div>
        )}
        {!detail && result.failedCase && result.status !== 'Compile Error' && (
          <div data-testid="pa-hidden-failure" style={{ color: 'var(--on-dark-muted)' }}>
            Test case {result.failedCase} is a hidden case, so its input and expected output are not shown. Try other inputs of your own in the Testcase tab.
          </div>
        )}
      </div>
    );
  }

  // run
  const current = result.cases[selected];
  const tone = result.tone;
  return (
    <div data-testid="pa-run-result" data-verdict={result.status}>
      <div className={`pa-banner ${tone}`}>
        <div className="pa-verdict" data-testid="pa-result-status">{result.status}</div>
        {result.cases.length > 0 && (
          <div style={{ marginTop: '2px' }}>
            {result.judgedCount > 0 ? `${result.passedCount} of ${result.judgedCount} examples passed` : 'Custom cases only: nothing to compare with'}
          </div>
        )}
        {result.message && result.status !== 'Compile Error' && <div style={{ marginTop: '4px', color: 'var(--on-dark-muted)' }}>{result.message}</div>}
        {result.cases.length > 0 && <Stats result={result} />}
      </div>
      <CompileBlock text={result.compileOutput} />
      {result.cases.length > 0 && (
        <>
          <div className="pa-chips" role="tablist" aria-label="Case results">
            {result.cases.map((c, i) => (
              <button
                key={c.index} type="button" role="tab" aria-selected={i === selected} aria-pressed={i === selected} data-testid={`pa-result-case-${i + 1}`} data-status={c.status}
                className={`pa-chip ${c.passed === true ? 'pass' : c.passed === false ? 'fail' : 'warn'}`} onClick={() => setSelected(i)}
              >
                {c.passed === true ? '✓' : c.passed === false ? '✗' : '•'} Case {i + 1}
              </button>
            ))}
          </div>
          {current && (
            <div data-testid="pa-case-detail">
              <div style={{ fontWeight: 700, color: current.passed === true ? 'var(--on-dark-success)' : current.passed === false ? 'var(--on-dark-danger)' : 'var(--on-dark-warning)' }} data-testid="pa-case-status">
                {current.passed === true ? 'Passed' : current.passed === false ? 'Failed' : current.status}
                {current.passed === false && current.status !== 'Wrong Answer' ? ` (${current.status})` : ''}
                <span style={{ fontWeight: 500, color: 'var(--on-dark-muted)', marginLeft: '8px' }}>{current.runtimeMs} ms</span>
              </div>
              <Block label="Input">{current.input}</Block>
              {current.error ? <Block label={current.error === 'Your function returned nothing' ? 'Result' : 'Error'} error testId="pa-case-error">{current.error}</Block> : (
                current.yourOutput !== null && <Block label="Output" testId="pa-case-output">{current.yourOutput}</Block>
              )}
              {current.expected !== null && <Block label="Expected">{current.expected}</Block>}
              {current.stdout && <Block label="Stdout" testId="pa-case-stdout">{current.stdout}</Block>}
            </div>
          )}
        </>
      )}
      {problem?.timeLimitMs > 0 && result.status === 'Time Limit Exceeded' && (
        <div style={{ marginTop: '0.5rem', color: 'var(--on-dark-muted)' }}>The limit is {problem.timeLimitMs} ms per test case. Look for a slow loop or a better approach.</div>
      )}
    </div>
  );
};

export default ResultPanel;
