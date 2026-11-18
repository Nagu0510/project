import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  DARK_QUERY, THEME_COLORS, THEME_KEY, createThemeController, nextPreference, normalizePreference, readStoredPreference, resolveTheme,
} from './themeCore';

const memoryStorage = (initial = {}) => {
  const data = { ...initial };
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
};
const blockedStorage = () => ({ getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } });

const fakeDoc = () => {
  const attrs = {};
  const classes = new Set();
  const meta = { content: '', setAttribute(k, v) { if (k === 'content') this.content = v; } };
  return {
    attrs, classes, meta,
    documentElement: { setAttribute: (k, v) => { attrs[k] = v; }, style: {}, classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) } },
    querySelector: (q) => (q === 'meta[name="theme-color"]' ? meta : null),
  };
};

const fakeWindow = (systemDark = false) => {
  const mqListeners = new Set();
  const winListeners = {};
  const mq = { matches: systemDark, addEventListener: (_, fn) => mqListeners.add(fn), removeEventListener: (_, fn) => mqListeners.delete(fn) };
  return {
    mq, mqListeners,
    matchMedia: (q) => { expect(q).toBe(DARK_QUERY); return mq; },
    addEventListener: (type, fn) => { winListeners[type] = fn; },
    removeEventListener: (type) => { delete winListeners[type]; },
    setSystem(dark) { mq.matches = dark; mqListeners.forEach((fn) => fn({ matches: dark })); },
    fireStorage(event) { winListeners.storage?.(event); },
    winListeners,
  };
};

const make = ({ stored, system = false, storage } = {}) => {
  const st = storage || memoryStorage(stored === undefined ? {} : { [THEME_KEY]: stored });
  const doc = fakeDoc();
  const win = fakeWindow(system);
  const controller = createThemeController({ storage: st, doc, win });
  return { controller, st, doc, win };
};

describe('theme preference', () => {
  it('defaults to system and follows the OS', () => {
    expect(make({ system: false }).controller.getSnapshot()).toEqual({ preference: 'system', resolvedTheme: 'light' });
    expect(make({ system: true }).controller.getSnapshot()).toEqual({ preference: 'system', resolvedTheme: 'dark' });
  });

  it('restores a saved preference and ignores an invalid one', () => {
    expect(make({ stored: 'dark' }).controller.getSnapshot().preference).toBe('dark');
    expect(make({ stored: 'light', system: true }).controller.getSnapshot().resolvedTheme).toBe('light');
    expect(make({ stored: 'purple' }).controller.getSnapshot().preference).toBe('system');
    expect(normalizePreference('DARK')).toBeNull();
    const { controller, st } = make({ stored: 'dark' });
    expect(controller.setPreference('purple')).toBe(false);
    expect(controller.getSnapshot().preference).toBe('dark');
    expect(st.data[THEME_KEY]).toBe('dark');
  });

  it('survives blocked storage (reads, writes, a missing storage object)', () => {
    expect(readStoredPreference(blockedStorage())).toBe('system');
    expect(readStoredPreference(null)).toBe('system');
    const { controller } = make({ storage: blockedStorage() });
    expect(() => controller.setPreference('dark')).not.toThrow();
    expect(controller.getSnapshot()).toEqual({ preference: 'dark', resolvedTheme: 'dark' }); // still applies for this visit
  });

  it('persists the choice', () => {
    const { controller, st } = make();
    controller.setPreference('dark');
    expect(st.data[THEME_KEY]).toBe('dark');
  });

  it('cycles light -> dark -> system -> light', () => {
    expect(nextPreference('light')).toBe('dark');
    expect(nextPreference('dark')).toBe('system');
    expect(nextPreference('system')).toBe('light');
    const { controller } = make({ stored: 'light' });
    const seen = [];
    for (let i = 0; i < 4; i += 1) { controller.cycle(); seen.push(controller.getSnapshot().preference); }
    expect(seen).toEqual(['dark', 'system', 'light', 'dark']);
  });

  it('resolveTheme only consults the OS for system', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('document attributes', () => {
  it('sets data-theme, color-scheme and theme-color, and moves them on a change', () => {
    const { controller, doc } = make({ stored: 'dark' });
    expect(doc.attrs['data-theme']).toBe('dark');
    expect(doc.documentElement.style.colorScheme).toBe('dark');
    expect(doc.meta.content).toBe(THEME_COLORS.dark);
    controller.setPreference('light');
    expect(doc.attrs['data-theme']).toBe('light');
    expect(doc.documentElement.style.colorScheme).toBe('light');
    expect(doc.meta.content).toBe(THEME_COLORS.light);
  });

  it('adds the transition class for a moment on a visible change, never on first paint', () => {
    vi.useFakeTimers();
    try {
      const { controller, doc } = make({ stored: 'light' });
      expect(doc.classes.has('theme-switching')).toBe(false);
      controller.setPreference('dark');
      expect(doc.classes.has('theme-switching')).toBe(true);
      vi.advanceTimersByTime(400);
      expect(doc.classes.has('theme-switching')).toBe(false);
    } finally { vi.useRealTimers(); }
  });
});

describe('following the OS and other tabs', () => {
  it('an OS change updates the theme while the preference is system, and only then', () => {
    const { controller, win, doc } = make({ system: false });
    const listener = vi.fn();
    const off = controller.subscribe(listener);
    win.setSystem(true);
    expect(controller.getSnapshot()).toEqual({ preference: 'system', resolvedTheme: 'dark' });
    expect(doc.attrs['data-theme']).toBe('dark');
    expect(listener).toHaveBeenCalled();
    controller.setPreference('light');
    win.setSystem(false);
    win.setSystem(true);
    expect(controller.getSnapshot()).toEqual({ preference: 'light', resolvedTheme: 'light' });
    off();
    expect(win.mqListeners.size).toBe(0); // no listener left behind
    expect(win.winListeners.storage).toBeUndefined();
  });

  it('follows a change made in another tab (storage event)', () => {
    const { controller, win, st } = make({ stored: 'light' });
    controller.subscribe(() => {});
    st.data[THEME_KEY] = 'dark';
    win.fireStorage({ key: THEME_KEY });
    expect(controller.getSnapshot().preference).toBe('dark');
    st.data[THEME_KEY] = 'light';
    win.fireStorage({ key: 'something-else' });
    expect(controller.getSnapshot().preference).toBe('dark'); // unrelated keys are ignored
  });
});

describe('no-flash script', () => {
  const run = ({ stored, system, throws = false }) => {
    const code = readFileSync(new URL('./theme-init.js', import.meta.url), 'utf8');
    const attrs = {};
    const style = {};
    const meta = { content: '', setAttribute(k, v) { this.content = v; } };
    const window = {
      localStorage: throws ? { getItem() { throw new Error('blocked'); } } : { getItem: () => stored ?? null },
      matchMedia: () => ({ matches: system }),
    };
    const document = { documentElement: { setAttribute: (k, v) => { attrs[k] = v; }, style }, querySelector: () => meta };
    new Function('window', 'document', code)(window, document);
    return { attrs, style, meta };
  };

  it('sets the theme before React: saved choice first, then the OS, light when nothing works', () => {
    expect(run({ stored: 'dark', system: false }).attrs['data-theme']).toBe('dark');
    expect(run({ stored: 'light', system: true }).attrs['data-theme']).toBe('light');
    expect(run({ stored: null, system: true }).attrs['data-theme']).toBe('dark');
    expect(run({ stored: 'nonsense', system: false }).attrs['data-theme']).toBe('light');
    const blocked = run({ throws: true, system: true });
    expect(blocked.attrs['data-theme']).toBe('dark');
    expect(blocked.style.colorScheme).toBe('dark');
    expect(blocked.meta.content).toBe(THEME_COLORS.dark);
  });
});
