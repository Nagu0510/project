import React, { Suspense, useEffect, useRef, useState } from 'react';
import { detectWebGL, prefersReducedMotion } from './engine/webgl';

class SceneBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch() { this.props.onFail?.(); } // a chunk that did not load, or a scene that threw: the panel shows its 2D version

  render() { return this.state.failed ? null : this.props.children; }
}

/**
 * Hosts a lazily loaded Three.js scene and decides when it may exist:
 *   - no WebGL (checked before anything is downloaded) or a failed scene: the 2D `fallback` is shown, with no console error
 *   - the scene is only mounted once the panel has been on screen, and it is told to pause whenever the panel leaves the screen
 *   - webglcontextlost: "Restoring 3D view..." and, if it has not come back after 3 s, a "Reload 3D view" button that builds a new renderer
 * `Scene` is a React.lazy component receiving { ...sceneProps, active, reducedMotion, onStatus }.
 */
export const ThreePanel = ({ Scene, sceneProps, fallback, testId, label, height = 460, mobileHeight = 520, className = '' }) => {
  const box = useRef(null);
  const [webgl] = useState(detectWebGL);
  const [reduced] = useState(prefersReducedMotion);
  const [everVisible, setEverVisible] = useState(false);
  const [inView, setInView] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [status, setStatus] = useState('loading'); // loading | ready | lost | failed
  const [showReload, setShowReload] = useState(false);

  useEffect(() => {
    if (!webgl || !box.current) return undefined;
    if (typeof IntersectionObserver === 'undefined') { setInView(true); setEverVisible(true); return undefined; }
    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
      if (entry.isIntersecting) setEverVisible(true);
    }, { rootMargin: '120px', threshold: 0.01 });
    observer.observe(box.current);
    return () => observer.disconnect();
  }, [webgl]);

  useEffect(() => {
    if (status !== 'lost') { setShowReload(false); return undefined; }
    const timer = setTimeout(() => setShowReload(true), 3000);
    return () => clearTimeout(timer);
  }, [status]);

  const onStatus = (next) => {
    if (next === 'restored' || next === 'ready') setStatus('ready');
    else setStatus(next);
  };

  const use2D = !webgl || status === 'failed';
  const state = use2D ? 'fallback' : status === 'lost' ? (showReload ? 'lost' : 'restoring') : status === 'ready' ? 'ready' : everVisible ? 'loading' : 'idle';

  return (
    <div
      ref={box}
      className={`three-panel three-height ${className}`}
      data-testid={testId}
      data-state={state}
      data-generation={generation}
      aria-label={label}
      style={{ position: 'relative', width: '100%', '--h': typeof height === 'number' ? `${height}px` : height, '--hm': typeof mobileHeight === 'number' ? `${mobileHeight}px` : mobileHeight }}
    >
      {use2D ? fallback : (
        <>
          {everVisible && (
            <SceneBoundary key={generation} onFail={() => setStatus('failed')}>
              <Suspense fallback={<PanelNote>Loading 3D view…</PanelNote>}>
                <Scene key={generation} {...sceneProps} active={inView} reducedMotion={reduced} onStatus={onStatus} />
              </Suspense>
            </SceneBoundary>
          )}
          {!everVisible && <PanelNote>The 3D view loads when this panel is on screen.</PanelNote>}
          {status === 'lost' && (
            <div role="status" data-testid="three-lost" style={overlay}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700 }}>Restoring 3D view...</div>
                {showReload && (
                  <button type="button" data-testid="three-reload" onClick={() => { setStatus('loading'); setGeneration((g) => g + 1); }} style={reloadButton}>
                    Reload 3D view
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
      <style>{`.three-height { height: var(--h); } @media (max-width: 768px) { .three-height { height: var(--hm); } }`}</style>
    </div>
  );
};

const overlay = {
  position: 'absolute', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'color-mix(in srgb, var(--surface) 88%, transparent)', color: 'var(--text)', fontSize: '0.9rem',
};
const reloadButton = {
  marginTop: '0.75rem', minHeight: 40, padding: '0 1rem', borderRadius: 8, border: '1px solid var(--accent)', background: 'var(--accent)', color: 'var(--text-on-accent)', fontWeight: 800, cursor: 'pointer',
};

const PanelNote = ({ children }) => (
  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{children}</div>
);

export default ThreePanel;
