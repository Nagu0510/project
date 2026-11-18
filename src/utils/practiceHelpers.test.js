import { describe, expect, it } from 'vitest';
import {
  caseErrorsFromApi,
  checkValue,
  explainExecutionError,
  filterProblems,
  formatCaseText,
  formatMemory,
  languageChoices,
  neighbour,
  normalizeRunResult,
  normalizeSubmitResult,
  parseCaseText,
  relativeTime,
  validateCase,
  validateInputText,
  valuesFromArgs,
  verdictTone,
} from './practiceHelpers';
import { normalizeProblem } from './normalizers';

const params = [{ name: 'nums', type: 'int[]' }, { name: 'target', type: 'int' }];

describe('test case text', () => {
  it('writes and reads one name = value line per parameter', () => {
    const values = valuesFromArgs(params, [[2, 7, 11, 15], 9]);
    expect(values).toEqual({ nums: '[2,7,11,15]', target: '9' });
    const text = formatCaseText(params, values);
    expect(text).toBe('nums = [2,7,11,15]\ntarget = 9');
    expect(parseCaseText(params, text)).toEqual(values);
    expect(parseCaseText(params, 'target = 9\n\n  nums =[1, 2] \nother = 1')).toEqual({ nums: '[1, 2]', target: '9' });
  });

  it('checks every supported type before anything is sent', () => {
    expect(validateInputText('int', '42')).toBeNull();
    expect(validateInputText('int', '2147483648')).toMatch(/whole number/);
    expect(validateInputText('int', '1.5')).toMatch(/whole number/);
    expect(validateInputText('int', 'three')).toMatch(/Could not read/);
    expect(validateInputText('long', '9007199254740991')).toBeNull();
    expect(validateInputText('long', '9007199254740993')).toMatch(/whole number/);
    expect(validateInputText('double', '2.5')).toBeNull();
    expect(validateInputText('bool', 'true')).toBeNull();
    expect(validateInputText('bool', 'yes')).toMatch(/true or false/);
    expect(validateInputText('string', '"hello"')).toBeNull();
    expect(validateInputText('string', 'hello')).toMatch(/double quotes/);
    expect(validateInputText('string', "'hello'")).toMatch(/double quotes/);
    expect(validateInputText('int[]', '[1,2,3]')).toBeNull();
    expect(validateInputText('int[]', '[1,2,')).toMatch(/list like/);
    expect(validateInputText('int[]', '[1,"a"]')).toMatch(/item 2/);
    expect(validateInputText('string[]', '["a","b"]')).toBeNull();
    expect(validateInputText('int[][]', '[[1,2],[3]]')).toBeNull();
    expect(validateInputText('int[][]', '[1,2]')).toMatch(/item 1/);
    expect(validateInputText('int', '   ')).toBe('Enter a value');
    expect(checkValue(null, 'string')).toMatch(/double quotes/);
  });

  it('collects the boxes that are wrong in one case', () => {
    expect(validateCase(params, { nums: '[1,2]', target: '9' })).toEqual({});
    expect(validateCase(params, { nums: '[1,', target: 'x' })).toEqual({ nums: expect.any(String), target: expect.any(String) });
  });

  it('maps the API field errors onto case numbers', () => {
    const detail = { message: 'x', errors: [{ case: 2, field: 'target', message: 'target is missing' }, { case: 2, field: null, message: 'Write name = value' }, { case: 1, field: 'nums', message: 'bad list' }] };
    expect(caseErrorsFromApi(detail)).toEqual({ 1: { nums: 'bad list' }, 2: { target: 'target is missing', _: 'Write name = value' } });
    expect(caseErrorsFromApi('plain text')).toEqual({});
    expect(caseErrorsFromApi(null)).toEqual({});
  });
});

describe('run and submit results', () => {
  it('normalizes a run: cases, counts, and the lines to mark in the editor', () => {
    const run = normalizeRunResult({
      status: 'Wrong Answer', message: 'Test case 2 of 3 failed', runtime_ms: 5, memory_kb: 2048, error_lines: [3],
      cases: [
        { index: 1, input: 'a = 3\nb = 4', status: 'Passed', passed: true, your_output: '7', expected: '7', runtime_ms: 1, stdout: '', error: null, error_line: null },
        { index: 2, input: 'a = 1\nb = 1', status: 'Runtime Error', passed: false, your_output: null, expected: '2', runtime_ms: 2, stdout: 'debug', error: 'IndexError: x', error_line: 7 },
        { index: 3, input: 'a = 5\nb = 5', custom: true, status: 'Finished', passed: null, your_output: '10', expected: null, runtime_ms: 1 },
      ],
    });
    expect(run).toMatchObject({ kind: 'run', status: 'Wrong Answer', tone: 'danger', passedCount: 1, judgedCount: 2, memoryKb: 2048, errorLines: [3, 7] });
    expect(run.cases[1]).toMatchObject({ yourOutput: null, expected: '2', stdout: 'debug', error: 'IndexError: x', errorLine: 7 });
    expect(run.cases[2]).toMatchObject({ custom: true, passed: null, expected: null });
  });

  it('survives an odd or empty response', () => {
    expect(normalizeRunResult({})).toMatchObject({ status: 'Unknown', cases: [], errorLines: [], memoryKb: null });
    expect(normalizeRunResult(null).cases).toEqual([]);
    expect(normalizeSubmitResult(undefined)).toMatchObject({ status: 'Unknown', passedCount: 0, failedDetail: null, testResults: [] });
  });

  it('normalizes a submit and keeps hidden cases data-free', () => {
    const hidden = normalizeSubmitResult({
      status: 'Wrong Answer', passed_count: 9, total_count: 14, runtime_ms: 12, memory_kb: null, expected_complexity: 'O(n)', failed_case: 11, failed_detail: null,
      message: 'Test case 11 of 14 failed (Wrong Answer).', test_results: [{ case: 1, passed: true, is_hidden: false, status: 'Passed' }, { case: 11, passed: false, is_hidden: true, status: 'Wrong Answer' }],
    });
    expect(hidden).toMatchObject({ tone: 'danger', failedCase: 11, failedDetail: null, expectedComplexity: 'O(n)', memoryKb: null });
    expect(hidden.testResults[1]).toEqual({ case: 11, passed: false, isHidden: true, status: 'Wrong Answer' });
    const shown = normalizeSubmitResult({
      status: 'Runtime Error', failed_case: 1, error_lines: [4],
      failed_detail: { case: 1, input: 'a = 3\nb = 4', your_output: null, expected: '7', error: 'IndexError', error_line: 4 },
    });
    expect(shown.failedDetail).toEqual({ case: 1, input: 'a = 3\nb = 4', yourOutput: null, expected: '7', error: 'IndexError', errorLine: 4 });
    expect(shown.errorLines).toEqual([4]);
    expect(normalizeSubmitResult({ status: 'Accepted' }).tone).toBe('success');
    expect(normalizeSubmitResult({ status: 'Judge unavailable' }).tone).toBe('warning');
  });

  it('classifies verdicts', () => {
    ['Accepted', 'Passed', 'Finished'].forEach((s) => expect(verdictTone(s)).toBe('success'));
    ['Wrong Answer', 'Runtime Error', 'Time Limit Exceeded', 'Compile Error', 'Output Limit Exceeded'].forEach((s) => expect(verdictTone(s)).toBe('danger'));
    ['Judge unavailable', 'Not run'].forEach((s) => expect(verdictTone(s)).toBe('warning'));
  });

  it('explains failed requests in words a student can act on', () => {
    expect(explainExecutionError({ status: 401 }).title).toBe('Please sign in');
    expect(explainExecutionError({ status: 403 }).title).toBe('Student account required');
    expect(explainExecutionError({ status: 413, message: 'Source code is larger than the 20 KB limit.' }).message).toMatch(/20 KB/);
    expect(explainExecutionError({ status: 429, message: 'Too many requests (10 per 1 minute).' }).title).toBe('Slow down a little');
    expect(explainExecutionError({ status: 429, message: 'Online compiler is busy (too many requests), try again in a moment.' }).title).toBe('Online compiler is busy');
    expect(explainExecutionError({ status: 503, message: 'Online compiler is busy, try again in a moment.' })).toMatchObject({ tone: 'danger', title: 'Online compiler is busy' });
    expect(explainExecutionError({ status: 422, message: 'a is missing' })).toMatchObject({ title: 'Check your test cases', message: 'a is missing' });
    expect(explainExecutionError({ isNetworkError: true }).title).toBe('Cannot reach the server');
    expect(explainExecutionError({}).message).not.toBe('');
  });
});

describe('problem list and small helpers', () => {
  const problems = [
    { slug: 'a', title: 'Sum of Two Numbers', difficulty: 'Easy', topic: 'Math', tags: ['math'] },
    { slug: 'b', title: 'Balanced Brackets', difficulty: 'Medium', topic: 'Stack', tags: ['stack', 'strings'] },
    { slug: 'c', title: 'Count the Subsets', difficulty: 'Hard', topic: 'Recursion / DP', tags: ['dp'] },
  ];

  it('filters by search text, difficulty, topic and solved state', () => {
    expect(filterProblems(problems, { query: 'bracket' }).map((p) => p.slug)).toEqual(['b']);
    expect(filterProblems(problems, { query: 'DP' }).map((p) => p.slug)).toEqual(['c']);
    expect(filterProblems(problems, { query: 'strings' }).map((p) => p.slug)).toEqual(['b']);
    expect(filterProblems(problems, { difficulty: 'Hard' }).map((p) => p.slug)).toEqual(['c']);
    expect(filterProblems(problems, { topic: 'Stack' }).map((p) => p.slug)).toEqual(['b']);
    expect(filterProblems(problems, { status: 'Solved', solved: ['a'] }).map((p) => p.slug)).toEqual(['a']);
    expect(filterProblems(problems, { status: 'Unsolved', solved: ['a'] }).map((p) => p.slug)).toEqual(['b', 'c']);
    expect(filterProblems(problems, {})).toHaveLength(3);
  });

  it('finds the previous and next problem', () => {
    expect(neighbour(problems, 'b', 1).slug).toBe('c');
    expect(neighbour(problems, 'b', -1).slug).toBe('a');
    expect(neighbour(problems, 'c', 1)).toBeNull();
    expect(neighbour(problems, 'a', -1)).toBeNull();
    expect(neighbour(problems, 'nope', 1)).toBeNull();
  });

  it('disables C with the reason when the problem does not fit', () => {
    const fits = languageChoices({ cAvailable: true });
    expect(fits.find((c) => c.value === 'c')).toMatchObject({ disabled: false, label: 'C (GCC)' });
    const nope = languageChoices({ cAvailable: false, cDisabledReason: 'C is only offered for simple types.' });
    expect(nope.find((c) => c.value === 'c')).toMatchObject({ disabled: true, reason: 'C is only offered for simple types.' });
    expect(nope.filter((c) => c.disabled)).toHaveLength(1);
  });

  it('formats time and memory', () => {
    const now = Date.parse('2026-10-10T12:00:00Z');
    expect(relativeTime('2026-10-10T11:59:50Z', now)).toBe('just now');
    expect(relativeTime('2026-10-10T11:30:00Z', now)).toBe('30 min ago');
    expect(relativeTime('2026-10-10T09:00:00Z', now)).toBe('3 h ago');
    expect(relativeTime('2026-10-07T12:00:00Z', now)).toBe('3 d ago');
    expect(relativeTime('garbage', now)).toBe('');
    expect(formatMemory(2048)).toBe('2.0 MB');
    expect(formatMemory(512)).toBe('512 KB');
    expect(formatMemory(null)).toBe('');
  });
});

describe('problem normalizer (function-style)', () => {
  it('reads the API shape and never invents starter code or hidden data', () => {
    const p = normalizeProblem({
      id: 'cp-05', slug: 'pair-sum-exists', title: 'Pair With a Given Sum', difficulty: 'Medium', difficulty_rank: 5, topic: 'Hashing', tags: ['hashing'],
      description: 'Return true if...', constraints: ['1 <= n'], function_name: 'hasPairWithSum', params: [{ name: 'nums', type: 'int[]' }, { name: 'target', type: 'int' }],
      return_type: 'bool', examples: [{ input: 'nums = [1]\ntarget = 2', output: 'false', explanation: '' }], example_args: [[[1], 2]],
      starter_code: { python: 'class Solution:\n    pass\n' }, c_available: false, c_disabled_reason: 'no', time_limit_ms: 2000, expected_complexity: 'O(n)',
      hint_count: 3, total_cases: 14, shown_cases: 2, submissions_count: 4, acceptance_rate: 50,
    });
    expect(p).toMatchObject({ functionName: 'hasPairWithSum', returnType: 'bool', cAvailable: false, timeLimitMs: 2000, hintCount: 3, acceptanceRate: 50, exampleArgs: [[[1], 2]] });
    expect(p.starterCode).toEqual({ python: 'class Solution:\n    pass\n' });  // other languages stay empty, no stdin template
    expect(p.hints).toBeUndefined();
    expect(p.testCases).toBeUndefined();
    expect(normalizeProblem({ slug: 'x', title: 'X', acceptance_rate: null }).acceptanceRate).toBeNull();
    expect(normalizeProblem({ slug: 'x', title: 'X' }).cAvailable).toBe(true);
  });
});
