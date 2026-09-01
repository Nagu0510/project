// Automated Unit & Resiliency Test for SkillSense AI Normalization Layer

import {
  safeArray,
  safeObject,
  safeString,
  safeNumber,
  normalizeProblem,
  normalizeProblemList,
  normalizeAssessmentQuestion,
  normalizeAssessmentQuestionsList,
  normalizePreviousQuestion,
  normalizePreviousQuestionList,
  normalizeCareerPath,
  normalizeCareerPathList,
  normalizeRoadmap,
  normalizePlacementJob,
  normalizePlacementJobList,
  normalizeResumeReport,
  normalizeUser,
} from '../src/utils/normalizers.js';

import { mockCodingProblems, mockCodingProblemsList } from '../src/data/mockCodingProblems.js';
import { mockAssessmentQuestions } from '../src/data/mockAssessmentMatches.js';
import { mockCareerPaths } from '../src/data/mockCareerPaths.js';
import { mockPreviousQuestionsList } from '../src/data/mockPreviousQuestions.js';
import { mockPlacementJobs } from '../src/data/mockPlacementJobs.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

console.log('\n========================================');
console.log('1. Testing Safe Primitives with Edge Cases');
console.log('========================================');
assert(Array.isArray(safeArray(null)), 'safeArray(null) returns array');
assert(Array.isArray(safeArray(undefined)), 'safeArray(undefined) returns array');
assert(safeArray({ a: { id: 1 }, b: { id: 2 } }).length === 2, 'safeArray(keyedObject) converts to array');
assert(safeObject(null) && typeof safeObject(null) === 'object', 'safeObject(null) returns safe fallback object');
assert(safeString(undefined, 'default') === 'default', 'safeString(undefined) returns default');
assert(safeNumber('invalid', 42) === 42, 'safeNumber("invalid") returns default');

console.log('\n========================================');
console.log('2. Testing normalizeProblem & ProblemList');
console.log('========================================');
// Test with mock dictionary
const normFromDict = normalizeProblemList(mockCodingProblems);
assert(normFromDict.length >= 2, 'normalizeProblemList handles dictionary of problems');
assert(normFromDict[0].starterCode && typeof normFromDict[0].starterCode.python === 'string', 'starterCode.python is guaranteed string');
assert(Array.isArray(normFromDict[0].testCases), 'testCases is guaranteed array');
assert(Array.isArray(normFromDict[0].examples), 'examples is guaranteed array');
assert(Array.isArray(normFromDict[0].hints), 'hints is guaranteed array');
assert(Array.isArray(normFromDict[0].companies), 'companies is guaranteed array');

// Test with empty / null / partial problem objects
const edgeProblem = normalizeProblem({});
assert(edgeProblem !== null, 'normalizeProblem({}) does not crash');
assert(typeof edgeProblem.starterCode.python === 'string', 'edgeProblem.starterCode.python defaults safely');
assert(edgeProblem.starterCode.python.length > 0, 'edgeProblem has valid default template python code');

// Test with FastAPI snake_case response shape
const backendProblem = normalizeProblem({
  id: 'fastapi-1',
  title: 'Merge Intervals',
  difficulty: 'Medium',
  starter_code: { python: 'def merge(): pass' },
  test_cases: [{ input: '[[1,3],[2,6]]', expected_output: '[[1,6]]', is_hidden: false }],
  previous_match: { company: 'Amazon', exam: 'SDE OA', appearances_count: 8, other_appearances: [] },
});
assert(backendProblem.starterCode.python === 'def merge(): pass', 'snake_case starter_code mapped to camelCase starterCode');
assert(backendProblem.testCases[0].expected === '[[1,6]]', 'snake_case expected_output mapped to camelCase expected');
assert(backendProblem.previouslyAsked.company === 'Amazon', 'snake_case previous_match mapped to previouslyAsked');

console.log('\n========================================');
console.log('3. Testing Assessment Question Normalizer');
console.log('========================================');
const normQuestions = normalizeAssessmentQuestionsList(mockAssessmentQuestions);
assert(normQuestions.length > 0, 'normalizeAssessmentQuestionsList returns questions');
assert(Array.isArray(normQuestions[0].options), 'options is guaranteed array');

const edgeQuestion = normalizeAssessmentQuestion({
  question_text: 'What is the time complexity of binary search?',
  options: ['O(n)', 'O(log n)', 'O(1)'],
  correct_option_index: 1,
});
assert(edgeQuestion.questionText.includes('binary search'), 'question_text mapped to questionText');
assert(edgeQuestion.options.length === 3, 'options preserved');

console.log('\n========================================');
console.log('4. Testing Career Paths & Roadmaps');
console.log('========================================');
const normPaths = normalizeCareerPathList(mockCareerPaths);
assert(normPaths.length > 0, 'normalizeCareerPathList returns paths');
assert(Array.isArray(normPaths[0].requiredSkills), 'requiredSkills is guaranteed array');
assert(Array.isArray(normPaths[0].topCompanies), 'topCompanies is guaranteed array');

const normRoadmap = normalizeRoadmap(null, 'Full Stack Developer');
assert(normRoadmap.careerPath === 'Full Stack Developer', 'normalizeRoadmap handles null data with fallback');
assert(Array.isArray(normRoadmap.milestones), 'milestones is guaranteed array');

console.log('\n========================================');
console.log('5. Testing Resume Analyzer & Placements');
console.log('========================================');
const normResume = normalizeResumeReport({
  overall_score: 88,
  strengths: [{ skill: 'Python', reason: 'High performance' }],
  gaps: [{ skill: 'Docker', reason: 'Missing in experience' }],
});
assert(normResume.overallScore === 88, 'overall_score mapped to overallScore');
assert(Array.isArray(normResume.strengths), 'strengths is guaranteed array');
assert(Array.isArray(normResume.gaps), 'gaps is guaranteed array');

const normPlacements = normalizePlacementJobList(mockPlacementJobs);
assert(normPlacements.length > 0, 'normalizePlacementJobList returns jobs');
assert(Array.isArray(normPlacements[0].requiredSkills), 'requiredSkills is guaranteed array');

console.log('\n========================================');
console.log('6. Testing User Normalizer');
console.log('========================================');
const normUser = normalizeUser({
  name: 'Nagappa',
  career_interest: 'Backend Developer',
  readiness_score: 92,
  strong_skills: ['FastAPI', 'MongoDB'],
});
assert(normUser.name === 'Nagappa', 'user name preserved');
assert(normUser.readinessScore === 92, 'readiness_score mapped to readinessScore');
assert(Array.isArray(normUser.strongSkills), 'strongSkills is guaranteed array');
assert(Array.isArray(normUser.gapSkills), 'gapSkills is guaranteed array');

console.log('\n========================================');
console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
console.log('========================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
