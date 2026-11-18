import React from 'react';
import { MAX_CUSTOM_CASES } from '../../utils/practiceHelpers';

// "Testcase" tab: Case 1..n (the shown examples, editable) and "+" for your own cases. Each case has one named input per parameter.
// An edited example, or a new case, is run as a custom case: it has no expected value to compare with.
export const TestcasePanel = ({ problem, cases, active, errors, outcomes, onSelect, onChange, onAdd, onRemove, exampleCount }) => {
  const current = cases[active] || cases[0];
  const customCount = cases.filter((c) => c.custom).length;
  const caseErrors = (current && errors[current.id]) || {};

  return (
    <div data-testid="pa-testcase-tab">
      <div className="pa-chips" role="group" aria-label="Test cases">
        {cases.map((c, i) => {
          const outcome = outcomes[c.id];
          const cls = outcome === 'pass' ? 'pass' : outcome === 'fail' ? 'fail' : outcome === 'warn' ? 'warn' : '';
          return (
            <button key={c.id} type="button" className={`pa-chip ${cls}`} aria-pressed={i === active} data-testid={`pa-case-${i + 1}`} onClick={() => onSelect(i)}>
              Case {i + 1}
            </button>
          );
        })}
        <button
          type="button" className="pa-chip" data-testid="pa-add-case" onClick={onAdd} disabled={customCount >= MAX_CUSTOM_CASES}
          aria-label="Add a custom test case" title={customCount >= MAX_CUSTOM_CASES ? `At most ${MAX_CUSTOM_CASES} custom cases` : 'Add a custom test case'}
        >
          +
        </button>
      </div>

      {current && (
        <div>
          {current.custom && current.id !== undefined && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 0.6rem', fontSize: '0.75rem', color: 'var(--on-dark-muted)' }}>
              <span>Custom case: it runs, but there is no expected value to compare with.</span>
              <button type="button" className="pa-chip" onClick={() => onRemove(active)} aria-label="Remove this case">Remove</button>
            </div>
          )}
          {!current.custom && current.edited && (
            <div style={{ margin: '0 0 0.6rem', fontSize: '0.75rem', color: 'var(--on-dark-warning)' }}>Edited: this example now runs as a custom case (no expected value).</div>
          )}
          {problem.params.map((p) => (
            <div className="pa-field" key={p.name}>
              <label htmlFor={`pa-input-${current.id}-${p.name}`}>{p.name} =<small>{p.type}</small></label>
              <textarea
                id={`pa-input-${current.id}-${p.name}`} data-testid={`pa-input-${p.name}`} rows={p.type.endsWith('[]') ? 2 : 1} spellCheck={false}
                value={current.values[p.name] ?? ''} aria-invalid={Boolean(caseErrors[p.name])} aria-describedby={caseErrors[p.name] ? `pa-err-${current.id}-${p.name}` : undefined}
                onChange={(e) => onChange(active, p.name, e.target.value)}
              />
              {caseErrors[p.name] && <div className="pa-field-error" id={`pa-err-${current.id}-${p.name}`} role="alert">{caseErrors[p.name]}</div>}
            </div>
          ))}
          {caseErrors._ && <div className="pa-field-error" role="alert">{caseErrors._}</div>}
          {exampleCount > 0 && !current.custom && !current.edited && (
            <div style={{ fontSize: '0.72rem', color: 'var(--on-dark-faint)' }}>Edit any value to try your own input.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default TestcasePanel;
