import React, { useEffect, useRef } from 'react';
import { createThreeHost } from '../engine/threeHost';
import { createCoreScene } from './coreBuilder';
import { useTheme } from '../../../context/ThemeContext';

export default function CoreScene({ active = true, reducedMotion = false, onStatus }) {
  const { resolvedTheme } = useTheme();
  const stage = useRef(null);
  const sceneRef = useRef(null);
  const labelLayer = useRef(null);
  const latest = useRef({});
  latest.current = { active, onStatus, theme: resolvedTheme };

  useEffect(() => {
    let host;
    try {
      host = createThreeHost(stage.current, { fov: 48, animated: !reducedMotion, onStatus: (s) => latest.current.onStatus?.(s), onRestore: () => scene?.rebuild() });
    } catch {
      latest.current.onStatus?.('failed');
      return undefined;
    }
    host.start();
    const scene = createCoreScene(host, labelLayer.current, { reducedMotion, theme: latest.current.theme });
    sceneRef.current = scene;
    const prevFirst = host.onFirstFrame;
    host.onFirstFrame = () => { prevFirst?.(); latest.current.onStatus?.('ready'); };
    host.setActive(latest.current.active);
    stage.current.__host = host;
    return () => {
      delete stage.current?.__host;
      sceneRef.current = null;
      scene.dispose();
      host.dispose();
    };
  }, [reducedMotion]);

  useEffect(() => { stage.current?.__host?.setActive(active); }, [active]);
  // light <-> dark: same renderer, only colours and light intensities change
  useEffect(() => { sceneRef.current?.setTheme(resolvedTheme); }, [resolvedTheme]);

  return (
    <div ref={stage} data-testid="core-3d-stage" style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <div ref={labelLayer} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 5 }} />
      <style>{`
        .core-badge { position: absolute; left: 0; top: 0; display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 9999px; white-space: nowrap;
          font: 800 0.78rem var(--font-sans); user-select: none; background: var(--surface-raised); color: var(--text); border: 1.5px solid var(--border-strong);
          box-shadow: var(--shadow-md); }
        .core-badge[data-primary='true'] { background: var(--color-lime); color: var(--color-deep-forest); border-color: var(--color-deep-forest); }
        .core-badge span:first-child { font-size: 0.65rem; color: var(--accent); }
        .core-badge[data-primary='true'] span:first-child { color: var(--color-deep-forest); }
      `}</style>
    </div>
  );
}
