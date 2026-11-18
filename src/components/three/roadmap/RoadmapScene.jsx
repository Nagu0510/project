import React, { useEffect, useRef } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { createThreeHost } from '../engine/threeHost';
import { createRoadmapScene } from './sceneBuilder';
import { stateColors } from './ribbonLayout';
import { useTheme } from '../../../context/ThemeContext';
import './roadmap3d.css';

/**
 * The 3D ribbon of one career path (lazy-loaded by ThreePanel, so Three.js is only downloaded once the panel is on screen).
 * One renderer for the lifetime of this component, disposed on unmount. A different track / different milestones rebuild the
 * ribbon, nodes and labels inside the same renderer.
 */
export default function RoadmapScene({ track, milestones, currentNumber, selectedId, onSelect, active = true, reducedMotion = false, onStatus }) {
  const { resolvedTheme } = useTheme();
  const stage = useRef(null);
  const labelLayer = useRef(null);
  const api = useRef(null);
  const hostRef = useRef(null);
  const built = useRef(null);
  const latest = useRef({});
  latest.current = { track, milestones, currentNumber, selectedId, onSelect, active, onStatus, theme: resolvedTheme };

  useEffect(() => {
    let host;
    try {
      host = createThreeHost(stage.current, {
        fov: 40,
        animated: !reducedMotion,
        onStatus: (s) => latest.current.onStatus?.(s),
        onRestore: () => api.current?.rebuild(),
      });
    } catch {
      latest.current.onStatus?.('failed'); // the browser refused to create a WebGL context: the panel shows the 2D timeline
      return undefined;
    }
    hostRef.current = host;
    host.start();
    const scene = createRoadmapScene(host, labelLayer.current, { onSelect: (id) => latest.current.onSelect?.(id), reducedMotion, theme: latest.current.theme });
    api.current = scene;
    const prevFirst = host.onFirstFrame;
    host.onFirstFrame = () => { prevFirst?.(); latest.current.onStatus?.('ready'); };
    const { track: t, milestones: m, currentNumber: c, selectedId: s, active: a } = latest.current;
    scene.setData({ track: t, milestones: m, currentNumber: c });
    built.current = { track: t, milestones: m, currentNumber: c };
    scene.setSelected(s);
    host.setActive(a);
    return () => {
      api.current = null;
      hostRef.current = null;
      scene.dispose();
      host.dispose();
    };
  }, [reducedMotion]);

  // the milestones of the chosen career path changed: rebuild from them (no stale ribbon)
  useEffect(() => {
    const b = built.current;
    if (!api.current || (b && b.track === track && b.milestones === milestones && b.currentNumber === currentNumber)) return;
    built.current = { track, milestones, currentNumber };
    api.current.setData({ track, milestones, currentNumber });
  }, [track, milestones, currentNumber]);
  useEffect(() => { api.current?.setSelected(selectedId); }, [selectedId]);
  // light <-> dark: the same renderer and geometry, only colours and light intensities change
  useEffect(() => { api.current?.setTheme(resolvedTheme); }, [resolvedTheme]);
  useEffect(() => { hostRef.current?.setActive(active); }, [active]);

  return (
    <div className="rm3d" ref={stage} data-testid="roadmap-3d-stage">
      <div className="rm3d-labels" ref={labelLayer} />
      <div className="rm3d-controls" role="group" aria-label="3D view controls">
        <button type="button" onClick={() => api.current?.zoomBy(1 / 1.25)} aria-label="Zoom out" data-testid="roadmap-3d-zoom-out"><Minus size={16} /></button>
        <button type="button" onClick={() => api.current?.zoomBy(1.25)} aria-label="Zoom in" data-testid="roadmap-3d-zoom-in"><Plus size={16} /></button>
        <button type="button" onClick={() => api.current?.resetView()} aria-label="Reset view" data-testid="roadmap-3d-reset"><RotateCcw size={14} /> <span className="rm3d-reset-text">Reset view</span></button>
      </div>
      <div className="rm3d-hint">Drag to rotate · Ctrl + scroll or the buttons to zoom · click a node for its details</div>
      <ul className="rm3d-legend" aria-label="Node colours">
        {Object.entries(stateColors(resolvedTheme)).map(([key, look]) => (
          <li key={key}><span style={{ background: look.node, boxShadow: `0 0 6px ${look.emissive}` }} />{look.label}</li>
        ))}
      </ul>
    </div>
  );
}
