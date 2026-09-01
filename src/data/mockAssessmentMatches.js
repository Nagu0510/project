// Centralized Mock Data: Skill Assessment Questions & Historical Exam Matches

export const mockAssessmentQuestions = [
  {
    id: "eval-q1",
    number: 1,
    title: "Two Sum Target Indices",
    topic: "Arrays & Data Structures",
    subtopic: "Hash Map / Two Pointers",
    difficulty: "Medium",
    questionText:
      "Given an integer array `nums` and an integer `target`, what is the most optimal time and space complexity to find indices of the two numbers such that they add up to target?",
    options: [
      "O(n^2) time with O(1) space using nested brute-force loops",
      "O(n) time with O(n) space using a hash table of complements",
      "O(n log n) time with O(n) space using quick sort only",
      "O(log n) time with O(1) space using binary search on unsorted array",
    ],
    correctOptionIndex: 1,
    previousMatch: {
      company: "TCS",
      exam: "TCS NQT — 2025",
      year: "2025",
      topic: "Arrays",
      difficulty: "Medium",
      similarity: 94,
      appearancesCount: 6,
      otherAppearances: [
        { company: "Infosys", exam: "Online Test", year: "2024" },
        { company: "Accenture", exam: "Coding Round", year: "2026" },
      ],
    },
  },
  {
    id: "eval-q2",
    number: 2,
    title: "Longest Substring Window Traversal",
    topic: "Strings & Algorithms",
    subtopic: "Sliding Window",
    difficulty: "Medium",
    questionText:
      "When finding the length of the longest substring without repeating characters in string `s = 'pwwkew'`, what window pointers and auxiliary data structures are ideal?",
    options: [
      "Two pointers (left and right) with a HashMap storing character frequencies or latest indices",
      "Recursive DFS backtracking checking all substrings without memoization",
      "Single pointer with a fixed-size stack of 256 bytes",
      "Prefix sum array of ASCII integer values",
    ],
    correctOptionIndex: 0,
    previousMatch: {
      company: "Infosys",
      exam: "Infosys Online Assessment — 2026",
      year: "2026",
      topic: "Strings",
      difficulty: "Medium",
      similarity: 91,
      appearancesCount: 5,
      otherAppearances: [
        { company: "TCS", exam: "Digital Cadre", year: "2025" },
        { company: "Cognizant", exam: "GenC Elevate", year: "2024" },
      ],
    },
  },
  {
    id: "eval-q3",
    number: 3,
    title: "Database Indexing & Query Optimization",
    topic: "SQL & Databases",
    subtopic: "B-Tree Indexing & Joins",
    difficulty: "Medium",
    questionText:
      "Which SQL clause or construct is evaluated first by the relational query execution engine in a standard SELECT query?",
    options: [
      "SELECT",
      "WHERE",
      "FROM and JOIN clauses",
      "ORDER BY",
    ],
    correctOptionIndex: 2,
    previousMatch: {
      company: "Accenture",
      exam: "Accenture Coding Round — 2025",
      year: "2025",
      topic: "SQL",
      difficulty: "Medium",
      similarity: 88,
      appearancesCount: 7,
      otherAppearances: [
        { company: "TCS", exam: "Digital Drive", year: "2024" },
        { company: "Deloitte", exam: "National Drive", year: "2025" },
      ],
    },
  },
  {
    id: "eval-q4",
    number: 4,
    title: "Stack Balance & Bracket Verification",
    topic: "Stacks & Data Structures",
    subtopic: "LIFO Ordering",
    difficulty: "Easy",
    questionText:
      "When parsing a string of mixed brackets `'({[]})'`, what is the state of the stack when the second character `'{'` is processed after `'('`?",
    options: [
      "Stack is empty",
      "Stack contains ['(', '{'] with '{' at the top",
      "Stack contains only ['{']",
      "Stack triggers an underflow exception",
    ],
    correctOptionIndex: 1,
    previousMatch: {
      company: "Cognizant",
      exam: "Cognizant GenC — 2025",
      year: "2025",
      topic: "Stacks",
      difficulty: "Easy",
      similarity: 96,
      appearancesCount: 9,
      otherAppearances: [
        { company: "TCS", exam: "NQT", year: "2024" },
        { company: "Infosys", exam: "Online Test", year: "2025" },
      ],
    },
  },
  {
    id: "eval-q5",
    number: 5,
    title: "Distributed Caching & High Availability",
    topic: "System Design & Architecture",
    subtopic: "Cache Eviction Policies",
    difficulty: "Hard",
    questionText:
      "In an LRU (Least Recently Used) cache with capacity 2, after operations: `put(1, A), put(2, B), get(1), put(3, C)`, which key is evicted?",
    options: [
      "Key 1 is evicted because it was added first",
      "Key 2 is evicted because Key 1 was refreshed by get(1)",
      "Key 3 cannot be inserted due to capacity limit",
      "Both Key 1 and Key 2 are evicted simultaneously",
    ],
    correctOptionIndex: 1,
    previousMatch: {
      company: "Amazon",
      exam: "Amazon SDE-1 OA — 2024",
      year: "2024",
      topic: "System Design",
      difficulty: "Hard",
      similarity: 85,
      appearancesCount: 4,
      otherAppearances: [
        { company: "Microsoft", exam: "University Drive", year: "2024" },
      ],
    },
  },
];

export const mockAssessmentData = {
  title: "Full Stack & Backend Technical Skill Evaluation",
  totalQuestions: mockAssessmentQuestions.length,
  durationMinutes: 15,
  passingScore: 70,
  questions: mockAssessmentQuestions,
};
