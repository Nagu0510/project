// Centralized Mock Data: Coding Practice Problems across Easy, Medium, Hard Tiers

export const mockCodingProblems = {
  "reverse-string": {
    id: "reverse-string",
    slug: "reverse-string",
    title: "Reverse a String",
    difficulty: "Easy",
    topic: "Strings",
    subtopic: "Two Pointers",
    tags: ["Core Foundational", "Frequently Asked"],
    examMatch: {
      company: "TCS",
      exam: "TCS NQT — 2025",
      similarity: "95%",
      appearances: 8,
      otherCompanies: ["Infosys", "Cognizant"],
    },
    previouslyAsked: {
      company: "TCS",
      exam: "TCS NQT — 2025",
      similarity: "95%",
      appearances: 8,
      companies: ["TCS", "Cognizant", "Infosys"],
    },
    description: `Write a function that reverses a string. The input string is given as an array of characters \`s\`.\n\nYou must do this by modifying the input array in-place with O(1) extra memory.`,
    examples: [
      {
        id: 1,
        input: "s = ['h','e','l','l','o']",
        output: "['o','l','l','e','h']",
        explanation: "Reversed string in place.",
      },
    ],
    constraints: ["1 <= s.length <= 10^5", "s[i] is a printable ascii character."],
    hints: ["Use two pointers starting from left and right and swap them towards the center."],
    starterCode: {
      python: `class Solution:
    def reverseString(self, s: list[str]) -> None:
        left, right = 0, len(s) - 1
        while left < right:
            s[left], s[right] = s[right], s[left]
            left += 1
            right -= 1
`,
      java: `class Solution {
    public void reverseString(char[] s) {
        int left = 0, right = s.length - 1;
        while (left < right) {
            char temp = s[left];
            s[left] = s[right];
            s[right] = temp;
            left++;
            right--;
        }
    }
}
`,
      javascript: `function reverseString(s) {
    let left = 0, right = s.length - 1;
    while (left < right) {
        const temp = s[left];
        s[left] = s[right];
        s[right] = temp;
        left++;
        right--;
    }
}
`,
    },
    testCases: [
      { id: 1, name: "Test Case 1", input: "s = ['h','e','l','l','o']", expected: "['o','l','l','e','h']" },
      { id: 2, name: "Test Case 2", input: "s = ['H','a','n','n','a','h']", expected: "['h','a','n','n','a','H']" },
    ],
    aiFeedback: {
      complexity: "Time Complexity: O(n) | Space Complexity: O(1)",
      strengths: "In-place two pointer swap satisfies O(1) auxiliary space requirement.",
      suggestions: "Validate even vs odd length character array parity.",
    },
  },

  "valid-parentheses": {
    id: "valid-parentheses",
    slug: "valid-parentheses",
    title: "Valid Parentheses (Bracket Verification)",
    difficulty: "Easy",
    topic: "Stacks",
    subtopic: "LIFO Evaluation",
    tags: ["Universal Classic", "High Priority"],
    examMatch: {
      company: "Cognizant",
      exam: "Cognizant GenC — 2025",
      similarity: "96%",
      appearances: 9,
      otherCompanies: ["TCS", "Infosys", "Wipro"],
    },
    previouslyAsked: {
      company: "Cognizant",
      exam: "Cognizant GenC — 2025",
      similarity: "96%",
      appearances: 9,
      companies: ["Cognizant", "TCS", "Infosys", "Wipro"],
    },
    description: `Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.`,
    examples: [
      {
        id: 1,
        input: "s = '()[]{}'",
        output: "true",
        explanation: "All brackets close in appropriate order.",
      },
      {
        id: 2,
        input: "s = '(]'",
        output: "false",
        explanation: "Mismatched bracket pair.",
      },
    ],
    constraints: ["1 <= s.length <= 10^4", "s consists of parentheses only '()[]{}'."],
    hints: ["Use a stack to push matching opening brackets."],
    starterCode: {
      python: `class Solution:
    def isValid(self, s: str) -> bool:
        stack = []
        mapping = {')': '(', '}': '{', ']': '['}
        for char in s:
            if char in mapping:
                top = stack.pop() if stack else '#'
                if mapping[char] != top:
                    return False
            else:
                stack.append(char)
        return not stack
`,
      java: `import java.util.Stack;
class Solution {
    public boolean isValid(String s) {
        Stack<Character> stack = new Stack<>();
        for (char c : s.toCharArray()) {
            if (c == '(') stack.push(')');
            else if (c == '{') stack.push('}');
            else if (c == '[') stack.push(']');
            else if (stack.isEmpty() || stack.pop() != c) return false;
        }
        return stack.isEmpty();
    }
}
`,
      javascript: `function isValid(s) {
    const stack = [];
    for (const c of s) {
        if (c === '(') stack.push(')');
        else if (c === '{') stack.push('}');
        else if (c === '[') stack.push(']');
        else if (stack.length === 0 || stack.pop() !== c) return false;
    }
    return stack.length === 0;
}
`,
    },
    testCases: [
      { id: 1, name: "Test Case 1", input: "s = '()[]{}'", expected: "true" },
      { id: 2, name: "Test Case 2", input: "s = '(]'", expected: "false" },
    ],
    aiFeedback: {
      complexity: "Time Complexity: O(n) | Space Complexity: O(n)",
      strengths: "Stack matching ensures exact LIFO resolution.",
      suggestions: "Check edge cases with single character strings.",
    },
  },

  "two-sum": {
    id: "two-sum",
    slug: "two-sum",
    title: "Two Sum (Array Traversal)",
    difficulty: "Medium",
    topic: "Arrays",
    subtopic: "Hash Map / Two Pointers",
    tags: ["Frequently Asked", "Previously Asked", "High Priority"],
    examMatch: {
      company: "TCS",
      exam: "TCS NQT — 2025",
      similarity: "94%",
      appearances: 6,
      otherCompanies: ["Infosys", "Accenture"],
    },
    previouslyAsked: {
      company: "TCS",
      exam: "TCS NQT — 2025",
      similarity: "94%",
      appearances: 6,
      companies: ["TCS", "Infosys", "Accenture"],
    },
    description: `Given an array of integers \`nums\` and an integer \`target\`, return *indices of the two numbers such that they add up to \`target\`*.

You may assume that each input would have **exactly one solution**, and you may not use the same element twice.

You can return the answer in any order.`,
    examples: [
      {
        id: 1,
        input: "nums = [2,7,11,15], target = 9",
        output: "[0,1]",
        explanation: "Because nums[0] + nums[1] == 9, we return [0, 1].",
      },
      {
        id: 2,
        input: "nums = [3,2,4], target = 6",
        output: "[1,2]",
        explanation: "Because nums[1] + nums[2] == 6, we return [1, 2].",
      },
    ],
    constraints: [
      "2 <= nums.length <= 10^4",
      "-10^9 <= nums[i] <= 10^9",
      "-10^9 <= target <= 10^9",
      "Only one valid answer exists.",
    ],
    hints: [
      "A really brute force way would be to search for all possible pairs of numbers but that would be O(N^2) which is slow.",
      "Can you use a Hash Map to check if the complement (target - current_val) already exists in O(1) time?",
    ],
    starterCode: {
      python: `class Solution:
    def twoSum(self, nums: list[int], target: int) -> list[int]:
        seen = {}
        for i, num in enumerate(nums):
            diff = target - num
            if diff in seen:
                return [seen[diff], i]
            seen[num] = i
        return []
`,
      java: `import java.util.HashMap;
import java.util.Map;

class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> map = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (map.containsKey(complement)) {
                return new int[] { map.get(complement), i };
            }
            map.put(nums[i], i);
        }
        return new int[] {};
    }
}
`,
      javascript: `var twoSum = function(nums, target) {
    const map = new Map();
    for (let i = 0; i < nums.length; i++) {
        const complement = target - nums[i];
        if (map.has(complement)) {
            return [map.get(complement), i];
        }
        map.set(nums[i], i);
    }
    return [];
};
`,
    },
    testCases: [
      { id: 1, name: "Test Case 1", input: "nums = [2,7,11,15], target = 9", expected: "[0, 1]" },
      { id: 2, name: "Test Case 2", input: "nums = [3,2,4], target = 6", expected: "[1, 2]" },
      { id: 3, name: "Test Case 3", input: "nums = [3,3], target = 6", expected: "[0, 1]" },
    ],
    aiFeedback: {
      complexity: "Time Complexity: O(n) | Space Complexity: O(n)",
      strengths: "Optimal single-pass hash map traversal eliminates nested quadratic overhead.",
      suggestions: "Ensure boundary conditions for negative integers and edge cases with duplicates are tested.",
    },
  },

  "longest-substring": {
    id: "longest-substring",
    slug: "longest-substring",
    title: "Longest Substring Without Repeating Characters",
    difficulty: "Medium",
    topic: "Strings",
    subtopic: "Sliding Window",
    tags: ["High Priority", "Previously Asked"],
    examMatch: {
      company: "Infosys",
      exam: "Infosys OA — 2026",
      similarity: "91%",
      appearances: 5,
      otherCompanies: ["TCS", "Cognizant"],
    },
    previouslyAsked: {
      company: "Infosys",
      exam: "Infosys OA — 2026",
      similarity: "91%",
      appearances: 5,
      companies: ["Infosys", "TCS", "Cognizant"],
    },
    description: `Given a string \`s\`, find the length of the **longest substring** without repeating characters.`,
    examples: [
      {
        id: 1,
        input: 's = "abcabcbb"',
        output: "3",
        explanation: "The answer is 'abc', with the length of 3.",
      },
    ],
    constraints: ["0 <= s.length <= 5 * 10^4", "s consists of English letters, digits, symbols and spaces."],
    hints: [
      "Use a sliding window with two pointers left and right.",
      "Keep a set or map of visited characters in the current window.",
    ],
    starterCode: {
      python: `class Solution:
    def lengthOfLongestSubstring(self, s: str) -> int:
        char_map = {}
        left = max_len = 0
        for right, char in enumerate(s):
            if char in char_map and char_map[char] >= left:
                left = char_map[char] + 1
            char_map[char] = right
            max_len = max(max_len, right - left + 1)
        return max_len
`,
      java: `import java.util.HashMap;

class Solution {
    public int lengthOfLongestSubstring(String s) {
        HashMap<Character, Integer> map = new HashMap<>();
        int left = 0, maxLen = 0;
        for (int right = 0; right < s.length(); right++) {
            char c = s.charAt(right);
            if (map.containsKey(c) && map.get(c) >= left) {
                left = map.get(c) + 1;
            }
            map.put(c, right);
            maxLen = Math.max(maxLen, right - left + 1);
        }
        return maxLen;
    }
}
`,
      javascript: `var lengthOfLongestSubstring = function(s) {
    let map = new Map();
    let left = 0, maxLen = 0;
    for (let right = 0; right < s.length; right++) {
        let char = s[right];
        if (map.has(char) && map.get(char) >= left) {
            left = map.get(char) + 1;
        }
        map.set(char, right);
        maxLen = Math.max(maxLen, right - left + 1);
    }
    return maxLen;
};
`,
    },
    testCases: [
      { id: 1, name: "Test Case 1", input: 's = "abcabcbb"', expected: "3" },
      { id: 2, name: "Test Case 2", input: 's = "bbbbb"', expected: "1" },
    ],
    aiFeedback: {
      complexity: "Time Complexity: O(n) | Space Complexity: O(min(m, n))",
      strengths: "Sliding window avoids repeating work, scaling cleanly across 50k character inputs.",
      suggestions: "Ensure handling of whitespace characters and ASCII special characters.",
    },
  },

  "lru-cache": {
    id: "lru-cache",
    slug: "lru-cache",
    title: "LRU Cache Implementation",
    difficulty: "Hard",
    topic: "System Design",
    subtopic: "Doubly Linked List + Hash Map",
    tags: ["Tier-1 Exclusive", "High Priority"],
    examMatch: {
      company: "Amazon",
      exam: "Amazon SDE-1 OA — 2024",
      similarity: "85%",
      appearances: 4,
      otherCompanies: ["Microsoft", "TCS Prime"],
    },
    previouslyAsked: {
      company: "Amazon",
      exam: "Amazon SDE-1 OA — 2024",
      similarity: "85%",
      appearances: 4,
      companies: ["Amazon", "Microsoft", "TCS Prime"],
    },
    description: `Design a data structure that follows the constraints of a Least Recently Used (LRU) cache with O(1) \`get\` and \`put\` operations.`,
    examples: [
      {
        id: 1,
        input: "LRUCache(2), put(1,1), put(2,2), get(1)",
        output: "1",
        explanation: "Key 1 is retrieved and marked most recently used.",
      },
    ],
    constraints: ["1 <= capacity <= 3000", "0 <= key <= 10^4", "0 <= value <= 10^5"],
    hints: ["Use a Doubly Linked List to store nodes and a Hash Map for O(1) key-to-node lookups."],
    starterCode: {
      python: `class LRUCache:
    def __init__(self, capacity: int):
        self.capacity = capacity
        self.cache = {}

    def get(self, key: int) -> int:
        # Write your code here
        return -1

    def put(self, key: int, value: int) -> None:
        # Write your code here
        pass
`,
      java: `class LRUCache {
    public LRUCache(int capacity) {
    }
    public int get(int key) {
        return -1;
    }
    public void put(int key, int value) {
    }
}
`,
      javascript: `class LRUCache {
    constructor(capacity) {
        this.capacity = capacity;
    }
    get(key) {
        return -1;
    }
    put(key, value) {
    }
}
`,
    },
    testCases: [
      { id: 1, name: "Test Case 1", input: "LRUCache(2), put(1,1), put(2,2), get(1)", expected: "1" },
      { id: 2, name: "Test Case 2", input: "put(3,3), get(2)", expected: "-1" },
    ],
    aiFeedback: {
      complexity: "Time Complexity: O(1) | Space Complexity: O(capacity)",
      strengths: "Hash map combined with doubly linked list provides constant time cache eviction.",
      suggestions: "Ensure head and tail dummy sentinel nodes prevent null pointer checks.",
    },
  },
};

export const mockCodingProblemsList = Object.values(mockCodingProblems);
export default mockCodingProblems;
