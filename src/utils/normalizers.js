import { formatExamOrigin } from './examOrigin';
// Central Data Normalization Layer for SkillSense AI
// Translates API snake_case / mock objects into guaranteed, predictable camelCase models

export function safeArray(val) {
  if (Array.isArray(val)) return val;
  if (val && typeof val === 'object') {
    // If it's a keyed map object ({ slug: {...} })
    const values = Object.values(val);
    if (values.length > 0 && typeof values[0] === 'object') {
      return values;
    }
  }
  return [];
}

export function safeObject(val, fallback = {}) {
  return val && typeof val === 'object' && !Array.isArray(val) ? val : fallback;
}

export function safeString(val, fallback = '') {
  return typeof val === 'string' ? val : (val ? String(val) : fallback);
}

export function safeNumber(val, fallback = 0) {
  const n = Number(val);
  return isNaN(n) ? fallback : n;
}

// -------------------------------------------------------------
// 1. Coding Practice Problems
// -------------------------------------------------------------
export function normalizeProblem(problem) {
  if (!problem || typeof problem !== 'object') return null;

  const slug = safeString(problem.slug || problem.id || problem.problemSlug, 'problem-unknown');
  const starterRaw = problem.starterCode || problem.starter_code || {};

  const defaultStarter = {
    python: `# Python 3 solution for ${problem.title || slug}\nimport sys\ns = sys.stdin.read().strip()\nprint(s)\n`,
    java: `// Java 21 solution\nimport java.util.Scanner;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        if (sc.hasNextLine()) System.out.println(sc.nextLine());\n    }\n}\n`,
    c: `// C solution\n#include <stdio.h>\nint main() {\n    char s[1000];\n    if (fgets(s, sizeof(s), stdin)) printf("%s", s);\n    return 0;\n}\n`,
    cpp: `// C++ solution\n#include <iostream>\n#include <string>\nusing namespace std;\nint main() {\n    string s;\n    if (getline(cin, s)) cout << s << endl;\n    return 0;\n}\n`,
    javascript: `// JavaScript solution\nconst fs = require('fs');\nconst input = fs.readFileSync(0, 'utf-8');\nconsole.log(input.trim());\n`,
  };

  const starterCode = {
    python: safeString(starterRaw.python, defaultStarter.python),
    java: safeString(starterRaw.java, defaultStarter.java),
    c: safeString(starterRaw.c, defaultStarter.c),
    cpp: safeString(starterRaw.cpp || starterRaw['c++'], defaultStarter.cpp),
    javascript: safeString(starterRaw.javascript || starterRaw.js, defaultStarter.javascript),
  };

  const rawTestCases = safeArray(problem.testCases || problem.test_cases);
  const testCases = rawTestCases.map((tc, idx) => ({
    id: tc.id ?? idx + 1,
    name: tc.name || `Test Case ${idx + 1}`,
    input: safeString(tc.input, ''),
    expected: safeString(tc.expected || tc.expected_output || tc.output, ''),
    isHidden: Boolean(tc.isHidden || tc.is_hidden),
  }));

  const rawExamples = safeArray(problem.examples);
  const examples = rawExamples.length > 0
    ? rawExamples.map((ex, idx) => ({
        id: ex.id ?? idx + 1,
        input: safeString(ex.input, ''),
        output: safeString(ex.output, ''),
        explanation: safeString(ex.explanation, ''),
      }))
    : testCases.slice(0, 2).map((tc, idx) => ({
        id: idx + 1,
        input: tc.input,
        output: tc.expected,
        explanation: '',
      }));

  const examMatchRaw = problem.examMatch || problem.previouslyAsked || problem.previousMatch || problem.previous_match;
  let previouslyAsked = null;
  if (examMatchRaw && typeof examMatchRaw === 'object' && (examMatchRaw.company || examMatchRaw.matched)) {
    previouslyAsked = {
      company: safeString(examMatchRaw.company, ''),
      exam: safeString(examMatchRaw.exam || examMatchRaw.examOrigin || examMatchRaw.exam_origin, ''),
      year: safeString(examMatchRaw.year, ''),
      similarity: safeString(examMatchRaw.similarity, '90%'),
      frequency: safeNumber(examMatchRaw.frequency || examMatchRaw.appearances || examMatchRaw.appearances_count, 1),
      appearances: safeNumber(examMatchRaw.appearances || examMatchRaw.appearances_count || examMatchRaw.frequency, 1),
      companies: safeArray(examMatchRaw.companies || (examMatchRaw.company ? [examMatchRaw.company] : [])),
    };
  }

  const hints = safeArray(problem.hints).map(String);

  return {
    id: safeString(problem.id || slug),
    slug: slug,
    title: safeString(problem.title || problem.name, 'Untitled problem'),
    difficulty: safeString(problem.difficulty, ''),
    category: safeString(problem.category || problem.topic, ''),
    topic: safeString(problem.topic || problem.category, ''),
    subtopic: safeString(problem.subtopic, ''),
    description: safeString(problem.description || problem.question_text || problem.questionText, ''),
    inputFormat: safeString(problem.input_format || problem.inputFormat, ''),
    outputFormat: safeString(problem.output_format || problem.outputFormat, ''),
    starterCode,
    testCases,
    examples,
    hints,
    previouslyAsked,
    examMatch: previouslyAsked,
    companies: safeArray(problem.companies),
    appearances: safeNumber(problem.appearances, 0),
    tags: safeArray(problem.tags),
    constraints: safeArray(problem.constraints),
  };
}

export function normalizeProblemList(data) {
  if (!data) return [];
  const rawList = Array.isArray(data)
    ? data
    : Array.isArray(data.problems)
    ? data.problems
    : Array.isArray(data.items)
    ? data.items
    : typeof data === 'object'
    ? Object.values(data)
    : [];

  return rawList
    .map(normalizeProblem)
    .filter((p) => p !== null && Boolean(p.title));
}

// -------------------------------------------------------------
// 2. Assessment Questions
// -------------------------------------------------------------
export function normalizeAssessmentQuestion(q, index = 0) {
  if (!q || typeof q !== 'object') return null;

  const rawOptions = safeArray(q.options);
  const options = rawOptions.map((opt) => {
    if (typeof opt === 'string') return opt;
    return safeString(opt?.text || opt?.label || opt?.value, 'Option');
  });

  const rawMatch = q.previous_match || q.previousMatch;
  let previousMatch = null;
  if (rawMatch && typeof rawMatch === 'object' && rawMatch.company) {
    previousMatch = {
      company: safeString(rawMatch.company),
      exam: safeString(rawMatch.exam, 'Placement Exam'),
      year: safeString(rawMatch.year, '2025'),
      topic: safeString(rawMatch.topic, q.topic || 'Engineering'),
      difficulty: safeString(rawMatch.difficulty, q.difficulty || 'Medium'),
      similarity: safeNumber(rawMatch.similarity, 90),
      appearancesCount: safeNumber(rawMatch.appearances_count || rawMatch.appearancesCount || rawMatch.appearances, 1),
      appearances: safeNumber(rawMatch.appearances || rawMatch.appearances_count, 1),
      otherAppearances: safeArray(rawMatch.other_appearances || rawMatch.otherAppearances),
    };
  }

  return {
    id: safeString(q.id, `eval-q-${index + 1}`),
    number: safeNumber(q.number, index + 1),
    title: safeString(q.title || q.question_text || q.questionText, `Question ${index + 1}`),
    topic: safeString(q.topic, 'General CS'),
    subtopic: safeString(q.subtopic, 'Core Knowledge'),
    difficulty: safeString(q.difficulty, 'Medium'),
    questionText: safeString(q.question_text || q.questionText || q.title, 'Question Statement'),
    options: options.length > 0 ? options : ['Option A', 'Option B', 'Option C', 'Option D'],
    correctOptionIndex: q.correct_option_index ?? q.correctOptionIndex ?? null,
    questionType: safeString(q.question_type || q.questionType, ''),
    skill: safeString(q.skill, ''),
    code: safeString(q.code, ''),
    language: safeString(q.language, ''),
    companies: safeArray(q.companies).map(String), // "pattern-inspired practice" tags, never real past questions
    previousMatch,
  };
}

export function normalizeAssessmentQuestionsList(data) {
  if (!data) return [];
  const rawList = Array.isArray(data)
    ? data
    : Array.isArray(data.questions)
    ? data.questions
    : Array.isArray(data.items)
    ? data.items
    : typeof data === 'object'
    ? Object.values(data)
    : [];

  return rawList
    .map((q, idx) => normalizeAssessmentQuestion(q, idx))
    .filter((q) => q !== null);
}

// -------------------------------------------------------------
// 3. Previous Questions Archive
// -------------------------------------------------------------
export function normalizePreviousQuestion(q, idx = 0) {
  if (!q || typeof q !== 'object') return null;

  const rawCompanies = safeArray(q.companies);
  const company = safeString(q.company, rawCompanies[0] || '');
  const companies = rawCompanies.length > 0 ? rawCompanies : (company ? [company] : []);
  const year = q.year === undefined || q.year === null || q.year === '' ? null : safeNumber(q.year, null);

  return {
    id: safeString(q.id, `pq-${idx + 1}`),
    title: safeString(q.title || q.question_text || q.questionText, 'Placement question'),
    problemSlug: safeString(q.problem_slug || q.problemSlug || q.slug, ''),
    questionText: safeString(q.question_text || q.questionText || q.title, ''),
    company,
    companies,
    exam: safeString(q.exam, ''),
    examOrigin: safeString(q.exam_origin || q.examOrigin || formatExamOrigin(company, q.exam, year)),
    year,
    role: safeString(q.role, ''),
    topic: safeString(q.topic, ''),
    subtopic: safeString(q.subtopic, ''),
    difficulty: safeString(q.difficulty, ''),
    questionType: safeString(q.question_type || q.questionType, ''),
    frequency: safeNumber(q.frequency ?? q.appearances, 0),
    appearances: safeNumber(q.appearances ?? q.frequency, 0),
    badge: safeString(q.badge, ''),
    badgeType: safeString(q.badge_type || q.badgeType, 'lime'),
    description: safeString(q.description, ''),
    similarity: safeNumber(q.similarity, 0),
    status: safeString(q.status, ''),
    historicalOccurrences: safeArray(q.historical_occurrences || q.historicalOccurrences),
  };
}

export function normalizePreviousQuestionList(data) {
  if (!data) return [];
  const rawList = Array.isArray(data)
    ? data
    : Array.isArray(data.previous_questions)
    ? data.previous_questions
    : Array.isArray(data.items)
    ? data.items
    : typeof data === 'object'
    ? Object.values(data)
    : [];

  return rawList
    .map((q, idx) => normalizePreviousQuestion(q, idx))
    .filter((q) => q !== null);
}

// -------------------------------------------------------------
// 4. Career Paths
// -------------------------------------------------------------
export function normalizeCareerPath(cp, idx = 0) {
  if (!cp || typeof cp !== 'object') return null;

  const skills = safeArray(cp.required_skills || cp.requiredSkills || cp.skills);
  const topCompanies = safeArray(cp.top_companies || cp.topCompanies);
  const averageSalary = safeString(cp.average_salary || cp.averageSalary || cp.avgSalary, '');

  return {
    id: safeString(cp.id, `cp-${idx + 1}`),
    slug: safeString(cp.slug || cp.id, ''),
    title: safeString(cp.title || cp.name, 'Career path'),
    description: safeString(cp.description, ''),
    skills,
    requiredSkills: skills,
    averageSalary,
    avgSalary: averageSalary,
    topCompanies,
    difficulty: safeString(cp.difficulty, ''),
    demandLevel: safeString(cp.demand_level || cp.demandLevel, ''),
  };
}

export function normalizeCareerPathList(data) {
  if (!data) return [];
  const rawList = Array.isArray(data)
    ? data
    : Array.isArray(data.career_paths)
    ? data.career_paths
    : Array.isArray(data.items)
    ? data.items
    : typeof data === 'object'
    ? Object.values(data)
    : [];

  return rawList
    .map((cp, idx) => normalizeCareerPath(cp, idx))
    .filter((cp) => cp !== null);
}

// -------------------------------------------------------------
// 5. Roadmaps
// -------------------------------------------------------------
export function normalizeRoadmap(data, careerFallback = '') {
  const safeD = safeObject(data);
  const rawMilestones = safeArray(safeD.milestones || safeD.steps);

  const milestones = rawMilestones.map((m, idx) => ({
    id: safeString(m.id, `node-${idx + 1}`),
    number: safeNumber(m.number, idx + 1),
    title: safeString(m.title, `Milestone ${idx + 1}`),
    description: safeString(m.description, ''),
    status: safeString(m.status, 'not_started'),
    skills: safeArray(m.skills),
    estimatedTime: safeString(m.estimated_time || m.estimatedTime, ''),
    score: m.score !== undefined ? m.score : null,
    actionLabel: safeString(m.action_label || m.actionLabel, 'Explore Concepts'),
    isPriorityGap: Boolean(m.is_priority_gap ?? m.isPriorityGap),
    courses: safeArray(m.courses),
    practiceSets: safeArray(m.practice_sets || m.practiceSets),
  }));

  return {
    careerPath: safeString(safeD.career_path || safeD.careerPath, careerFallback),
    currentMilestone: safeNumber(safeD.current_milestone ?? safeD.currentMilestone, 1),
    completionPercentage: safeNumber(safeD.completion_percentage ?? safeD.completionPercentage, 0),
    milestones: milestones,
  };
}

// -------------------------------------------------------------
// 6. Placements
// -------------------------------------------------------------
export function normalizePlacementJob(j, idx = 0) {
  if (!j || typeof j !== 'object') return null;

  return {
    id: safeString(j.id, `job-${idx + 1}`),
    company: safeString(j.company, ''),
    role: safeString(j.role, ''),
    package: safeString(j.package, ''),
    location: safeString(j.location, ''),
    deadline: safeString(j.deadline, ''),
    matchPercentage: safeNumber(j.match_percentage ?? j.matchPercentage, 0),
    matchKnown: Boolean(j.match_known ?? j.matchKnown ?? false),
    eligibility: j.eligibility && typeof j.eligibility === 'object' ? j.eligibility : null,
    minimumCgpa: j.minimum_cgpa ?? j.minimumCgpa ?? null,
    eligibleBranches: safeArray(j.eligible_branches || j.eligibleBranches),
    graduationYear: j.graduation_year ?? j.graduationYear ?? null,
    status: safeString(j.status, ''),
    hiringBatch: safeString(j.hiring_batch || j.hiringBatch, ''),
    requiredSkills: safeArray(j.required_skills || j.requiredSkills),
    missingSkills: safeArray(j.missing_skills || j.missingSkills),
    applicationLink: safeString(j.application_link || j.applicationLink, ''),
    description: safeString(j.description, ''),
  };
}

export function normalizePlacementJobList(data) {
  if (!data) return [];
  const rawList = Array.isArray(data)
    ? data
    : Array.isArray(data.placements)
    ? data.placements
    : Array.isArray(data.items)
    ? data.items
    : typeof data === 'object'
    ? Object.values(data)
    : [];

  return rawList
    .map((j, idx) => normalizePlacementJob(j, idx))
    .filter((j) => j !== null);
}

// -------------------------------------------------------------
// 7. Resume Analysis
// -------------------------------------------------------------
export function normalizeResumeReport(data, careerFallback = '') {
  const d = safeObject(data);
  // Nothing here invents a score, a company or a skill: a missing value stays empty or zero.
  const detectedSkills = safeArray(d.detected_skills || d.detectedSkills || d.parsed_skills);
  const missingSkills = safeArray(d.missing_skills || d.missingSkills || d.missing_critical_skills);
  const jdRaw = d.jd && typeof d.jd === 'object' ? d.jd : null;
  const cmpRaw = d.comparison && typeof d.comparison === 'object' ? d.comparison : null;
  const overallScore = safeNumber(d.overall_score ?? d.overallScore, 0);

  return {
    overallScore,
    scoreLabel: safeString(d.score_label, 'ATS-style score (estimate)'),
    headline: safeString(d.headline, ''),
    recommendedPath: safeString(d.recommended_path || d.recommendedPath, careerFallback),
    extractedSnippet: safeString(d.extracted_text_snippet || d.extractedSnippet, ''),
    extractedText: safeString(d.extracted_text, ''),
    textHash: safeString(d.text_hash, ''),
    analysisId: safeString(d.analysis_id, ''),
    source: safeString(d.source, ''),
    detectedSkills,
    strongSkills: safeArray(d.strong_skills || d.strongSkills),
    missingSkills,
    strengths: safeArray(d.strengths).map((s) => ({ skill: safeString(s.skill), reason: safeString(s.reason) })),
    gaps: safeArray(d.gaps).map((g) => ({ skill: safeString(g.skill), reason: safeString(g.reason) })),
    companyMatches: safeArray(d.company_matches || d.companyMatches).map((c) => ({
      company: safeString(c.company),
      role: safeString(c.role),
      matchPercentage: safeNumber(c.match_percentage ?? c.matchPercentage, 0),
      status: safeString(c.status),
      missingSkills: safeArray(c.missing_skills || c.missingSkills),
      location: safeString(c.location),
    })),
    recommendations: safeArray(d.recommendations),
    atsCompatibility: safeString(d.ats_compatibility || d.atsCompatibility, ''),
    parsedSkills: detectedSkills,
    missingCriticalSkills: missingSkills,

    categories: safeArray(d.categories).map((c) => ({
      key: safeString(c.key),
      label: safeString(c.label),
      score: safeNumber(c.score, 0),
      max: safeNumber(c.max, 0),
      explanation: safeString(c.explanation),
    })),
    fixes: safeArray(d.fixes).map((f) => ({
      rank: safeNumber(f.rank, 0),
      category: safeString(f.category),
      title: safeString(f.title),
      detail: safeString(f.detail),
      points: safeNumber(f.points, 0),
      example: safeString(f.example),
      courseSlug: f.course_slug || null,
      courseTitle: safeString(f.course_title, ''),
    })),
    skills: safeArray(d.skills).map((s) => ({
      name: safeString(s.name),
      category: safeString(s.category),
      evidence: safeString(s.evidence, 'claimed'),
      required: Boolean(s.required),
      note: safeString(s.note),
    })),
    roleMatch: safeNumber(d.role_match, 0),
    matchedRequirements: safeArray(d.matched_requirements),
    missingRequirements: safeArray(d.missing_requirements),
    jd: jdRaw && {
      keywords: safeArray(jdRaw.keywords),
      matched: safeArray(jdRaw.matched),
      missing: safeArray(jdRaw.missing),
      matchPercent: jdRaw.match_percent === null || jdRaw.match_percent === undefined ? null : safeNumber(jdRaw.match_percent, 0),
      note: safeString(jdRaw.note),
    },
    bulletCoach: safeArray(d.bullet_coach).map((b) => ({
      original: safeString(b.original),
      issues: safeArray(b.issues),
      advice: safeString(b.advice),
      template: safeString(b.template),
      templateNote: safeString(b.template_note),
    })),
    learningSteps: safeArray(d.learning_steps).map((l) => ({
      skill: safeString(l.skill),
      title: safeString(l.title),
      courseSlug: l.course_slug || null,
      kind: safeString(l.kind, 'plain'),
    })),
    comparison: cmpRaw && {
      previousScore: safeNumber(cmpRaw.previous_score, 0),
      delta: safeNumber(cmpRaw.delta, 0),
      previousDate: safeString(cmpRaw.previous_date),
      changes: safeArray(cmpRaw.changes),
    },

    ocrUsed: Boolean(d.ocr_used),
    ocrEngine: safeString(d.ocr_engine),
    ocrConfidence: d.ocr_confidence === null || d.ocr_confidence === undefined ? null : safeNumber(d.ocr_confidence, 0),
    pagesProcessed: safeNumber(d.pages_processed, 1),
    warnings: safeArray(d.warnings).map(String),
  };
}

export function normalizeResumeHistory(data) {
  return safeArray(data).map((h) => ({
    createdAt: safeString(h.created_at),
    overallScore: safeNumber(h.overall_score, 0),
    careerPath: safeString(h.career_path),
    jdUsed: Boolean(h.jd_used),
    jdMatch: h.jd_match === null || h.jd_match === undefined ? null : safeNumber(h.jd_match, 0),
    ocrUsed: Boolean(h.ocr_used),
    ocrConfidence: h.ocr_confidence === null || h.ocr_confidence === undefined ? null : safeNumber(h.ocr_confidence, 0),
    source: safeString(h.source),
  }));
}

// -------------------------------------------------------------
// 8. User & Student Profiles
// -------------------------------------------------------------
export function normalizeUser(user) {
  if (!user || typeof user !== 'object') return null;

  // Missing values stay empty/zero: nothing here invents profile data or scores.
  const pick = (...vals) => vals.find((v) => v !== undefined && v !== null);

  return {
    id: safeString(user.id),
    name: safeString(user.name),
    email: safeString(user.email),
    role: safeString(user.role, 'student'),
    college: safeString(user.college),
    department: safeString(user.department),
    year: safeString(pick(user.year, user.current_year, user.currentYear)),
    careerInterest: safeString(pick(user.career_interest, user.careerInterest, user.career_goal)),
    currentPath: safeString(pick(user.current_path, user.currentPath, user.career_interest, user.careerInterest)),
    preferredLanguage: safeString(pick(user.preferred_language, user.preferredLanguage)),
    skillLevel: safeString(pick(user.skill_level, user.skillLevel)),
    readinessScore: safeNumber(pick(user.readiness_score, user.readinessScore), 0),
    skillProgress: safeNumber(pick(user.skill_progress, user.skillProgress), 0),
    assessmentsCompleted: safeNumber(pick(user.assessments_completed, user.assessmentsCompleted), 0),
    strongSkills: safeArray(pick(user.strong_skills, user.strongSkills) ?? []),
    gapSkills: safeArray(pick(user.gap_skills, user.gapSkills) ?? []),
    picture: safeString(user.picture),
    emailVerified: Boolean(pick(user.email_verified, user.emailVerified, false)),
    emailNotifications: Boolean(pick(user.email_notifications, user.emailNotifications, false)),
    authProvider: safeString(pick(user.auth_provider, user.authProvider), 'password'),
    hasPassword: Boolean(pick(user.has_password, user.hasPassword, true)),
  };
}
