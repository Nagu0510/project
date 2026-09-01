// Central Data Normalization Layer for SkillSense AI
// Translates API snake_case / mock objects into guaranteed, predictable camelCase models

export function safeArray(val) {
  if (Array.isArray(val)) return val;
  if (val && typeof val === 'object') {
    // If it's a keyed map object (like mockCodingProblems = { "two-sum": {...} })
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
    python: `# Python 3.12 solution for ${problem.title || slug}\nclass Solution:\n    def solve(self):\n        pass\n`,
    java: `// Java 21 solution\nclass Solution {\n    public void solve() {\n    }\n}\n`,
    javascript: `// JavaScript solution\nfunction solve() {\n}\n`,
  };

  const starterCode = {
    python: safeString(starterRaw.python, defaultStarter.python),
    java: safeString(starterRaw.java, defaultStarter.java),
    javascript: safeString(starterRaw.javascript, defaultStarter.javascript),
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
        explanation: 'Standard sample test case verification.',
      }));

  const examMatchRaw = safeObject(problem.examMatch || problem.previouslyAsked || problem.previousMatch || problem.previous_match);
  const previouslyAsked = {
    company: safeString(examMatchRaw.company, 'TCS'),
    exam: safeString(examMatchRaw.exam || examMatchRaw.examOrigin || examMatchRaw.exam_origin, 'National Placement Drive'),
    year: safeString(examMatchRaw.year, '2025'),
    similarity: safeString(examMatchRaw.similarity, '94%'),
    frequency: safeNumber(examMatchRaw.frequency || examMatchRaw.appearances || examMatchRaw.appearances_count, 5),
    appearances: safeNumber(examMatchRaw.appearances || examMatchRaw.appearances_count || examMatchRaw.frequency, 5),
    companies: safeArray(examMatchRaw.companies || examMatchRaw.otherCompanies || ['TCS', 'Infosys', 'Accenture']),
  };

  const hints = safeArray(problem.hints).map(String);
  if (hints.length === 0) {
    hints.push("Consider time & space complexity constraints before implementing your solution.");
  }

  return {
    id: safeString(problem.id || slug),
    slug: slug,
    title: safeString(problem.title || problem.name, 'Coding Problem Statement'),
    difficulty: safeString(problem.difficulty, 'Medium'),
    category: safeString(problem.category || problem.topic, 'Data Structures & Algorithms'),
    topic: safeString(problem.topic || problem.category, 'Arrays'),
    subtopic: safeString(problem.subtopic, 'Algorithmic Optimization'),
    description: safeString(problem.description || problem.question_text || problem.questionText, 'No description provided.'),
    starterCode,
    testCases,
    examples,
    hints,
    previouslyAsked,
    examMatch: previouslyAsked,
    companies: safeArray(problem.companies || previouslyAsked.companies),
    appearances: safeNumber(problem.appearances || previouslyAsked.appearances, 5),
    tags: safeArray(problem.tags || ['Frequently Asked', 'Placement Round']),
    constraints: safeArray(problem.constraints || ['Standard execution constraints apply.']),
    aiFeedback: safeObject(problem.aiFeedback, {
      complexity: 'Time Complexity: O(N) | Space Complexity: O(N)',
      strengths: 'Optimized algorithmic approach.',
      suggestions: 'Review edge cases with boundary numbers and null inputs.',
    }),
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
  if (rawMatch && typeof rawMatch === 'object') {
    previousMatch = {
      company: safeString(rawMatch.company, 'TCS'),
      exam: safeString(rawMatch.exam, 'Placement Exam'),
      year: safeString(rawMatch.year, '2025'),
      topic: safeString(rawMatch.topic, q.topic || 'Engineering'),
      difficulty: safeString(rawMatch.difficulty, q.difficulty || 'Medium'),
      similarity: safeNumber(rawMatch.similarity, 90),
      appearancesCount: safeNumber(rawMatch.appearances_count || rawMatch.appearancesCount || rawMatch.appearances, 5),
      appearances: safeNumber(rawMatch.appearances || rawMatch.appearances_count, 5),
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
  const company = safeString(q.company, rawCompanies[0] || 'TCS');
  const companies = rawCompanies.length > 0 ? rawCompanies : [company];

  return {
    id: safeString(q.id, `pq-${idx + 1}`),
    title: safeString(q.title || q.question_text || q.questionText, 'Placement Question'),
    problemSlug: safeString(q.problem_slug || q.problemSlug || q.slug, 'two-sum'),
    questionText: safeString(q.question_text || q.questionText || q.title, ''),
    company: company,
    companies: companies,
    exam: safeString(q.exam, 'Placement Drive'),
    examOrigin: safeString(q.exam_origin || q.examOrigin || `${company} ${q.exam || 'Drive'} — ${q.year || '2025'}`),
    year: safeNumber(q.year, 2025),
    role: safeString(q.role, 'Software Engineer'),
    topic: safeString(q.topic, 'Data Structures'),
    subtopic: safeString(q.subtopic, 'General'),
    difficulty: safeString(q.difficulty, 'Medium'),
    questionType: safeString(q.question_type || q.questionType, 'Coding'),
    frequency: safeNumber(q.frequency || q.appearances, 1),
    appearances: safeNumber(q.appearances || q.frequency, 1),
    badge: safeString(q.badge, 'Frequently Asked'),
    badgeType: safeString(q.badge_type || q.badgeType, 'lime'),
    description: safeString(q.description, 'Placement recurrence pattern verified.'),
    similarity: safeNumber(q.similarity, 90),
    status: safeString(q.status, 'published'),
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

  const rawSkills = safeArray(cp.required_skills || cp.requiredSkills || cp.skills);
  const skills = rawSkills.length > 0 ? rawSkills : ['Python', 'SQL', 'REST APIs'];

  const rawCompanies = safeArray(cp.top_companies || cp.topCompanies);
  const topCompanies = rawCompanies.length > 0 ? rawCompanies : ['TCS Prime', 'Infosys', 'Accenture', 'Amazon'];

  const matchPercentage = safeNumber(cp.match_percentage || cp.matchPercentage || cp.matchScore, 85);
  const averageSalary = safeString(cp.average_salary || cp.averageSalary || cp.avgSalary, '₹ 10.5 LPA');

  return {
    id: safeString(cp.id, `cp-${idx + 1}`),
    title: safeString(cp.title || cp.name, 'Software Engineer'),
    description: safeString(cp.description, 'Core technical development pathway.'),
    matchPercentage: matchPercentage,
    matchScore: matchPercentage,
    skills: skills,
    requiredSkills: skills,
    averageSalary: averageSalary,
    avgSalary: averageSalary,
    activeOpenings: safeNumber(cp.active_openings || cp.activeOpenings, 120),
    roleCount: `${safeNumber(cp.active_openings || cp.activeOpenings, 120)}+ Openings`,
    topCompanies: topCompanies,
    difficulty: safeString(cp.difficulty, 'Medium'),
    demandLevel: safeString(cp.demand_level || cp.demandLevel, 'High Demand'),
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
export function normalizeRoadmap(data, careerFallback = 'Backend Developer') {
  const safeD = safeObject(data);
  const rawMilestones = safeArray(safeD.milestones || safeD.steps);

  const milestones = rawMilestones.map((m, idx) => ({
    id: safeString(m.id, `node-${idx + 1}`),
    number: safeNumber(m.number, idx + 1),
    title: safeString(m.title, `Milestone ${idx + 1}`),
    description: safeString(m.description, 'Structured milestone curriculum.'),
    status: safeString(m.status, idx === 0 ? 'completed' : idx === 3 ? 'in_progress' : 'locked'),
    skills: safeArray(m.skills),
    estimatedTime: safeString(m.estimated_time || m.estimatedTime, `Week ${idx * 2 + 1} - ${idx * 2 + 2}`),
    score: m.score !== undefined ? m.score : null,
    actionLabel: safeString(m.action_label || m.actionLabel, 'Explore Concepts'),
  }));

  return {
    careerPath: safeString(safeD.career_path || safeD.careerPath, careerFallback),
    currentMilestone: safeNumber(safeD.current_milestone || safeD.currentMilestone, 4),
    completionPercentage: safeNumber(safeD.completion_percentage || safeD.completionPercentage, 35),
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
    company: safeString(j.company, 'Tech Corporation'),
    role: safeString(j.role, 'Associate Software Engineer'),
    package: safeString(j.package, '₹7.0 - ₹9.0 LPA'),
    location: safeString(j.location, 'Pan India / Hybrid'),
    deadline: safeString(j.deadline, 'March 30, 2026'),
    matchPercentage: safeNumber(j.match_percentage || j.matchPercentage, 85),
    status: safeString(j.status, 'Ready to Apply'),
    hiringBatch: safeString(j.hiring_batch || j.hiringBatch, '2025 & 2026 Batch'),
    requiredSkills: safeArray(j.required_skills || j.requiredSkills),
    missingSkills: safeArray(j.missing_skills || j.missingSkills),
    description: safeString(j.description, 'Campus recruitment technical drive.'),
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
export function normalizeResumeReport(data, careerFallback = 'Backend Developer') {
  const safeD = safeObject(data);
  const strengths = safeArray(safeD.strengths).map((s) => ({
    skill: safeString(s.skill, 'Core Technology'),
    reason: safeString(s.reason, 'Matches corporate screening criteria.'),
  }));

  const gaps = safeArray(safeD.gaps).map((g) => ({
    skill: safeString(g.skill, 'Architecture Competency'),
    reason: safeString(g.reason, 'Identified in top placement screening benchmarks.'),
  }));

  const overallScore = safeNumber(safeD.overall_score || safeD.overallScore, 80);

  return {
    overallScore: overallScore,
    headline: safeString(safeD.headline, `High ATS Compatibility for ${careerFallback} Roles`),
    recommendedPath: safeString(safeD.recommended_path || safeD.recommendedPath, careerFallback),
    extractedSnippet: safeString(safeD.extracted_text_snippet || safeD.extractedSnippet, ''),
    strengths: strengths.length > 0 ? strengths : [
      { skill: 'Python & Backend Architecture', reason: 'Solid API development skills.' }
    ],
    gaps: gaps.length > 0 ? gaps : [
      { skill: 'System Design & Scalability', reason: 'Recommended for tier-1 recruitment rounds.' }
    ],
    atsCompatibility: safeString(safeD.ats_compatibility || safeD.atsCompatibility, overallScore >= 80 ? 'High' : 'Moderate'),
    parsedSkills: safeArray(safeD.parsed_skills || safeD.parsedSkills),
    missingCriticalSkills: safeArray(safeD.missing_critical_skills || safeD.missingCriticalSkills),
  };
}

// -------------------------------------------------------------
// 8. User & Student Profiles
// -------------------------------------------------------------
export function normalizeUser(user) {
  if (!user || typeof user !== 'object') return null;

  return {
    id: safeString(user.id, 'usr-guest'),
    name: safeString(user.name, 'Student Candidate'),
    email: safeString(user.email, 'student@skillsense.ai'),
    role: safeString(user.role, 'student'),
    college: safeString(user.college, 'Engineering College'),
    department: safeString(user.department, 'Computer Science & Engineering'),
    year: safeString(user.year || user.current_year || user.currentYear, 'Final Year (2026)'),
    careerInterest: safeString(user.career_interest || user.careerInterest || user.career_goal || 'Backend Developer'),
    currentPath: safeString(user.current_path || user.currentPath || user.career_interest || 'Backend Developer'),
    preferredLanguage: safeString(user.preferred_language || user.preferredLanguage, 'Python 3'),
    skillLevel: safeString(user.skill_level || user.skillLevel, 'Intermediate'),
    readinessScore: safeNumber(user.readiness_score || user.readinessScore, 87),
    skillProgress: safeNumber(user.skill_progress || user.skillProgress, 74),
    assessmentsCompleted: safeNumber(user.assessments_completed || user.assessmentsCompleted, 1),
    strongSkills: safeArray(user.strong_skills || user.strongSkills || ['Python', 'SQL', 'REST APIs']),
    gapSkills: safeArray(user.gap_skills || user.gapSkills || ['System Design', 'Docker', 'Kubernetes']),
    avatar: safeString(user.avatar, 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'),
  };
}
