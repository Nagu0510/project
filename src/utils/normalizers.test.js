import { describe, expect, it } from 'vitest';
import {
  normalizeAssessmentQuestion,
  normalizePlacementJob,
  normalizeRoadmap,
  normalizeUser,
  safeArray,
  safeHttpUrl,
  safeNumber,
  safeObject,
  safeString,
} from './normalizers';

describe('safe helpers never return the wrong type', () => {
  it('safeArray', () => {
    expect(safeArray([1, 2])).toEqual([1, 2]);
    expect(safeArray(null)).toEqual([]);
    expect(safeArray('text')).toEqual([]);
    expect(safeArray({ a: { id: 1 }, b: { id: 2 } })).toEqual([{ id: 1 }, { id: 2 }]); // a keyed map becomes a list
  });
  it('safeString, safeNumber, safeObject', () => {
    expect(safeString(undefined, 'x')).toBe('x');
    expect(safeString(42)).toBe('42');
    expect(safeNumber('abc', 7)).toBe(7);
    expect(safeNumber('12')).toBe(12);
    expect(safeObject([1])).toEqual({});
    expect(safeObject({ a: 1 })).toEqual({ a: 1 });
  });
});

describe('normalizeUser', () => {
  it('invents nothing: an empty user has empty values and zeros', () => {
    const u = normalizeUser({ id: 'u1' });
    expect(u).toMatchObject({ id: 'u1', name: '', college: '', readinessScore: 0, assessmentsCompleted: 0, emailVerified: false, emailNotifications: false });
    expect(u.strongSkills).toEqual([]);
    expect(u.gapSkills).toEqual([]);
  });
  it('maps snake_case from the API and keeps the role the server sent', () => {
    const u = normalizeUser({ id: 'u1', name: 'Asha', role: 'student', current_path: 'Backend Developer', email_verified: true, email_notifications: true, strong_skills: ['Python'] });
    expect(u.currentPath).toBe('Backend Developer');
    expect(u.emailVerified).toBe(true);
    expect(u.emailNotifications).toBe(true);
    expect(u.strongSkills).toEqual(['Python']);
  });
  it('returns null for something that is not a user', () => {
    expect(normalizeUser(null)).toBeNull();
    expect(normalizeUser('x')).toBeNull();
  });
});

describe('normalizeAssessmentQuestion', () => {
  it('keeps the answer key out: a null correct index stays null', () => {
    const q = normalizeAssessmentQuestion({ id: 'q1', question_text: 'What?', options: ['a', 'b', 'c', 'd'], correct_option_index: null, code: 'print(1)' });
    expect(q.options).toEqual(['a', 'b', 'c', 'd']);
    expect(q.questionText).toBe('What?');
    expect(q.code).toBe('print(1)');
    expect(q.correctOptionIndex ?? null).toBeNull();
  });
  it('accepts option objects', () => {
    expect(normalizeAssessmentQuestion({ id: 'q', options: [{ text: 'x' }, 'y'] }).options).toEqual(['x', 'y']);
  });
});

describe('normalizeRoadmap', () => {
  it('carries the priority marker, courses and practice sets', () => {
    const r = normalizeRoadmap({
      career_path: 'Python Developer', current_milestone: 2, completion_percentage: 10,
      milestones: [{ id: 'm1', number: 1, title: 'A', status: 'locked', is_priority_gap: true, courses: [{ slug: 'python-programming', title: 'Python' }], practice_sets: [{ id: 'asm-py-easy' }] }],
    });
    expect(r.careerPath).toBe('Python Developer');
    expect(r.milestones[0]).toMatchObject({ status: 'locked', isPriorityGap: true });
    expect(r.milestones[0].courses[0].slug).toBe('python-programming');
    expect(r.milestones[0].practiceSets).toHaveLength(1);
  });
  it('an empty answer is an empty roadmap, not a made-up one', () => {
    expect(normalizeRoadmap(null, 'X').milestones).toEqual([]);
  });
});

describe('normalizePlacementJob', () => {
  it('shows no match when the server says it is not known', () => {
    const j = normalizePlacementJob({ id: 'j', company: 'Acme', match_percentage: 0, match_known: false, eligibility: { state: 'unknown', message: 'Add CGPA to see eligibility' } });
    expect(j.matchKnown).toBe(false);
    expect(j.eligibility.message).toBe('Add CGPA to see eligibility');
  });
});

describe('application links (security audit M-11)', () => {
  it('keeps http(s) links and drops every other scheme', () => {
    expect(safeHttpUrl('https://careers.example.com/apply?id=1')).toBe('https://careers.example.com/apply?id=1');
    expect(safeHttpUrl('javascript:alert(1)')).toBe('');
    expect(safeHttpUrl('data:text/html,<script>alert(1)</script>')).toBe('');
    expect(safeHttpUrl('not a url')).toBe('');
    expect(safeHttpUrl(undefined)).toBe('');
    expect(normalizePlacementJob({ id: 'j1', company: 'Acme', role: 'Dev', application_link: 'javascript:alert(1)' }).applicationLink).toBe('');
  });
});
