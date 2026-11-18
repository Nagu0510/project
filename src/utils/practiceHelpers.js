// Helpers for the Practice Arena: reading and writing test-case text, turning API results into what the screen shows, remembered code.
// Pure functions (no React) so they can be unit-tested; storage helpers swallow storage errors (private windows, blocked storage).

export const LANGUAGES = [
  ['python', 'Python 3'],
  ['javascript', 'JavaScript (Node.js)'],
  ['java', 'Java'],
  ['cpp', 'C++ (G++)'],
  ['c', 'C (GCC)'],
];

export const MAX_CUSTOM_CASES = 5;
export const VERDICT_BUSY = 'Judge unavailable';

const INT_MIN = -2147483648;
const INT_MAX = 2147483647;

// ---------------------------------------------------------------------------------------------------------------------
// Test-case input: one "name = value" line per parameter, the value written as JSON
// ---------------------------------------------------------------------------------------------------------------------
export function compactJson(value) {
  return JSON.stringify(value);
}

/** The error message for `value` not being a legal `type` value, or null. */
export function checkValue(value, type) {
  switch (type) {
    case 'int':
      return Number.isInteger(value) && value >= INT_MIN && value <= INT_MAX ? null : 'expected a whole number between -2147483648 and 2147483647';
    case 'long':
      return Number.isSafeInteger(value) ? null : 'expected a whole number between -9007199254740991 and 9007199254740991';
    case 'double':
      return typeof value === 'number' && Number.isFinite(value) ? null : 'expected a number';
    case 'bool':
      return typeof value === 'boolean' ? null : 'expected true or false';
    case 'string':
      return typeof value === 'string' ? null : 'expected text in double quotes, like "hello"';
    default: {
      if (!type.endsWith('[]')) return `unsupported type ${type}`;
      if (!Array.isArray(value)) return 'expected a list like [1,2,3]';
      const inner = type.slice(0, -2);
      for (let i = 0; i < value.length; i += 1) {
        const problem = checkValue(value[i], inner);
        if (problem) return `item ${i + 1}: ${problem}`;
      }
      return null;
    }
  }
}

/** Check one input box before anything is sent. Returns a short message, or null when the text is a valid value of `type`. */
export function validateInputText(type, text) {
  const raw = String(text ?? '').trim();
  if (!raw) return 'Enter a value';
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    if (type === 'string') return 'Text needs double quotes, like "hello"';
    if (type.endsWith('[]')) return 'Write a list like [1,2,3], with commas between items';
    if (type === 'bool') return 'Write true or false';
    return `Could not read "${raw.slice(0, 30)}" as ${type === 'double' ? 'a number' : 'a whole number'}`;
  }
  return checkValue(parsed, type);
}

/** The text of one case as the API reads it. */
export function formatCaseText(params, values) {
  return params.map((p) => `${p.name} = ${String(values[p.name] ?? '').trim()}`).join('\n');
}

/** Editable input boxes for a case, prefilled from argument values. */
export function valuesFromArgs(params, args) {
  const values = {};
  params.forEach((p, i) => { values[p.name] = compactJson(args[i]); });
  return values;
}

/** The first problem with the inputs of one case: { param: message } for every box that is not a valid value. */
export function validateCase(params, values) {
  const errors = {};
  params.forEach((p) => {
    const problem = validateInputText(p.type, values[p.name]);
    if (problem) errors[p.name] = problem;
  });
  return errors;
}

/** Parse "nums = [1,2]\ntarget = 3" back into box values (used for tests and for loading text). Unknown lines are ignored. */
export function parseCaseText(params, text) {
  const values = {};
  const names = new Set(params.map((p) => p.name));
  String(text || '').split('\n').forEach((line) => {
    const match = /^\s*([A-Za-z_]\w*)\s*=\s*(.*)$/.exec(line);
    if (match && names.has(match[1])) values[match[1]] = match[2].trim();
  });
  return values;
}

/** Turn the API's 422 body for custom cases ({message, errors:[{case, field, message}]}) into { caseNumber: { field|_: message } }. */
export function caseErrorsFromApi(detail) {
  const out = {};
  const list = detail && typeof detail === 'object' && Array.isArray(detail.errors) ? detail.errors : [];
  list.forEach((e) => {
    const n = e.case ?? 1;
    out[n] = out[n] || {};
    out[n][e.field || '_'] = e.message;
  });
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------------------------------------------------
const GOOD = new Set(['Accepted', 'Passed', 'Finished']);
const BUSY = new Set([VERDICT_BUSY]);

/** 'success' | 'warning' | 'danger' for a verdict or a case status. */
export function verdictTone(status) {
  if (GOOD.has(status)) return 'success';
  if (BUSY.has(status) || status === 'Not run') return 'warning';
  return 'danger';
}

const num = (v, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

function normalizeCase(c, i) {
  return {
    index: num(c?.index, i + 1),
    input: String(c?.input ?? ''),
    custom: Boolean(c?.custom),
    status: String(c?.status ?? 'Not run'),
    passed: typeof c?.passed === 'boolean' ? c.passed : null,
    yourOutput: c?.your_output ?? null,
    expected: c?.expected ?? null,
    runtimeMs: num(c?.runtime_ms),
    stdout: String(c?.stdout ?? ''),
    error: c?.error ?? null,
    errorLine: Number.isInteger(c?.error_line) ? c.error_line : null,
  };
}

const uniqueLines = (...lists) => [...new Set(lists.flat().filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);

/** POST /practice/code/run -> what the Test Result tab shows. */
export function normalizeRunResult(res) {
  const cases = Array.isArray(res?.cases) ? res.cases.map(normalizeCase) : [];
  const status = String(res?.status ?? 'Unknown');
  return {
    kind: 'run',
    status,
    tone: verdictTone(status),
    message: String(res?.message ?? ''),
    compileOutput: String(res?.compile_output ?? ''),
    errorLines: uniqueLines(res?.error_lines || [], cases.map((c) => c.errorLine)),
    runtimeMs: num(res?.runtime_ms),
    memoryKb: Number.isFinite(res?.memory_kb) ? res.memory_kb : null,
    cases,
    passedCount: cases.filter((c) => c.passed === true).length,
    judgedCount: cases.filter((c) => c.passed !== null).length,
  };
}

/** POST /practice/code/submit -> the verdict banner. */
export function normalizeSubmitResult(res) {
  const status = String(res?.status ?? 'Unknown');
  const detail = res?.failed_detail && typeof res.failed_detail === 'object' ? res.failed_detail : null;
  return {
    kind: 'submit',
    status,
    tone: verdictTone(status),
    passedCount: num(res?.passed_count),
    totalCount: num(res?.total_count),
    runtimeMs: num(res?.runtime_ms),
    memoryKb: Number.isFinite(res?.memory_kb) ? res.memory_kb : null,
    expectedComplexity: String(res?.expected_complexity ?? ''),
    failedCase: Number.isInteger(res?.failed_case) ? res.failed_case : null,
    failedDetail: detail && {
      case: num(detail.case),
      input: String(detail.input ?? ''),
      yourOutput: detail.your_output ?? null,
      expected: detail.expected ?? null,
      error: detail.error ?? null,
      errorLine: Number.isInteger(detail.error_line) ? detail.error_line : null,
    },
    message: String(res?.message ?? ''),
    compileOutput: String(res?.compile_output ?? ''),
    errorLines: uniqueLines(res?.error_lines || [], detail && Number.isInteger(detail.error_line) ? [detail.error_line] : []),
    stdout: String(res?.stdout ?? ''),
    testResults: Array.isArray(res?.test_results) ? res.test_results.map((t) => ({ case: num(t.case), passed: t.passed ?? null, isHidden: Boolean(t.is_hidden), status: String(t.status ?? '') })) : [],
  };
}

/** A failed request (401, 413, 429, 503, network) as a message a student can act on. */
export function explainExecutionError(err) {
  const detail = typeof err?.message === 'string' ? err.message : '';
  switch (err?.status) {
    case 401:
      return { tone: 'warning', title: 'Please sign in', message: 'You need to be signed in as a student to run code. Sign in and try again.' };
    case 403:
      return { tone: 'warning', title: 'Student account required', message: 'Only student accounts can run code in the Practice Arena.' };
    case 400:
      return { tone: 'warning', title: 'Cannot run this', message: detail || 'This language or request is not available for this problem.' };
    case 413:
      return { tone: 'warning', title: 'Code too large', message: detail || 'Your code is larger than the allowed limit (20 KB).' };
    case 422:
      return { tone: 'warning', title: 'Check your test cases', message: detail || 'One of the test case inputs could not be read.' };
    case 429:
      if (/online compiler/i.test(detail)) return { tone: 'warning', title: 'Online compiler is busy', message: detail };
      return { tone: 'warning', title: 'Slow down a little', message: 'You are running code too quickly. The limit is 10 runs or submissions per minute. Wait a moment and try again.' };
    case 503:
      if (/online compiler/i.test(detail)) return { tone: 'danger', title: 'Online compiler is busy', message: detail };
      return { tone: 'danger', title: 'Code runner unavailable', message: detail || 'The code runner is not available right now. Please try again later.' };
    default:
      if (err?.isNetworkError || err?.isTimeout || /reach the server|timed out/i.test(detail)) {
        return { tone: 'danger', title: 'Cannot reach the server', message: 'The request did not reach the server. Check your connection and try again.' };
      }
      return { tone: 'danger', title: 'Something went wrong', message: detail || 'The code could not be run. Please try again.' };
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Problem list
// ---------------------------------------------------------------------------------------------------------------------
export function filterProblems(problems, { query = '', difficulty = 'All', topic = 'All', solved = [], status = 'All' } = {}) {
  const q = query.trim().toLowerCase();
  return problems.filter((p) => {
    if (difficulty !== 'All' && p.difficulty !== difficulty) return false;
    if (topic !== 'All' && p.topic !== topic) return false;
    if (status === 'Solved' && !solved.includes(p.slug)) return false;
    if (status === 'Unsolved' && solved.includes(p.slug)) return false;
    if (!q) return true;
    return p.title.toLowerCase().includes(q) || (p.tags || []).some((t) => t.toLowerCase().includes(q)) || (p.topic || '').toLowerCase().includes(q);
  });
}

/** The problem before (-1) or after (+1) `slug` in list order, or null. */
export function neighbour(problems, slug, step) {
  const i = problems.findIndex((p) => p.slug === slug);
  const next = i + step;
  return i >= 0 && next >= 0 && next < problems.length ? problems[next] : null;
}

export function relativeTime(iso, now = Date.now()) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const s = Math.max(0, Math.round((now - then) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`;
  return new Date(then).toLocaleDateString();
}

export function formatMemory(kb) {
  if (!Number.isFinite(kb) || kb <= 0) return '';
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Remembered code and editor settings (per problem + language, in this browser only)
// ---------------------------------------------------------------------------------------------------------------------
const draftKey = (slug, language) => `skillsense.practice.code.${slug}.${language}`;
const SETTINGS_KEY = 'skillsense.practice.editor';
export const DEFAULT_EDITOR_SETTINGS = { fontSize: 14, tabSize: 4 };

function store() {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadDraft(slug, language) {
  try {
    return store()?.getItem(draftKey(slug, language)) ?? null;
  } catch {
    return null;
  }
}

export function saveDraft(slug, language, code) {
  try {
    store()?.setItem(draftKey(slug, language), code);
  } catch { /* storage full or blocked: the code is still in memory */ }
}

export function clearDraft(slug, language) {
  try {
    store()?.removeItem(draftKey(slug, language));
  } catch { /* nothing to clear */ }
}

export function loadEditorSettings() {
  try {
    const raw = JSON.parse(store()?.getItem(SETTINGS_KEY) || 'null');
    const fontSize = [12, 13, 14, 15, 16, 18, 20].includes(raw?.fontSize) ? raw.fontSize : DEFAULT_EDITOR_SETTINGS.fontSize;
    const tabSize = [2, 4, 8].includes(raw?.tabSize) ? raw.tabSize : DEFAULT_EDITOR_SETTINGS.tabSize;
    return { fontSize, tabSize };
  } catch {
    return { ...DEFAULT_EDITOR_SETTINGS };
  }
}

export function saveEditorSettings(settings) {
  try {
    store()?.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}

/** The code to show: the student's own remembered code, else the generated starter. */
export function initialCode(problem, language) {
  return loadDraft(problem.slug, language) ?? problem.starterCode?.[language] ?? '';
}

/** Which languages a problem offers: C is greyed out (with the reason) when its types do not fit. */
export function languageChoices(problem) {
  return LANGUAGES.map(([value, label]) => {
    const disabled = value === 'c' && problem && problem.cAvailable === false;
    return { value, label: disabled ? 'C (not for this problem)' : label, disabled, reason: disabled ? problem.cDisabledReason : '' };
  });
}
