import { describe, expect, it } from 'vitest';
import {
  buildRibbon,
  clampRect,
  fitDistance,
  labelRect,
  milestoneState,
  orientationFor,
  projectFlat,
  rectsOverlap,
  resolveLabelOverlaps,
  STATE_COLORS,
  STATE_COLORS_BY_THEME,
} from './ribbonLayout';

const COUNTS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe('ribbon points', () => {
  it('builds one distinct, finite node per milestone for any count from 3 to 14, in both orientations', () => {
    COUNTS.forEach((n) => ['horizontal', 'vertical'].forEach((orientation) => {
      const r = buildRibbon(n, { orientation });
      expect(r.points).toHaveLength(n);
      expect(r.labels).toHaveLength(n);
      r.points.forEach((p) => [p.x, p.y, p.z].forEach((v) => expect(Number.isFinite(v)).toBe(true)));
      for (let i = 1; i < n; i += 1) expect(dist(r.points[i], r.points[i - 1])).toBeGreaterThan(1);
      const centre = r.points.reduce((s, p) => s + (orientation === 'horizontal' ? p.x : p.y), 0) / n;
      expect(Math.abs(centre)).toBeLessThan(1e-9); // centred, so the camera can look at the origin
    }));
  });

  it('runs left to right when wide and top to bottom when tall', () => {
    const wide = buildRibbon(6, { orientation: 'horizontal' });
    expect(wide.points[0].x).toBeLessThan(wide.points[5].x);
    const tall = buildRibbon(6, { orientation: 'vertical' });
    expect(tall.points[0].y).toBeGreaterThan(tall.points[5].y);
  });

  it('handles empty and tiny lists without throwing', () => {
    expect(buildRibbon(0).points).toEqual([]);
    expect(buildRibbon(1).points).toHaveLength(1);
    expect(buildRibbon(-3).count).toBe(0);
    expect(buildRibbon(undefined).count).toBe(0);
  });

  it('picks the orientation from the panel shape', () => {
    expect(orientationFor(1100, 460)).toBe('horizontal');
    expect(orientationFor(340, 520)).toBe('vertical');
    expect(orientationFor(700, 700)).toBe('vertical');
    expect(orientationFor(0, 0)).toBe('vertical');
  });
});

describe('labels never overlap', () => {
  const LABEL = { w: 110, h: 26 };
  const rectsFor = (n, orientation, width, height) => {
    const r = buildRibbon(n, { orientation });
    return r.labels.map((l) => {
      const p = projectFlat(l.anchor, r.extent, width, height);
      return { id: l.index, rect: clampRect(labelRect(p.x, p.y, l.side, LABEL.w, LABEL.h), width, height), priority: 0, depth: l.anchor.z };
    });
  };

  it('keeps every label of a 3 to 14 milestone ribbon apart in a wide desktop panel without hiding or shrinking any', () => {
    COUNTS.forEach((n) => {
      const items = rectsFor(n, 'horizontal', 1100, 480);
      for (let i = 0; i < items.length; i += 1) for (let j = i + 1; j < items.length; j += 1) expect(rectsOverlap(items[i].rect, items[j].rect, 0), `${n} labels: ${i} vs ${j}`).toBe(false);
    });
  });

  it('in narrower wide panels (1024 and 768 px) crowded labels shrink to their number instead of overlapping, and only a few disappear (at most one at 880 px, a third at 640 px)', () => {
    [[880, 460], [640, 440]].forEach(([w, h]) => COUNTS.forEach((n) => {
      const items = rectsFor(n, 'horizontal', w, h).map((item) => ({ ...item, compact: { ...item.rect, w: 38 } }));
      const mode = resolveLabelOverlaps(items);
      const placed = items.filter((i) => mode[i.id] !== 'hidden').map((i) => (mode[i.id] === 'compact' ? i.compact : i.rect));
      for (let i = 0; i < placed.length; i += 1) for (let j = i + 1; j < placed.length; j += 1) expect(rectsOverlap(placed[i], placed[j], 0), `${n} at ${w}`).toBe(false);
      expect(Object.values(mode).filter((m) => m === 'hidden').length, `${n} at ${w}`).toBeLessThanOrEqual(w >= 880 ? 1 : Math.ceil(n / 3));
    }));
  });

  it('keeps every label apart in a tall phone panel (390 px) as well', () => {
    COUNTS.forEach((n) => {
      const items = rectsFor(n, 'vertical', 340, 560);
      const mode = resolveLabelOverlaps(items);
      const shown = items.filter((i) => mode[i.id] !== 'hidden');
      for (let i = 0; i < shown.length; i += 1) for (let j = i + 1; j < shown.length; j += 1) expect(rectsOverlap(shown[i].rect, shown[j].rect, 0)).toBe(false);
      expect(shown.length).toBeGreaterThanOrEqual(Math.ceil(n / 2));
    });
  });

  it('resolveLabelOverlaps hides the lower priority label of a clashing pair and never leaves an overlap', () => {
    const items = [
      { id: 'a', rect: { x: 0, y: 0, w: 100, h: 20 }, priority: 1, depth: 0 },
      { id: 'b', rect: { x: 50, y: 5, w: 100, h: 20 }, priority: 5, depth: 3 },
      { id: 'c', rect: { x: 400, y: 0, w: 100, h: 20 }, priority: 0, depth: 1 },
    ];
    expect(resolveLabelOverlaps(items)).toEqual({ a: 'hidden', b: 'full', c: 'full' });
    const withCompact = items.map((i) => ({ ...i, compact: { x: i.rect.x, y: i.rect.y + 40, w: 30, h: 20 } }));
    expect(resolveLabelOverlaps(withCompact)).toEqual({ a: 'compact', b: 'full', c: 'full' }); // the clashing label shrinks to its number instead of vanishing
    const tie = [
      { id: 'far', rect: { x: 0, y: 0, w: 50, h: 20 }, priority: 0, depth: 5 },
      { id: 'near', rect: { x: 10, y: 0, w: 50, h: 20 }, priority: 0, depth: -5 },
    ];
    expect(resolveLabelOverlaps(tie)).toEqual({ far: 'hidden', near: 'full' }); // the nearer one wins a tie
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const random = Array.from({ length: 40 }, (_, i) => ({ id: i, rect: { x: rnd() * 600, y: rnd() * 300, w: 60 + rnd() * 90, h: 24 }, priority: Math.floor(rnd() * 3), depth: rnd() }));
    const squeezed = random.map((r) => ({ ...r, compact: { x: r.rect.x, y: r.rect.y, w: 30, h: 24 } }));
    const mode = resolveLabelOverlaps(squeezed);
    const placed = squeezed.filter((r) => mode[r.id] !== 'hidden').map((r) => (mode[r.id] === 'compact' ? r.compact : r.rect));
    for (let i = 0; i < placed.length; i += 1) for (let j = i + 1; j < placed.length; j += 1) expect(rectsOverlap(placed[i], placed[j])).toBe(false);
    expect(Object.values(mode).filter((m) => m === 'compact').length).toBeGreaterThan(0); // the fallback is really used
    const plain = resolveLabelOverlaps(random);
    expect(Object.values(plain).every((m) => m === 'full' || m === 'hidden')).toBe(true);
  });

  it('keeps a label inside the panel', () => {
    expect(clampRect({ x: -30, y: -5, w: 120, h: 24 }, 400, 300)).toEqual({ x: 4, y: 4, w: 120, h: 24 });
    expect(clampRect({ x: 380, y: 290, w: 120, h: 24 }, 400, 300)).toEqual({ x: 276, y: 272, w: 120, h: 24 });
    expect(clampRect({ x: 0, y: 0, w: 900, h: 24 }, 300, 100).w).toBe(292);
  });
});

describe('camera fit and milestone state', () => {
  it('moves the camera back for longer ribbons and narrower panels', () => {
    const few = buildRibbon(4).extent;
    const many = buildRibbon(14).extent;
    expect(fitDistance(many, { aspect: 2 })).toBeGreaterThan(fitDistance(few, { aspect: 2 }));
    expect(fitDistance(many, { aspect: 1 })).toBeGreaterThan(fitDistance(many, { aspect: 3 }));
    expect(Number.isFinite(fitDistance(buildRibbon(0).extent))).toBe(true);
  });

  it('names the state of a milestone', () => {
    expect(milestoneState({ status: 'completed', number: 1 }, 2)).toBe('completed');
    expect(milestoneState({ status: 'locked', number: 5 }, 2)).toBe('locked');
    expect(milestoneState({ status: 'in_progress', number: 3 }, 2)).toBe('active');
    expect(milestoneState({ status: 'not_started', number: 2 }, 2)).toBe('active');
    expect(milestoneState({ status: 'not_started', number: 4, isPriorityGap: true }, 2)).toBe('priority');
    expect(milestoneState({ status: 'not_started', number: 4 }, 2)).toBe('next');
    Object.keys(STATE_COLORS).forEach((k) => expect(STATE_COLORS[k].chip).toMatch(/^#/));
  });

  it('label chips and node numbers are readable in BOTH themes: text against its colour is at least 4.5:1', () => {
    const lum = (hex) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const ratio = (x, y) => { const [a, b] = [lum(x), lum(y)].sort((m, n) => n - m); return (a + 0.05) / (b + 0.05); };
    Object.entries(STATE_COLORS_BY_THEME).forEach(([theme, palette]) => {
      expect(Object.keys(palette).sort()).toEqual(Object.keys(STATE_COLORS).sort());
      Object.entries(palette).forEach(([name, c]) => {
        expect(ratio(c.chip, c.text), `${theme} ${name} chip`).toBeGreaterThanOrEqual(4.5);
        expect(ratio(c.node, c.onNode), `${theme} ${name} node number`).toBeGreaterThanOrEqual(4.5);
      });
    });
  });
});
