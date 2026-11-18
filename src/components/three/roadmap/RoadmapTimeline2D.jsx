import React from 'react';
import { Check, Lock } from 'lucide-react';
import { milestoneState, stateColors } from './ribbonLayout';
import { useTheme } from '../../../context/ThemeContext';

// The flat version of the ribbon: the same milestones, in order, with the same colours and the same click behaviour. Shown when WebGL is
// not available (or cannot be restored): no 3D code is loaded and nothing is logged to the console.
export const RoadmapTimeline2D = ({ milestones, currentNumber, selectedId, onSelect, emptyMessage }) => {
  const colors = stateColors(useTheme().resolvedTheme);
  return (
  <div className="rm2d" data-testid="roadmap-2d" style={{ height: '100%', overflowY: 'auto', padding: '1rem 1.25rem 1.25rem', color: 'var(--text)', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-xl)' }}>
    {milestones.length === 0 ? (
      <p style={{ margin: '2rem 0', textAlign: 'center', color: 'var(--text-muted)' }}>{emptyMessage}</p>
    ) : (
      <ol style={{ listStyle: 'none', margin: 0, padding: 0 }} className="rm2d-list">
        {milestones.map((ms) => {
          const state = milestoneState(ms, currentNumber);
          const look = colors[state];
          return (
            <li key={ms.id} className="rm2d-item" data-state={state} data-selected={ms.id === selectedId} data-testid="roadmap-2d-item">
              <button type="button" onClick={() => onSelect?.(ms.id)} aria-label={`Milestone ${ms.number}: ${ms.title}, ${look.label}`} data-title={ms.title}>
                <span className="rm2d-dot" style={{ background: look.node, boxShadow: `0 0 0 3px ${look.emissive}` }}>
                  {state === 'completed' ? <Check size={12} color={look.onNode} /> : state === 'locked' ? <Lock size={11} color={look.onNode} /> : <b style={{ fontSize: '0.68rem', color: look.onNode }}>{ms.number}</b>}
                </span>
                <span className="rm2d-text">
                  <span className="rm2d-title">{ms.title}</span>
                  <span className="rm2d-state" style={{ background: look.chip, color: look.text }}>{look.label}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    )}
    <style>{`
      .rm2d-list { column-count: 2; column-gap: 2rem; }
      .rm2d-item { break-inside: avoid; position: relative; padding: 0 0 0.35rem 0; }
      .rm2d-item::before { content: ''; position: absolute; left: 16px; top: 34px; bottom: -2px; width: 2px; background: var(--border-strong); }
      .rm2d-item:last-child::before { display: none; }
      .rm2d-item button { display: flex; align-items: center; gap: 0.75rem; width: 100%; min-height: 44px; padding: 4px 8px 4px 0; border: 0; border-radius: 10px; background: none; color: inherit; cursor: pointer; text-align: left; font: inherit; }
      .rm2d-item button:hover { background: var(--accent-soft); }
      .rm2d-item button:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
      .rm2d-item[data-selected='true'] button { background: var(--accent-soft-strong); }
      .rm2d-dot { width: 32px; height: 32px; flex: 0 0 32px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; }
      .rm2d-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
      .rm2d-title { font-weight: 700; font-size: 0.9rem; color: var(--text); }
      .rm2d-state { align-self: flex-start; font-size: 0.68rem; font-weight: 700; padding: 1px 7px; border-radius: 99px; }
      @media (max-width: 768px) { .rm2d-list { column-count: 1; } }
    `}</style>
  </div>
  );
};

export default RoadmapTimeline2D;
