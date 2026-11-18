// Theme engine without React, so it can be unit-tested in plain Node. ThemeContext.jsx wraps it.
// Preference: 'light' | 'dark' | 'system'. Resolved theme: 'light' | 'dark'. Stored in localStorage only (never in the backend).
export const THEME_KEY = 'skillsense-theme';
export const PREFERENCES = ['light', 'dark', 'system'];
export const THEME_COLORS = { light: '#F4F0E7', dark: '#0D1411' }; // same as --theme-color in index.css; used for <meta name="theme-color">
export const DARK_QUERY = '(prefers-color-scheme: dark)';
const SWITCH_CLASS = 'theme-switching';
const SWITCH_MS = 260;

export const normalizePreference = (value) => (PREFERENCES.includes(value) ? value : null);
export const resolveTheme = (preference, systemDark) => (preference === 'system' ? (systemDark ? 'dark' : 'light') : preference);
export const nextPreference = (preference) => PREFERENCES[(PREFERENCES.indexOf(preference) + 1) % PREFERENCES.length];
export const preferenceLabel = (preference) => ({ light: 'Light', dark: 'Dark', system: 'System' }[preference] || 'System');

// Blocked or full storage (private window, site data off) must never crash the app: every access is guarded.
export function readStoredPreference(storage) {
  try {
    return normalizePreference(storage?.getItem(THEME_KEY)) || 'system';
  } catch {
    return 'system';
  }
}

export function writeStoredPreference(storage, preference) {
  try {
    storage?.setItem(THEME_KEY, preference);
    return true;
  } catch {
    return false;
  }
}

export function applyTheme(doc, resolved, { animate = false } = {}) {
  const root = doc?.documentElement;
  if (!root) return;
  if (animate) {
    root.classList.add(SWITCH_CLASS);
    clearTimeout(applyTheme.timer);
    applyTheme.timer = setTimeout(() => root.classList.remove(SWITCH_CLASS), SWITCH_MS);
  }
  root.setAttribute('data-theme', resolved);
  root.style.colorScheme = resolved;
  root.style.backgroundColor = THEME_COLORS[resolved];
  const meta = doc.querySelector?.('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[resolved]);
}

/**
 * A tiny store: getSnapshot() -> { preference, resolvedTheme }, subscribe(fn), setPreference(p), cycle().
 * `env` = { storage, doc, win } (injected so tests can pass fakes). It follows the OS while the preference is 'system'
 * and follows other tabs through the `storage` event.
 */
export function createThemeController({ storage, doc, win } = {}) {
  const mq = win?.matchMedia?.(DARK_QUERY) ?? null;
  let preference = readStoredPreference(storage);
  let systemDark = Boolean(mq?.matches);
  let snapshot = { preference, resolvedTheme: resolveTheme(preference, systemDark) };
  const listeners = new Set();
  let attached = false;

  applyTheme(doc, snapshot.resolvedTheme);

  const refresh = (animate) => {
    const resolvedTheme = resolveTheme(preference, systemDark);
    if (snapshot.preference === preference && snapshot.resolvedTheme === resolvedTheme) return;
    const changedLook = snapshot.resolvedTheme !== resolvedTheme;
    snapshot = { preference, resolvedTheme };
    if (changedLook) applyTheme(doc, resolvedTheme, { animate });
    listeners.forEach((fn) => fn());
  };

  const onSystem = (event) => { systemDark = Boolean(event.matches); refresh(true); };
  const onStorage = (event) => {
    if (event.key !== null && event.key !== THEME_KEY) return;
    preference = readStoredPreference(storage);
    refresh(true);
  };

  const attach = () => {
    if (attached) return;
    attached = true;
    systemDark = Boolean(mq?.matches);
    if (mq?.addEventListener) mq.addEventListener('change', onSystem);
    else mq?.addListener?.(onSystem);
    win?.addEventListener?.('storage', onStorage);
    refresh(false); // the OS or another tab may have changed while nothing was listening
  };
  const detach = () => {
    if (!attached) return;
    attached = false;
    if (mq?.removeEventListener) mq.removeEventListener('change', onSystem);
    else mq?.removeListener?.(onSystem);
    win?.removeEventListener?.('storage', onStorage);
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(fn) {
      listeners.add(fn);
      attach();
      return () => {
        listeners.delete(fn);
        if (!listeners.size) detach();
      };
    },
    setPreference(next) {
      const value = normalizePreference(next);
      if (!value) return false; // an invalid value is ignored
      preference = value;
      writeStoredPreference(storage, value);
      refresh(true);
      return true;
    },
    cycle() {
      this.setPreference(nextPreference(preference));
    },
  };
}
