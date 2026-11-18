import React, { createContext, useContext, useMemo, useState, useSyncExternalStore } from 'react';
import { createThemeController } from '../theme/themeCore';

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [controller] = useState(() => createThemeController({
    storage: typeof window !== 'undefined' ? safeStorage() : null,
    doc: typeof document !== 'undefined' ? document : null,
    win: typeof window !== 'undefined' ? window : null,
  }));
  const { preference, resolvedTheme } = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const value = useMemo(() => ({
    preference,
    resolvedTheme,
    setPreference: (next) => controller.setPreference(next),
    cycle: () => controller.cycle(),
  }), [controller, preference, resolvedTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

// Reading window.localStorage can itself throw when site data is blocked.
function safeStorage() {
  try { return window.localStorage; } catch { return null; }
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
};
