import React from 'react';
import { ThreePanel } from './ThreePanel';

const CoreScene = React.lazy(() => import('./landing/CoreScene'));

const SKILL_NAMES = ['Python', 'Java', 'React', 'DSA', 'AI', 'SQL', 'MongoDB', 'FastAPI', 'Cloud'];

// Shown instead of the 3D core when the browser has no WebGL: the same skills, flat.
const CoreFallback = () => (
  <div data-testid="core-2d" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.25rem', padding: '1.5rem' }}>
    <div style={{ width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, var(--color-emerald), var(--color-forest-deep))', boxShadow: '0 0 0 10px var(--accent-soft-strong), 0 0 0 22px var(--accent-soft)' }} aria-hidden="true" />
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.5rem', maxWidth: 420 }}>
      {SKILL_NAMES.map((name, i) => (
        <span key={name} style={{ padding: '4px 12px', borderRadius: 9999, fontWeight: 800, fontSize: '0.8rem', background: i % 2 === 0 ? 'var(--color-lime)' : 'var(--surface)', color: i % 2 === 0 ? 'var(--color-deep-forest)' : 'var(--text)', border: '1.5px solid var(--border-strong)' }}>✦ {name}</span>
      ))}
    </div>
  </div>
);

export const SkillSenseCore3D = ({ className = '', style = {} }) => (
  <div className={className} style={{ width: '100%', height: '100%', minHeight: '440px', position: 'relative', ...style }}>
    <ThreePanel Scene={CoreScene} sceneProps={{}} fallback={<CoreFallback />} testId="core-3d" label="Animated SkillSense skill network" height="100%" mobileHeight="100%" />
  </div>
);

export default SkillSenseCore3D;
