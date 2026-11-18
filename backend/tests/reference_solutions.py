"""Reference solutions for the 12 coding problems, in Python, JavaScript, Java, C++ and C (C where the problem offers it).

TEST AND SCRIPT USE ONLY: this file is never imported by app code and nothing in it reaches an API response.
  * tests/test_function_judge.py runs the Python ones locally against every stored test case (so a wrong expected value fails a test);
  * scripts/check_reference_solutions.py sends every language through the real online compiler;
  * SLOW holds a deliberately slow brute force per medium / hard problem: it must end with Time Limit Exceeded on the large case.
"""

REFERENCE = {
    # ------------------------------------------------------------------ 1
    "sum-two-numbers": {
        "python": '''
class Solution:
    def add_numbers(self, a: int, b: int) -> int:
        return a + b
''',
        "javascript": '''
function addNumbers(a, b) {
  return a + b;
}
''',
        "java": '''
class Solution {
    public long addNumbers(long a, long b) {
        return a + b;
    }
}
''',
        "cpp": '''
class Solution {
public:
    long long addNumbers(long long a, long long b) {
        return a + b;
    }
};
''',
        "c": '''
long long add_numbers(long long a, long long b) {
    return a + b;
}
''',
    },
    # ------------------------------------------------------------------ 2
    "count-vowels": {
        "python": '''
class Solution:
    def count_vowels(self, s: str) -> int:
        return sum(1 for ch in s.lower() if ch in "aeiou")
''',
        "javascript": '''
function countVowels(s) {
  let total = 0;
  for (const ch of s.toLowerCase()) if ("aeiou".includes(ch)) total++;
  return total;
}
''',
        "java": '''
class Solution {
    public int countVowels(String s) {
        int total = 0;
        for (char ch : s.toLowerCase().toCharArray()) if ("aeiou".indexOf(ch) >= 0) total++;
        return total;
    }
}
''',
        "cpp": '''
class Solution {
public:
    int countVowels(string s) {
        int total = 0;
        for (char ch : s) if (string("aeiouAEIOU").find(ch) != string::npos) total++;
        return total;
    }
};
''',
        "c": '''
int count_vowels(const char* s) {
    int total = 0;
    for (; *s; s++) if (strchr("aeiouAEIOU", *s) && *s != '\\0') total++;
    return total;
}
''',
    },
    # ------------------------------------------------------------------ 3
    "array-range": {
        "python": '''
from typing import List

class Solution:
    def array_range(self, nums: List[int]) -> int:
        return max(nums) - min(nums)
''',
        "javascript": '''
function arrayRange(nums) {
  let lo = nums[0], hi = nums[0];
  for (const x of nums) { if (x < lo) lo = x; if (x > hi) hi = x; }
  return hi - lo;
}
''',
        "java": '''
class Solution {
    public int arrayRange(int[] nums) {
        int lo = nums[0], hi = nums[0];
        for (int x : nums) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
        return hi - lo;
    }
}
''',
        "cpp": '''
class Solution {
public:
    int arrayRange(vector<int>& nums) {
        return *max_element(nums.begin(), nums.end()) - *min_element(nums.begin(), nums.end());
    }
};
''',
        "c": '''
int array_range(int* nums, int numsSize) {
    int lo = nums[0], hi = nums[0];
    for (int i = 1; i < numsSize; i++) { if (nums[i] < lo) lo = nums[i]; if (nums[i] > hi) hi = nums[i]; }
    return hi - lo;
}
''',
    },
    # ------------------------------------------------------------------ 4
    "palindrome-phrase": {
        "python": '''
class Solution:
    def is_palindrome_phrase(self, s: str) -> bool:
        kept = [ch.lower() for ch in s if ch.isalnum()]
        return kept == kept[::-1]
''',
        "javascript": '''
function isPalindromePhrase(s) {
  const kept = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  return kept === kept.split('').reverse().join('');
}
''',
        "java": '''
class Solution {
    public boolean isPalindromePhrase(String s) {
        int i = 0, j = s.length() - 1;
        while (i < j) {
            while (i < j && !Character.isLetterOrDigit(s.charAt(i))) i++;
            while (i < j && !Character.isLetterOrDigit(s.charAt(j))) j--;
            if (Character.toLowerCase(s.charAt(i)) != Character.toLowerCase(s.charAt(j))) return false;
            i++; j--;
        }
        return true;
    }
}
''',
        "cpp": '''
class Solution {
public:
    bool isPalindromePhrase(string s) {
        int i = 0, j = (int)s.size() - 1;
        while (i < j) {
            while (i < j && !isalnum((unsigned char)s[i])) i++;
            while (i < j && !isalnum((unsigned char)s[j])) j--;
            if (tolower((unsigned char)s[i]) != tolower((unsigned char)s[j])) return false;
            i++; j--;
        }
        return true;
    }
};
''',
        "c": '''
bool is_palindrome_phrase(const char* s) {
    int i = 0, j = (int)strlen(s) - 1;
    while (i < j) {
        while (i < j && !isalnum((unsigned char)s[i])) i++;
        while (i < j && !isalnum((unsigned char)s[j])) j--;
        if (tolower((unsigned char)s[i]) != tolower((unsigned char)s[j])) return false;
        i++; j--;
    }
    return true;
}
''',
    },
    # ------------------------------------------------------------------ 5
    "pair-sum-exists": {
        "python": '''
from typing import List

class Solution:
    def has_pair_with_sum(self, nums: List[int], target: int) -> bool:
        seen = set()
        for x in nums:
            if target - x in seen:
                return True
            seen.add(x)
        return False
''',
        "javascript": '''
function hasPairWithSum(nums, target) {
  const seen = new Set();
  for (const x of nums) {
    if (seen.has(target - x)) return true;
    seen.add(x);
  }
  return false;
}
''',
        "java": '''
class Solution {
    public boolean hasPairWithSum(int[] nums, int target) {
        Set<Integer> seen = new HashSet<>();
        for (int x : nums) {
            if (seen.contains(target - x)) return true;
            seen.add(x);
        }
        return false;
    }
}
''',
        "cpp": '''
class Solution {
public:
    bool hasPairWithSum(vector<int>& nums, int target) {
        unordered_set<int> seen;
        for (int x : nums) {
            if (seen.count(target - x)) return true;
            seen.insert(x);
        }
        return false;
    }
};
''',
        "c": '''
static int cmp_int(const void* a, const void* b) { int x = *(const int*)a, y = *(const int*)b; return (x > y) - (x < y); }

bool has_pair_with_sum(int* nums, int numsSize, int target) {
    int* s = (int*)malloc((numsSize + 1) * sizeof(int));
    memcpy(s, nums, numsSize * sizeof(int));
    qsort(s, numsSize, sizeof(int), cmp_int);
    int i = 0, j = numsSize - 1;
    bool found = false;
    while (i < j) {
        long long sum = (long long)s[i] + s[j];
        if (sum == target) { found = true; break; }
        if (sum < target) i++; else j--;
    }
    free(s);
    return found;
}
''',
    },
    # ------------------------------------------------------------------ 6
    "balanced-brackets": {
        "python": '''
class Solution:
    def is_balanced(self, s: str) -> bool:
        pairs = {")": "(", "]": "[", "}": "{"}
        stack = []
        for ch in s:
            if ch in "([{":
                stack.append(ch)
            elif not stack or stack.pop() != pairs[ch]:
                return False
        return not stack
''',
        "javascript": '''
function isBalanced(s) {
  const pairs = { ')': '(', ']': '[', '}': '{' };
  const stack = [];
  for (const ch of s) {
    if ('([{'.includes(ch)) stack.push(ch);
    else if (!stack.length || stack.pop() !== pairs[ch]) return false;
  }
  return stack.length === 0;
}
''',
        "java": '''
class Solution {
    public boolean isBalanced(String s) {
        char[] stack = new char[s.length()];
        int top = 0;
        for (char ch : s.toCharArray()) {
            if (ch == '(' || ch == '[' || ch == '{') stack[top++] = ch;
            else {
                if (top == 0) return false;
                char open = stack[--top];
                if ((ch == ')' && open != '(') || (ch == ']' && open != '[') || (ch == '}' && open != '{')) return false;
            }
        }
        return top == 0;
    }
}
''',
        "cpp": '''
class Solution {
public:
    bool isBalanced(string s) {
        string stack;
        for (char ch : s) {
            if (ch == '(' || ch == '[' || ch == '{') stack.push_back(ch);
            else {
                if (stack.empty()) return false;
                char open = stack.back();
                stack.pop_back();
                if ((ch == ')' && open != '(') || (ch == ']' && open != '[') || (ch == '}' && open != '{')) return false;
            }
        }
        return stack.empty();
    }
};
''',
        "c": '''
bool is_balanced(const char* s) {
    size_t n = strlen(s);
    char* stack = (char*)malloc(n + 1);
    size_t top = 0;
    bool ok = true;
    for (size_t i = 0; i < n && ok; i++) {
        char ch = s[i];
        if (ch == '(' || ch == '[' || ch == '{') stack[top++] = ch;
        else if (top == 0) ok = false;
        else {
            char open = stack[--top];
            if ((ch == ')' && open != '(') || (ch == ']' && open != '[') || (ch == '}' && open != '{')) ok = false;
        }
    }
    if (top != 0) ok = false;
    free(stack);
    return ok;
}
''',
    },
    # ------------------------------------------------------------------ 7
    "first-unique-char": {
        "python": '''
from collections import Counter

class Solution:
    def first_unique_char(self, s: str) -> int:
        counts = Counter(s)
        for i, ch in enumerate(s):
            if counts[ch] == 1:
                return i
        return -1
''',
        "javascript": '''
function firstUniqueChar(s) {
  const counts = new Map();
  for (const ch of s) counts.set(ch, (counts.get(ch) || 0) + 1);
  for (let i = 0; i < s.length; i++) if (counts.get(s[i]) === 1) return i;
  return -1;
}
''',
        "java": '''
class Solution {
    public int firstUniqueChar(String s) {
        int[] counts = new int[128];
        for (char ch : s.toCharArray()) counts[ch]++;
        for (int i = 0; i < s.length(); i++) if (counts[s.charAt(i)] == 1) return i;
        return -1;
    }
}
''',
        "cpp": '''
class Solution {
public:
    int firstUniqueChar(string s) {
        int counts[256] = {0};
        for (unsigned char ch : s) counts[ch]++;
        for (int i = 0; i < (int)s.size(); i++) if (counts[(unsigned char)s[i]] == 1) return i;
        return -1;
    }
};
''',
        "c": '''
int first_unique_char(const char* s) {
    int counts[256] = {0};
    int n = (int)strlen(s);
    for (int i = 0; i < n; i++) counts[(unsigned char)s[i]]++;
    for (int i = 0; i < n; i++) if (counts[(unsigned char)s[i]] == 1) return i;
    return -1;
}
''',
    },
    # ------------------------------------------------------------------ 8
    "merge-sorted-arrays": {
        "python": '''
from typing import List

class Solution:
    def merge_sorted(self, a: List[int], b: List[int]) -> List[int]:
        out, i, j = [], 0, 0
        while i < len(a) and j < len(b):
            if a[i] <= b[j]:
                out.append(a[i]); i += 1
            else:
                out.append(b[j]); j += 1
        return out + a[i:] + b[j:]
''',
        "javascript": '''
function mergeSorted(a, b) {
  const out = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) out.push(a[i] <= b[j] ? a[i++] : b[j++]);
  while (i < a.length) out.push(a[i++]);
  while (j < b.length) out.push(b[j++]);
  return out;
}
''',
        "java": '''
class Solution {
    public int[] mergeSorted(int[] a, int[] b) {
        int[] out = new int[a.length + b.length];
        int i = 0, j = 0, k = 0;
        while (i < a.length && j < b.length) out[k++] = a[i] <= b[j] ? a[i++] : b[j++];
        while (i < a.length) out[k++] = a[i++];
        while (j < b.length) out[k++] = b[j++];
        return out;
    }
}
''',
        "cpp": '''
class Solution {
public:
    vector<int> mergeSorted(vector<int>& a, vector<int>& b) {
        vector<int> out;
        size_t i = 0, j = 0;
        while (i < a.size() && j < b.size()) out.push_back(a[i] <= b[j] ? a[i++] : b[j++]);
        while (i < a.size()) out.push_back(a[i++]);
        while (j < b.size()) out.push_back(b[j++]);
        return out;
    }
};
''',
        "c": '''
int* merge_sorted(int* a, int aSize, int* b, int bSize, int* returnSize) {
    int* out = (int*)malloc((aSize + bSize + 1) * sizeof(int));
    int i = 0, j = 0, k = 0;
    while (i < aSize && j < bSize) out[k++] = a[i] <= b[j] ? a[i++] : b[j++];
    while (i < aSize) out[k++] = a[i++];
    while (j < bSize) out[k++] = b[j++];
    *returnSize = k;
    return out;
}
''',
    },
    # ------------------------------------------------------------------ 9
    "staircase-ways": {
        "python": '''
class Solution:
    def count_ways(self, n: int) -> int:
        ways = [1, 1, 2] + [0] * max(0, n - 2)
        for i in range(3, n + 1):
            ways[i] = ways[i - 1] + ways[i - 2] + ways[i - 3]
        return ways[n]
''',
        "javascript": '''
function countWays(n) {
  const ways = [1, 1, 2];
  for (let i = 3; i <= n; i++) ways[i] = ways[i - 1] + ways[i - 2] + ways[i - 3];
  return ways[n];
}
''',
        "java": '''
class Solution {
    public int countWays(int n) {
        int[] ways = new int[Math.max(n + 1, 3)];
        ways[0] = 1; ways[1] = 1; ways[2] = 2;
        for (int i = 3; i <= n; i++) ways[i] = ways[i - 1] + ways[i - 2] + ways[i - 3];
        return ways[n];
    }
}
''',
        "cpp": '''
class Solution {
public:
    int countWays(int n) {
        vector<int> ways(max(n + 1, 3));
        ways[0] = 1; ways[1] = 1; ways[2] = 2;
        for (int i = 3; i <= n; i++) ways[i] = ways[i - 1] + ways[i - 2] + ways[i - 3];
        return ways[n];
    }
};
''',
        "c": '''
int count_ways(int n) {
    int ways[64] = {1, 1, 2};
    for (int i = 3; i <= n; i++) ways[i] = ways[i - 1] + ways[i - 2] + ways[i - 3];
    return ways[n];
}
''',
    },
    # ------------------------------------------------------------------ 10
    "longest-increasing-subsequence": {
        "python": '''
from bisect import bisect_left
from typing import List

class Solution:
    def length_of_lis(self, nums: List[int]) -> int:
        tails = []
        for x in nums:
            pos = bisect_left(tails, x)
            if pos == len(tails):
                tails.append(x)
            else:
                tails[pos] = x
        return len(tails)
''',
        "javascript": '''
function lengthOfLis(nums) {
  const tails = [];
  for (const x of nums) {
    let lo = 0, hi = tails.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (tails[mid] < x) lo = mid + 1; else hi = mid; }
    tails[lo] = x;
  }
  return tails.length;
}
''',
        "java": '''
class Solution {
    public int lengthOfLis(int[] nums) {
        int[] tails = new int[nums.length];
        int size = 0;
        for (int x : nums) {
            int lo = 0, hi = size;
            while (lo < hi) { int mid = (lo + hi) >>> 1; if (tails[mid] < x) lo = mid + 1; else hi = mid; }
            tails[lo] = x;
            if (lo == size) size++;
        }
        return size;
    }
}
''',
        "cpp": '''
class Solution {
public:
    int lengthOfLis(vector<int>& nums) {
        vector<int> tails;
        for (int x : nums) {
            auto it = lower_bound(tails.begin(), tails.end(), x);
            if (it == tails.end()) tails.push_back(x); else *it = x;
        }
        return (int)tails.size();
    }
};
''',
        "c": '''
int length_of_lis(int* nums, int numsSize) {
    int* tails = (int*)malloc((numsSize + 1) * sizeof(int));
    int size = 0;
    for (int k = 0; k < numsSize; k++) {
        int x = nums[k], lo = 0, hi = size;
        while (lo < hi) { int mid = (lo + hi) / 2; if (tails[mid] < x) lo = mid + 1; else hi = mid; }
        tails[lo] = x;
        if (lo == size) size++;
    }
    free(tails);
    return size;
}
''',
    },
    # ------------------------------------------------------------------ 11
    "fewest-coins": {
        "python": '''
from typing import List

class Solution:
    def min_coins(self, coins: List[int], amount: int) -> int:
        INF = amount + 1
        best = [0] + [INF] * amount
        for total in range(1, amount + 1):
            for c in coins:
                if c <= total and best[total - c] + 1 < best[total]:
                    best[total] = best[total - c] + 1
        return best[amount] if best[amount] != INF else -1
''',
        "javascript": '''
function minCoins(coins, amount) {
  const INF = amount + 1;
  const best = new Array(amount + 1).fill(INF);
  best[0] = 0;
  for (let total = 1; total <= amount; total++)
    for (const c of coins) if (c <= total && best[total - c] + 1 < best[total]) best[total] = best[total - c] + 1;
  return best[amount] === INF ? -1 : best[amount];
}
''',
        "java": '''
class Solution {
    public int minCoins(int[] coins, int amount) {
        int inf = amount + 1;
        int[] best = new int[amount + 1];
        Arrays.fill(best, inf);
        best[0] = 0;
        for (int total = 1; total <= amount; total++)
            for (int c : coins) if (c <= total && best[total - c] + 1 < best[total]) best[total] = best[total - c] + 1;
        return best[amount] == inf ? -1 : best[amount];
    }
}
''',
        "cpp": '''
class Solution {
public:
    int minCoins(vector<int>& coins, int amount) {
        int inf = amount + 1;
        vector<int> best(amount + 1, inf);
        best[0] = 0;
        for (int total = 1; total <= amount; total++)
            for (int c : coins) if (c <= total && best[total - c] + 1 < best[total]) best[total] = best[total - c] + 1;
        return best[amount] == inf ? -1 : best[amount];
    }
};
''',
        "c": '''
int min_coins(int* coins, int coinsSize, int amount) {
    int inf = amount + 1;
    int* best = (int*)malloc((amount + 1) * sizeof(int));
    for (int i = 0; i <= amount; i++) best[i] = inf;
    best[0] = 0;
    for (int total = 1; total <= amount; total++)
        for (int k = 0; k < coinsSize; k++) { int c = coins[k]; if (c <= total && best[total - c] + 1 < best[total]) best[total] = best[total - c] + 1; }
    int answer = best[amount] == inf ? -1 : best[amount];
    free(best);
    return answer;
}
''',
    },
    # ------------------------------------------------------------------ 12
    "subset-sum-count": {
        "python": '''
from typing import List

class Solution:
    def count_subsets(self, nums: List[int], target: int) -> int:
        ways = [1] + [0] * target
        for x in nums:
            for total in range(target, x - 1, -1):
                ways[total] += ways[total - x]
        return ways[target]
''',
        "javascript": '''
function countSubsets(nums, target) {
  const ways = new Array(target + 1).fill(0);
  ways[0] = 1;
  for (const x of nums) for (let total = target; total >= x; total--) ways[total] += ways[total - x];
  return ways[target];
}
''',
        "java": '''
class Solution {
    public long countSubsets(int[] nums, int target) {
        long[] ways = new long[target + 1];
        ways[0] = 1;
        for (int x : nums) for (int total = target; total >= x; total--) ways[total] += ways[total - x];
        return ways[target];
    }
}
''',
        "cpp": '''
class Solution {
public:
    long long countSubsets(vector<int>& nums, int target) {
        vector<long long> ways(target + 1, 0);
        ways[0] = 1;
        for (int x : nums) for (int total = target; total >= x; total--) ways[total] += ways[total - x];
        return ways[target];
    }
};
''',
        "c": '''
long long count_subsets(int* nums, int numsSize, int target) {
    long long* ways = (long long*)calloc(target + 1, sizeof(long long));
    ways[0] = 1;
    for (int k = 0; k < numsSize; k++) for (int total = target; total >= nums[k]; total--) ways[total] += ways[total - nums[k]];
    long long answer = ways[target];
    free(ways);
    return answer;
}
''',
    },
}

# Deliberately slow solutions (Python): each must end with Time Limit Exceeded on the large case(s) of its problem.
SLOW = {
    "pair-sum-exists": '''
from typing import List

class Solution:
    def has_pair_with_sum(self, nums: List[int], target: int) -> bool:
        for i in range(len(nums)):
            for j in range(i + 1, len(nums)):
                if nums[i] + nums[j] == target:
                    return True
        return False
''',
    "balanced-brackets": '''
class Solution:
    def is_balanced(self, s: str) -> bool:
        while True:
            t = s.replace("()", "").replace("[]", "").replace("{}", "")
            if t == s:
                return s == ""
            s = t
''',
    "first-unique-char": '''
class Solution:
    def first_unique_char(self, s: str) -> int:
        for i in range(len(s)):
            seen = 0
            for j in range(len(s)):
                if s[i] == s[j]:
                    seen += 1
            if seen == 1:
                return i
        return -1
''',
    "merge-sorted-arrays": '''
from typing import List

class Solution:
    def merge_sorted(self, a: List[int], b: List[int]) -> List[int]:
        res = a + b
        for i in range(len(res)):
            for j in range(i + 1, len(res)):
                if res[j] < res[i]:
                    res[i], res[j] = res[j], res[i]
        return res
''',
    "staircase-ways": '''
class Solution:
    def count_ways(self, n: int) -> int:
        if n < 0:
            return 0
        if n == 0:
            return 1
        return self.count_ways(n - 1) + self.count_ways(n - 2) + self.count_ways(n - 3)
''',
    "longest-increasing-subsequence": '''
from typing import List

class Solution:
    def length_of_lis(self, nums: List[int]) -> int:
        best = [1] * len(nums)
        for i in range(len(nums)):
            for j in range(i):
                if nums[j] < nums[i] and best[j] + 1 > best[i]:
                    best[i] = best[j] + 1
        return max(best)
''',
    "fewest-coins": '''
from itertools import combinations_with_replacement
from typing import List

class Solution:
    def min_coins(self, coins: List[int], amount: int) -> int:
        for k in range(1, amount + 1):
            for combo in combinations_with_replacement(coins, k):
                if sum(combo) == amount:
                    return k
        return -1
''',
    "subset-sum-count": '''
from typing import List

class Solution:
    def count_subsets(self, nums: List[int], target: int) -> int:
        def go(i, left):
            if left == 0:
                return 1
            if i == len(nums) or left < 0:
                return 0
            return go(i + 1, left - nums[i]) + go(i + 1, left)
        return go(0, target)
''',
}
