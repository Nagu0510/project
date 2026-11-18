// Pure layout maths for the 3D roadmap ribbon: where each milestone node sits, where its label goes, how far the camera must be, and
// which labels to hide when two would overlap. No Three.js and no DOM here, so it is unit-tested without WebGL.

export const SPACING = 1.4;       // world units between neighbouring nodes along the main axis
export const WAVE = { horizontal: 0.3, vertical: 0.55 }; // how far the ribbon winds across its main direction (small when wide: label rows stay clear)
export const DEPTH = 0.8;         // and towards / away from the camera (this is what makes it a 3D ribbon)
export const MARGIN_X = 0.6;      // world units kept free left / right of the nodes for labels
export const MARGIN_Y = 1.0;
export const NODE_RADIUS = 0.17;
export const MIN_ASPECT_HORIZONTAL = 1.15; // narrower panels get the vertical layout

/** 'horizontal' for a wide panel, 'vertical' for a tall or narrow one. */
export function orientationFor(width, height) {
  return height > 0 && width / height >= MIN_ASPECT_HORIZONTAL ? 'horizontal' : 'vertical';
}

/**
 * Nodes of the ribbon for `count` milestones, centred on the origin.
 * horizontal: first milestone on the left, last on the right; vertical: first at the top, last at the bottom.
 * Labels alternate sides (above / below, or right / left) so neighbouring labels never share a row.
 */
export function buildRibbon(count, { orientation = 'horizontal', spacing = SPACING } = {}) {
  const n = Math.max(0, Math.floor(count) || 0);
  const half = (n - 1) / 2;
  const points = [];
  const labels = [];
  for (let i = 0; i < n; i += 1) {
    const along = (i - half) * spacing;
    const wave = Math.sin(i * 0.95) * WAVE[orientation === 'horizontal' ? 'horizontal' : 'vertical'];
    const z = Math.cos(i * 0.95 + 0.8) * DEPTH;
    const point = orientation === 'horizontal' ? { x: along, y: wave, z } : { x: wave, y: -along, z };
    points.push(point);
    const even = i % 2 === 0;
    labels.push({ index: i, anchor: { ...point }, side: orientation === 'horizontal' ? (even ? 'above' : 'below') : (even ? 'right' : 'left') });
  }
  return { orientation, count: n, spacing, points, labels, extent: extentOf(points, NODE_RADIUS + 0.12) };
}

export function extentOf(points, pad = 0) {
  if (!points.length) return { minX: -1, maxX: 1, minY: -1, maxY: 1, minZ: -1, maxZ: 1 };
  const e = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity };
  points.forEach((p) => {
    e.minX = Math.min(e.minX, p.x); e.maxX = Math.max(e.maxX, p.x);
    e.minY = Math.min(e.minY, p.y); e.maxY = Math.max(e.maxY, p.y);
    e.minZ = Math.min(e.minZ, p.z); e.maxZ = Math.max(e.maxZ, p.z);
  });
  return { minX: e.minX - pad, maxX: e.maxX + pad, minY: e.minY - pad, maxY: e.maxY + pad, minZ: e.minZ - pad, maxZ: e.maxZ + pad };
}

/**
 * Camera distance (looking down -z at the extent's centre) so the whole ribbon fits the panel with room for labels.
 * `margin` is world units kept free around the nodes on each side (labels live there).
 */
export function fitDistance(extent, { fov = 40, aspect = 1.6, marginX = MARGIN_X, marginY = MARGIN_Y } = {}) {
  const tan = Math.tan((fov * Math.PI) / 360);
  const halfH = (extent.maxY - extent.minY) / 2 + marginY;
  const halfW = (extent.maxX - extent.minX) / 2 + marginX;
  const front = Math.max(extent.maxZ, 0);
  return Math.max(halfH / tan, halfW / (tan * Math.max(aspect, 0.2))) + front * 0.5 + 0.3;
}

/** Orthographic estimate of where a point lands in a panel of `width` x `height` px, used to reason about label rows in tests. */
export function projectFlat(point, extent, width, height, marginX = MARGIN_X, marginY = MARGIN_Y) {
  const w = extent.maxX - extent.minX + 2 * marginX;
  const h = extent.maxY - extent.minY + 2 * marginY;
  const scale = Math.min(width / w, height / h);
  const cx = (extent.minX + extent.maxX) / 2;
  const cy = (extent.minY + extent.maxY) / 2;
  return { x: width / 2 + (point.x - cx) * scale, y: height / 2 - (point.y - cy) * scale };
}

/** The pixel rectangle of a label of size (w, h) next to a node at (px, py) on the given side. */
export function labelRect(px, py, side, w, h, gap = 16) {
  switch (side) {
    case 'above': return { x: px - w / 2, y: py - gap - h, w, h };
    case 'below': return { x: px - w / 2, y: py + gap, w, h };
    case 'left': return { x: px - gap - w, y: py - h / 2, w, h };
    default: return { x: px + gap, y: py - h / 2, w, h };
  }
}

/** Keep a rectangle inside the panel (labels are never cut off). */
export function clampRect(rect, width, height, margin = 4) {
  const w = Math.min(rect.w, width - 2 * margin);
  return {
    x: Math.min(Math.max(rect.x, margin), Math.max(margin, width - margin - w)),
    y: Math.min(Math.max(rect.y, margin), Math.max(margin, height - margin - rect.h)),
    w,
    h: rect.h,
  };
}

export function rectsOverlap(a, b, pad = 3) {
  return a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
}

/**
 * Decide how to show each label. items: [{ id, rect, compact?, priority, depth }]. Highest priority first, then nearest to the camera
 * (smaller depth). A label that would overlap one already shown falls back to its `compact` rectangle (just the number), and is hidden
 * when even that would overlap. Returns { [id]: 'full' | 'compact' | 'hidden' }; shown labels never overlap.
 */
export function resolveLabelOverlaps(items) {
  const order = [...items].sort((a, b) => (b.priority - a.priority) || (a.depth - b.depth));
  const shown = [];
  const mode = {};
  order.forEach((item) => {
    if (!shown.some((other) => rectsOverlap(item.rect, other.rect))) {
      mode[item.id] = 'full';
      shown.push({ rect: item.rect });
    } else if (item.compact && !shown.some((other) => rectsOverlap(item.compact, other.rect))) {
      mode[item.id] = 'compact';
      shown.push({ rect: item.compact });
    } else {
      mode[item.id] = 'hidden';
    }
  });
  return mode;
}

/** Visual state of one milestone: completed, active, priority (a gap to fix next), next, or locked. */
export function milestoneState(milestone, currentNumber) {
  if (milestone.status === 'completed') return 'completed';
  if (milestone.status === 'locked') return 'locked';
  if (milestone.status === 'in_progress' || milestone.number === currentNumber) return 'active';
  if (milestone.isPriorityGap) return 'priority';
  return 'next';
}

// WebGL materials cannot read CSS variables, so the 3D palette lives here (documented allowlist in docs/THEME_AUDIT.md). One palette per theme;
// the scene swaps colours in place when the theme changes. `chip`/`text` colour the DOM labels, `onNode` the number drawn on a node in the 2D version.
export const STATE_COLORS_BY_THEME = {
  dark: {
    completed: { node: '#C7F36B', emissive: '#6FA81E', glow: 0.45, chip: '#E8F8B0', text: '#0C2820', onNode: '#0C2820', label: 'Completed' },
    active: { node: '#FFFFFF', emissive: '#C7F36B', glow: 1.1, chip: '#C7F36B', text: '#0C2820', onNode: '#0C2820', label: 'Active' },
    priority: { node: '#F5B53C', emissive: '#B7791F', glow: 0.55, chip: '#FCE3A8', text: '#3A2605', onNode: '#0C2820', label: 'Priority gap' },
    next: { node: '#2DD4BF', emissive: '#0F766E', glow: 0.35, chip: '#CFF5EE', text: '#06302A', onNode: '#0C2820', label: 'Next' },
    locked: { node: '#87A59A', emissive: '#2B4A40', glow: 0.1, chip: '#DDE5E1', text: '#26332E', onNode: '#0C2820', label: 'Locked' },
  },
  light: {
    completed: { node: '#7DBE2E', emissive: '#4F8A14', glow: 0.2, chip: '#DCEFB8', text: '#14310F', onNode: '#0C2820', label: 'Completed' },
    active: { node: '#12372A', emissive: '#1F6B50', glow: 0.55, chip: '#B7E44A', text: '#0C2820', onNode: '#FFFFFF', label: 'Active' },
    priority: { node: '#E8A02A', emissive: '#A8680A', glow: 0.25, chip: '#FFE3A3', text: '#3A2605', onNode: '#0C2820', label: 'Priority gap' },
    next: { node: '#16A394', emissive: '#0B6F64', glow: 0.2, chip: '#CFF5EE', text: '#06302A', onNode: '#04211D', label: 'Next' },
    locked: { node: '#94A59E', emissive: '#5B6E66', glow: 0.05, chip: '#E3E8E5', text: '#26332E', onNode: '#0C2820', label: 'Locked' },
  },
};
// the ribbon tube: bright up to the milestone you are on, dim after it
export const RIBBON_COLORS = {
  dark: { bright: '#C7F36B', dim: '#2F7A68', emissive: '#0B3B2E', halo: '#C7F36B' },
  light: { bright: '#3E8E1F', dim: '#9DB5AB', emissive: '#CFE2D6', halo: '#12372A' },
};
export const LIGHTING = {
  dark: { ambient: 1.0, sun: 1.6, point: 18, pointColor: '#C7F36B' },
  light: { ambient: 1.5, sun: 1.1, point: 4, pointColor: '#FFFFFF' },
};
export const stateColors = (theme) => STATE_COLORS_BY_THEME[theme === 'light' ? 'light' : 'dark'];
export const STATE_COLORS = STATE_COLORS_BY_THEME.dark; // default (dark) palette
