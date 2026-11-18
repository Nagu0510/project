import React from 'react';
import { ThreePanel } from './ThreePanel';
import { RoadmapTimeline2D } from './roadmap/RoadmapTimeline2D';

// Three.js (about 900 KB) is only downloaded once this panel scrolls into view and the browser can do WebGL.
const RoadmapScene = React.lazy(() => import('./roadmap/RoadmapScene'));

/**
 * The 3D pathway ribbon of a career path. `milestones` must be the milestones of `track` in order (the page memoises them): a different
 * track rebuilds the ribbon inside the same renderer, so nothing stale is ever drawn. Without WebGL the same milestones appear as a 2D timeline.
 */
export const CareerRoad3D = ({ track, milestones, currentNumber = 1, selectedId = null, onSelect, loading = false, emptyMessage = 'No milestones to show yet.' }) => {
  const message = loading ? 'Loading the milestones of this track…' : milestones.length === 0 ? emptyMessage : '';
  return (
    <div style={{ position: 'relative' }}>
      <ThreePanel
        Scene={RoadmapScene}
        sceneProps={{ track, milestones, currentNumber, selectedId, onSelect }}
        fallback={<RoadmapTimeline2D milestones={milestones} currentNumber={currentNumber} selectedId={selectedId} onSelect={onSelect} emptyMessage="" />}
        testId="roadmap-3d"
        label={`Interactive 3D pathway ribbon for ${track || 'the chosen track'}`}
        height={430}
        mobileHeight={560}
      />
      {message && milestones.length === 0 && (
        <div role="status" data-testid="roadmap-3d-message" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', color: 'var(--text)', fontSize: '0.9rem' }}>
          {message}
        </div>
      )}
    </div>
  );
};

export default CareerRoad3D;
