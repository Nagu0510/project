// Safe storage helper with versioning & error resilience

const STORAGE_PREFIX = 'skillsense_';
const CURRENT_STORAGE_VERSION = '2';

export const safeStorage = {
  get(key, fallback = null) {
    try {
      const fullKey = key.startsWith(STORAGE_PREFIX) ? key : `${STORAGE_PREFIX}${key}`;
      const item = localStorage.getItem(fullKey);
      if (item === null || item === undefined) return fallback;
      try {
        return JSON.parse(item);
      } catch {
        return item; // Plain string fallback
      }
    } catch (e) {
      console.warn(`[Storage] Failed to read ${key}:`, e);
      return fallback;
    }
  },

  set(key, value) {
    try {
      const fullKey = key.startsWith(STORAGE_PREFIX) ? key : `${STORAGE_PREFIX}${key}`;
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      localStorage.setItem(fullKey, serialized);
      return true;
    } catch (e) {
      console.warn(`[Storage] Failed to write ${key}:`, e);
      return false;
    }
  },

  remove(key) {
    try {
      const fullKey = key.startsWith(STORAGE_PREFIX) ? key : `${STORAGE_PREFIX}${key}`;
      localStorage.removeItem(fullKey);
    } catch (e) {
      console.warn(`[Storage] Failed to remove ${key}:`, e);
    }
  },

  initVersion() {
    try {
      const storedVersion = localStorage.getItem(`${STORAGE_PREFIX}storage_version`);
      if (storedVersion !== CURRENT_STORAGE_VERSION) {
        // Only clear stale skill-sense keys, do NOT wipe user's unrelated domain keys
        const keysToClean = [
          'skillsense_user',
          'skillsense_assessment_cache',
          'skillsense_roadmap_cache',
        ];
        keysToClean.forEach((k) => localStorage.removeItem(k));
        localStorage.setItem(`${STORAGE_PREFIX}storage_version`, CURRENT_STORAGE_VERSION);
      }
    } catch (e) {
      console.warn('[Storage] Version check error:', e);
    }
  },

  clearSkillSenseKeys() {
    try {
      const keys = [
        'skillsense_token',
        'skillsense_user',
        'skillsense_auth',
        'skillsense_pq_insights',
        'skillsense_storage_version',
      ];
      keys.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.warn('[Storage] Failed to clear SkillSense keys:', e);
    }
  },
};

// Initialize versioning on import
safeStorage.initVersion();
export default safeStorage;
