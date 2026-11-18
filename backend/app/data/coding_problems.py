"""Coding practice problems ("Practice Arena"). Loaded into MongoDB by `python -m app.seed` (idempotent upserts).

Every problem is FUNCTION-STYLE: the student writes one function (`function_name`, `params`, `return_type`) and a hidden driver
calls it with each test case (services/judge_drivers.py). Starter code is generated from that signature, never written by hand
(services/function_judge.starter_code). Supported types: int, long, double, bool, string, int[], long[], string[], int[][].
Long values stay within +-(2^53 - 1) so every language reads them exactly.

Per problem: 2-3 shown examples, at least 8 hidden cases, and for medium and hard problems at least one LARGE hidden case
(`"large": True`) that an O(n^2) or exponential solution cannot finish within `time_limit_ms`. `hints` are three short nudges that
never give the answer. Reference solutions (for tests and scripts only) live in backend/tests/reference_solutions.py; the expected
values below were produced by them and are re-checked by tests/test_function_judge.py. Nothing here reaches the browser except the
shown examples (see function_judge.public_problem).
"""
from app.services.function_judge import display_args, display_value

# Old seed problems (function-style, "nums = [2,7,...]" inputs) that cannot be judged with stdin/stdout.
# `python -m app.seed` removes them unless an admin edited them.
RETIRED_PROBLEM_SLUGS = [
    "reverse-string", "valid-palindrome", "fibonacci-number", "two-sum",
    "longest-substring", "valid-parentheses", "lru-cache",
]

# Where stored links to a retired problem should point instead (closest of the current problems by topic), or '' for no link.
RETIRED_SLUG_REMAP = {
    "two-sum": "pair-sum-exists", "longest-substring": "first-unique-char", "valid-parentheses": "balanced-brackets",
    "valid-palindrome": "palindrome-phrase", "reverse-string": "palindrome-phrase", "fibonacci-number": "staircase-ways", "lru-cache": "",
}

# Fields that older (stdin/stdout) versions of the documents had; the seed removes them from stored documents.
LEGACY_PROBLEM_FIELDS = ["input_format", "output_format", "sample_test_cases", "hidden_test_cases", "starter_code"]


def _lcg(seed: int, n: int, lo: int, hi: int) -> list:
    """Deterministic pseudo-random integers (same on every machine), used to build the large test inputs."""
    x, out = seed, []
    for _ in range(n):
        x = (x * 1103515245 + 12345) & 0x7FFFFFFF
        out.append(lo + (x >> 8) % (hi - lo + 1))
    return out


def _problem(rank, slug, title, difficulty, topic, tags, description, constraints, function_name, params, return_type,
             examples, hidden, hints, time_limit_ms, expected_complexity, order_insensitive=False):
    """examples: [(args, expected, explanation)]; hidden: [(args, expected)] or [(args, expected, "large")]."""
    names = [n for n, _ in params]
    cases = [{"args": list(a), "expected": e, "hidden": False} for a, e, *_ in examples]
    for h in hidden:
        cases.append({"args": list(h[0]), "expected": h[1], "hidden": True, **({"large": True} if len(h) > 2 else {})})
    return {
        "id": f"cp-{rank:02d}",
        "slug": slug,
        "title": title,
        "difficulty": difficulty,
        "difficulty_rank": rank,
        "category": topic,
        "topic": topic,
        "tags": tags,
        "description": description,
        "constraints": constraints,
        "function_name": function_name,
        "params": [{"name": n, "type": t} for n, t in params],
        "return_type": return_type,
        "examples": [
            {"input": display_args(names, a), "output": display_value(e), "explanation": (x[0] if x else "")}
            for a, e, *x in examples
        ],
        "test_cases": cases,
        "order_insensitive": order_insensitive,
        "time_limit_ms": time_limit_ms,
        "expected_complexity": expected_complexity,
        "hints": hints,
        "companies": [],
        "appearances": 0,
    }


EXPANDED_CODING_PROBLEMS = [
    # ================= EASY =================
    _problem(
        1, "sum-two-numbers", "Sum of Two Numbers", "Easy", "Math", ["math", "warm-up"],
        "Write a function that returns the sum of two whole numbers a and b.\n\nThe numbers can be large, so the sum may not fit in 32 bits: use a 64-bit type where your language has one.",
        ["-10^12 <= a, b <= 10^12"],
        "addNumbers", [("a", "long"), ("b", "long")], "long",
        [(( 3, 4), 7, "3 + 4 = 7."), ((-10, 4), -6, "-10 + 4 = -6."), ((2000000000, 2000000000), 4000000000, "The sum does not fit in a 32-bit integer.")],
        [((-5, 5), 0), ((100000, 250000), 350000), ((2000000000, 2000000000), 4000000000), ((0, 0), 0),
         ((-1000000000000, -1000000000000), -2000000000000), ((999999999999, 1), 1000000000000), ((7, -7), 0),
         ((123456789, 987654321), 1111111110), ((-2147483648, -1), -2147483649), ((1, 2), 3), ((1000000000000, 1000000000000), 2000000000000)],
        ["Two numbers go in, one number comes out.", "Check the size of the biggest possible input against the type you chose.", "In Java and C++ the 64-bit type is `long` / `long long`; the starter code already uses it."],
        1000, "O(1) time, O(1) space",
    ),
    _problem(
        2, "count-vowels", "Count the Vowels", "Easy", "Strings", ["strings", "counting"],
        "Return how many of the characters of s are vowels: a, e, i, o, u, in upper or lower case.\n\nCharacters that are not letters (digits, spaces, punctuation) are never vowels.",
        ["1 <= s.length <= 200"],
        "countVowels", [("s", "string")], "int",
        [(("Hello World",), 3, "The vowels are e, o and o."), (("rhythm",), 0, "No vowels at all.")],
        [(("AEIOU aeiou",), 10), (("Programming is fun",), 5), (("Education",), 5), (("xyz",), 0), (("a",), 1),
         (("The quick brown fox jumps over the lazy dog",), 11), (("123 !!! ???",), 0), (("UPPER lower MiXeD",), 6), (("y",), 0),
         (("aeiou" * 40,), 200)],
        ["Look at the characters one at a time.", "Decide how to treat capital letters before you compare.", "A small collection of the five vowels lets you ask: is this character in it?"],
        1000, "O(n) time, O(1) space",
    ),
    _problem(
        3, "array-range", "Spread of an Array", "Easy", "Arrays", ["arrays", "min-max"],
        "Return the difference between the largest and the smallest number in nums.\n\nA list with one number has a spread of 0.",
        ["1 <= nums.length <= 100000", "-10^6 <= nums[i] <= 10^6"],
        "arrayRange", [("nums", "int[]")], "int",
        [(([3, 9, 1, 7, 4],), 8, "9 - 1 = 8."), (([42],), 0, "One number: the spread is 0.")],
        [(([-5, -1, -9, -3],), 8), (([10] * 6,), 0), (([1000000, -1000000, 5],), 2000000), (([1, 2],), 1), (([5, 4, 3, 2, 1],), 4),
         (([0],), 0), (([-1000000, 1000000],), 2000000), (([7, 7, 8, 7],), 1), ((_lcg(21, 20000, -1000000, 1000000),), 1999884)],
        ["You need two numbers from the list.", "Can both be found in one pass?", "Keep a running smallest and a running largest."],
        1000, "O(n) time, O(1) space",
    ),
    _problem(
        4, "palindrome-phrase", "Palindrome Phrase", "Easy", "Two Pointers", ["two-pointers", "strings"],
        "A phrase reads the same forwards and backwards if, after dropping every character that is not a letter or a digit and ignoring upper or lower case, what remains is a palindrome.\n\nReturn true if the phrase s does, otherwise false. A phrase with nothing left after dropping characters counts as a palindrome.",
        ["1 <= s.length <= 200000"],
        "isPalindromePhrase", [("s", "string")], "bool",
        [(("A man, a plan, a canal: Panama",), True, "Only letters remain: amanaplanacanalpanama."), (("hello world",), False, "helloworld is not the same reversed.")],
        [(("No lemon, no melon",), True), (("ab",), False), (("0P",), False), ((" ",), True), ((".,",), True),
         (("Was it a car or a cat I saw?",), True), (("race a car",), False), (("a",), True), (("Madam, I'm Adam",), True),
         (("12321",), True), (("1231",), False)],
        ["Decide first which characters matter.", "Two positions, one moving in from each end, can compare pairs.", "Skip a character that does not matter instead of building a new string, if you want to use O(1) extra space."],
        1000, "O(n) time",
    ),

    # ================= MEDIUM =================
    _problem(
        5, "pair-sum-exists", "Pair With a Given Sum", "Medium", "Hashing", ["hashing", "arrays"],
        "Return true if two different positions in nums hold numbers that add up to target, otherwise false.\n\nOne position cannot be used twice, but two positions may hold equal numbers.",
        ["1 <= nums.length <= 100000", "-10^6 <= nums[i] <= 10^6", "-10^6 <= target <= 10^6"],
        "hasPairWithSum", [("nums", "int[]"), ("target", "int")], "bool",
        [(([2, 7, 11, 15, 1], 9), True, "2 + 7 = 9."), (([1, 2, 3], 10), False, "No two numbers add up to 10.")],
        [(([3, 3], 6), True), (([2], 4), False), (([-3, 4, 3, 90], 0), True), (([1, 2, 3], 7), False), (([5, 5, 5], 10), True),
         (([0, 0], 0), True), (([1000000, -1000000], 0), True), (([1], 2), False), (([1, 5, 9, 14], 20), False), (([1, 5, 9, 14], 19), True),
         ((_lcg(7, 30000, 0, 400000), 999999), False, "large"),
         ((_lcg(11, 30000, 0, 400000)[:-2] + [499999, 500000], 999999), True, "large")],
        ["For each number, which other number would complete the pair?", "Checking every pair works for small lists but gets slow for 100000 numbers.", "Remember the numbers you have already passed in a structure that answers \"have I seen this?\" fast."],
        2000, "O(n) time, O(n) space",
    ),
    _problem(
        6, "balanced-brackets", "Balanced Brackets", "Medium", "Stack", ["stack", "strings"],
        "The string s contains only the characters ( ) [ ] { }. It is balanced when every opening bracket is closed by the same kind of bracket, and the brackets close in the correct order.\n\nReturn true if s is balanced, otherwise false.",
        ["1 <= s.length <= 200000", "s contains only ( ) [ ] { }"],
        "isBalanced", [("s", "string")], "bool",
        [(("([]{})",), True, "Every bracket closes the most recent open one."), (("(]",), False, "] cannot close (.")],
        [(("([)]",), False), (("(((",), False), (("{[()()]}",), True), ((")(",), False), (("()[]{}",), True), (("{{[[(())]]}}",), True),
         (("(",), False), ((")",), False), (("[({})](",), False), (("()" * 100000,), True),
         (("(" * 100000 + ")" * 100000,), True, "large")],
        ["The most recent unclosed opening bracket is the next one that must be closed.", "What structure always gives you the most recent item first?", "Repeatedly deleting \"()\" pairs from the text is easy to write but gets very slow on deeply nested input."],
        2000, "O(n) time, O(n) space",
    ),
    _problem(
        7, "first-unique-char", "First Unique Letter", "Medium", "Hashing", ["hashing", "strings"],
        "Return the position (counting from 0) of the first letter in s that appears exactly once in s. Return -1 if every letter repeats.",
        ["1 <= s.length <= 100000", "s contains only lowercase letters a to z"],
        "firstUniqueChar", [("s", "string")], "int",
        [(("swiss",), 1, "w appears once, and it is the first letter that does."), (("aabb",), -1, "Every letter repeats.")],
        [(("loveleetcode",), 2), (("z",), 0), (("abcabcd",), 6), (("aabbcc",), -1), (("abcdefghijklmnopqrstuvwxyz",), 0), (("aadadaad",), -1),
         (("dddccdbba",), 8), (("xxyz",), 2), (("a" * 100000,), -1),
         (("abcdefghijklmnopqrstuvwxy" * 3999 + "z",), 99975, "large")],
        ["You need to know how often each letter occurs.", "Counting for every position by scanning the whole string again is too slow for 100000 characters.", "Count all letters once, then walk the string again and stop at the first count of 1."],
        2000, "O(n) time, O(1) space (26 letters)",
    ),
    _problem(
        8, "merge-sorted-arrays", "Merge Two Sorted Lists", "Medium", "Sorting", ["sorting", "two-pointers"],
        "Both a and b are sorted from smallest to largest. Return one sorted list that contains every number of both lists. Equal numbers all stay.",
        ["0 <= a.length, b.length <= 100000", "-10^6 <= a[i], b[i] <= 10^6", "a and b are each sorted in non-decreasing order"],
        "mergeSorted", [("a", "int[]"), ("b", "int[]")], "int[]",
        [(([1, 4, 9], [2, 3, 10]), [1, 2, 3, 4, 9, 10], "Take the smaller front number each time."), (([5], [1, 5]), [1, 5, 5], "Equal values both stay.")],
        [(([-3, -1], [-2, 0]), [-3, -2, -1, 0]), (([7], [7]), [7, 7]), (([1, 2, 3, 4], [0]), [0, 1, 2, 3, 4]), (([], []), []), (([], [1, 2]), [1, 2]),
         (([1, 1, 1], [1, 1]), [1, 1, 1, 1, 1]), (([-1000000], [1000000]), [-1000000, 1000000]), (([2, 4, 6], [1, 3, 5, 7]), [1, 2, 3, 4, 5, 6, 7]),
         # two lists of 14000 digits each (28000 results fit in the 64 KB output cap of the free provider)
         (([d for d in range(10) for _ in range(1400)], [d for d in range(10) for _ in range(1400)]), [d for d in range(10) for _ in range(2800)], "large")],
        ["Both lists are already in order, so the smallest remaining number is at the front of one of them.", "Keep one position in each list.", "Re-sorting the combined list from scratch with a slow method is not needed: the order you already have does the work."],
        2000, "O(n + m) time",
    ),
    _problem(
        9, "staircase-ways", "Staircase Ways", "Medium", "Recursion / DP", ["dp", "recursion", "counting"],
        "A staircase has n steps. Each move climbs 1, 2 or 3 steps. Return the number of different sequences of moves that reach exactly the top.",
        ["1 <= n <= 35", "The answer fits in a 32-bit integer."],
        "countWays", [("n", "int")], "int",
        [((4,), 7, "1+1+1+1, 1+1+2, 1+2+1, 2+1+1, 2+2, 1+3, 3+1."), ((1,), 1, "Only one move: 1.")],
        [((3,), 4), ((10,), 274), ((2,), 2), ((5,), 13), ((20,), 121415), ((25,), 2555757), ((15,), 5768), ((7,), 44),
         ((33,), 334745777, "large"), ((34,), 615693474, "large"), ((35,), 1132436852, "large")],
        ["The last move was a 1, a 2 or a 3. How many ways were there to reach the step before it?", "The same smaller questions are asked again and again.", "Store the answer for each step once you know it."],
        1000, "O(n) time",
    ),

    # ================= HARD =================
    _problem(
        10, "longest-increasing-subsequence", "Longest Rising Run", "Hard", "Recursion / DP", ["dp", "arrays", "binary-search"],
        "You may delete any numbers from nums (possibly none) without reordering the rest. Return the largest number of values that can remain so that they are strictly increasing from left to right.",
        ["1 <= nums.length <= 100000", "-10^6 <= nums[i] <= 10^6"],
        "lengthOfLis", [("nums", "int[]")], "int",
        [(([10, 9, 2, 5, 3, 7, 101, 18],), 4, "For example 2, 3, 7, 18."), (([5, 4, 3, 2],), 1, "Any single value.")],
        [(([1, 2, 3, 4, 5],), 5), (([0, 8, 4, 12, 2, 10],), 3), (([3, 3, 3, 3, 3, 3, 3],), 1), (([10, 22, 9, 33, 21, 50, 41, 60, 80],), 6),
         (([5, 4, 3, 2, 1],), 1), (([1, 3, 6, 7, 9, 4, 10, 5, 6],), 6), (([2, 2],), 1), (([-1, 0, -1, 0, 1],), 3),
         ((_lcg(9, 30000, 0, 99999),), 334, "large"), ((list(range(30000)),), 30000, "large")],
        ["Think about the best run that ends at each position.", "Comparing every earlier number with every later number takes too long for 100000 numbers.", "Keep, for each run length, the smallest number a run of that length can end with: that list stays sorted."],
        3000, "O(n log n) time",
    ),
    _problem(
        11, "fewest-coins", "Fewest Coins", "Hard", "Recursion / DP", ["dp", "math"],
        "You have an unlimited supply of coins of each value in coins. Return the smallest number of coins whose values add up to exactly amount, or -1 if the amount cannot be formed.\n\nTaking the biggest coin first is not always best.",
        ["1 <= coins.length <= 12", "1 <= coins[i] <= 10000", "1 <= amount <= 10000"],
        "minCoins", [("coins", "int[]"), ("amount", "int")], "int",
        [(([1, 2, 5], 11), 3, "5 + 5 + 1."), (([2], 7), -1, "Seven cannot be made from 2s.")],
        [(([1, 3, 4], 6), 2), (([2, 3], 1), -1), (([2, 5, 10, 25], 27), 2), (([1], 5), 5), (([5, 7], 24), 4), (([3, 7], 11), -1),
         (([1, 5, 10, 25, 50, 100, 3, 7, 11, 13, 17, 19], 9999), 103, "large"), (([7, 13, 29, 47, 101], 9973), 103, "large"), (([2, 4, 6], 9999), -1)],
        ["If you know the answer for every smaller amount, how do you get the answer for this one?", "Trying all coin combinations blindly takes exponential time for amounts near 10000.", "Fill a table: fewest coins for amount 0, 1, 2, ... up to amount."],
        3000, "O(amount * coins) time",
    ),
    _problem(
        12, "subset-sum-count", "Count the Subsets", "Hard", "Recursion / DP", ["recursion", "backtracking", "dp"],
        "Count the ways to choose some of the numbers in nums so that the chosen numbers add up to exactly target. Choose by position: equal numbers at different positions count as different choices.\n\nThe answer can be bigger than 32 bits, so the function returns a 64-bit number.",
        ["1 <= nums.length <= 40", "1 <= nums[i] <= 100", "1 <= target <= 4000"],
        "countSubsets", [("nums", "int[]"), ("target", "int")], "long",
        [(([1, 2, 3, 4], 5), 2, "{1, 4} and {2, 3}."), (([4, 5, 6], 10), 1, "Only {4, 6}.")],
        [(([1, 1, 1, 1], 2), 6), (([1, 2, 3, 4, 5], 7), 3), (([2, 3, 5, 7, 8, 10], 10), 4), (([5], 5), 1), (([5], 4), 0), (([1, 2, 3], 100), 0),
         (([10, 10, 10, 10], 20), 6), (([1] * 40, 20), 137846528820, "large"), ((list(range(1, 41)), 400), 5779890186, "large"),
         ((list(range(1, 41)), 410), 5830034720, "large")],
        ["For each number there are two choices: take it or leave it.", "Trying all 2^40 combinations is hopeless. Which sub-questions repeat?", "Let ways[s] be the number of ways to reach sum s so far; update it once per number."],
        3000, "O(n * target) time",
    ),
]


def _normalize_problem_obj(p: dict) -> dict:
    """The document stored for a problem (a copy; the legacy stdin/stdout fields are removed by the seed)."""
    return dict(p)
