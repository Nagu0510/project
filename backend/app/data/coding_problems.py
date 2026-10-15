"""Coding practice problems. Loaded into MongoDB by `python -m app.seed` (idempotent upserts).

Every problem is a classic stdin/stdout program: read the input, print the answer. That is the only
thing the online judge supports, so nothing here depends on a per-language function wrapper.
Each problem has 2 sample cases (shown to students) and 2-3 hidden cases (5 at most: the judge runs
up to 5 cases per submit). Starter code reads the input and prints nothing; it never contains a solution.
Reference solutions live in backend/scripts/reference_solutions.py and are checked against these cases.
"""

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


# ---------------------------------------------------------------------------
# Starter code: reads the input for one of a few input shapes, then leaves the answer to the student.
# ---------------------------------------------------------------------------
def _starters(shape: str, todo: str) -> dict:
    py = {
        "ints_line": "import sys\n\na, b = map(int, sys.stdin.read().split())\n",
        "line": "import sys\n\ns = sys.stdin.readline().rstrip(\"\\n\")\n",
        "arr": "import sys\n\ndata = sys.stdin.read().split()\nn = int(data[0])\nnums = list(map(int, data[1:1 + n]))\n",
        "n_t_arr": "import sys\n\ndata = sys.stdin.read().split()\nn, target = int(data[0]), int(data[1])\nnums = list(map(int, data[2:2 + n]))\n",
        "two_arr": "import sys\n\ndata = sys.stdin.read().split()\nn = int(data[0])\na = list(map(int, data[1:1 + n]))\nm = int(data[1 + n])\nb = list(map(int, data[2 + n:2 + n + m]))\n",
        "one_int": "import sys\n\nn = int(sys.stdin.read().split()[0])\n",
    }[shape]

    js_head = "const data = require('fs').readFileSync(0, 'utf8');\n"
    js_tokens = "const t = data.split(/\\s+/).filter(Boolean).map(Number);\n"
    js = js_head + {
        "ints_line": js_tokens + "const [a, b] = t;\n",
        "line": "const s = data.split('\\n')[0].replace(/\\r/g, '');\n",
        "arr": js_tokens + "const n = t[0];\nconst nums = t.slice(1, 1 + n);\n",
        "n_t_arr": js_tokens + "const n = t[0], target = t[1];\nconst nums = t.slice(2, 2 + n);\n",
        "two_arr": js_tokens + "const n = t[0];\nconst a = t.slice(1, 1 + n);\nconst m = t[1 + n];\nconst b = t.slice(2 + n, 2 + n + m);\n",
        "one_int": js_tokens + "const n = t[0];\n",
    }[shape]

    java_body = {
        "ints_line": "        long a = sc.nextLong(), b = sc.nextLong();\n",
        "line": "        String s = sc.nextLine();\n",
        "arr": "        int n = sc.nextInt();\n        int[] nums = new int[n];\n        for (int i = 0; i < n; i++) nums[i] = sc.nextInt();\n",
        "n_t_arr": "        int n = sc.nextInt(), target = sc.nextInt();\n        int[] nums = new int[n];\n        for (int i = 0; i < n; i++) nums[i] = sc.nextInt();\n",
        "two_arr": "        int n = sc.nextInt();\n        int[] a = new int[n];\n        for (int i = 0; i < n; i++) a[i] = sc.nextInt();\n        int m = sc.nextInt();\n        int[] b = new int[m];\n        for (int i = 0; i < m; i++) b[i] = sc.nextInt();\n",
        "one_int": "        int n = sc.nextInt();\n",
    }[shape]
    java = (
        "import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n"
        "        Scanner sc = new Scanner(System.in);\n" + java_body + f"        // {todo}\n    }}\n}}\n"
    )

    c_body = {
        "ints_line": "    long long a, b;\n    scanf(\"%lld %lld\", &a, &b);\n",
        "line": "    char s[1024];\n    fgets(s, sizeof s, stdin);  /* s ends with a newline */\n",
        "arr": "    int n, nums[1000];\n    scanf(\"%d\", &n);\n    for (int i = 0; i < n; i++) scanf(\"%d\", &nums[i]);\n",
        "n_t_arr": "    int n, target, nums[1000];\n    scanf(\"%d %d\", &n, &target);\n    for (int i = 0; i < n; i++) scanf(\"%d\", &nums[i]);\n",
        "two_arr": "    int n, m, a[1000], b[1000];\n    scanf(\"%d\", &n);\n    for (int i = 0; i < n; i++) scanf(\"%d\", &a[i]);\n    scanf(\"%d\", &m);\n    for (int i = 0; i < m; i++) scanf(\"%d\", &b[i]);\n",
        "one_int": "    int n;\n    scanf(\"%d\", &n);\n",
    }[shape]
    c = "#include <stdio.h>\n\nint main(void) {\n" + c_body + f"    /* {todo} */\n    return 0;\n}}\n"

    cpp_body = {
        "ints_line": "    long long a, b;\n    cin >> a >> b;\n",
        "line": "    string s;\n    getline(cin, s);\n",
        "arr": "    int n;\n    cin >> n;\n    vector<int> nums(n);\n    for (int& x : nums) cin >> x;\n",
        "n_t_arr": "    int n, target;\n    cin >> n >> target;\n    vector<int> nums(n);\n    for (int& x : nums) cin >> x;\n",
        "two_arr": "    int n, m;\n    cin >> n;\n    vector<int> a(n);\n    for (int& x : a) cin >> x;\n    cin >> m;\n    vector<int> b(m);\n    for (int& x : b) cin >> x;\n",
        "one_int": "    int n;\n    cin >> n;\n",
    }[shape]
    cpp = "#include <iostream>\n#include <string>\n#include <vector>\nusing namespace std;\n\nint main() {\n" + cpp_body + f"    // {todo}\n    return 0;\n}}\n"

    return {
        "python": py + f"\n# {todo}\n",
        "javascript": js + f"\n// {todo}\n",
        "java": java,
        "c": c,
        "cpp": cpp,
    }


def _problem(n, slug, title, difficulty, topic, tags, description, input_format, output_format, constraints,
             shape, todo, samples, hidden):
    """samples / hidden: lists of (input, output[, explanation]) tuples."""
    cases = [{"input": s[0], "expected_output": s[1], "is_hidden": False} for s in samples]
    cases += [{"input": h[0], "expected_output": h[1], "is_hidden": True} for h in hidden]
    return {
        "id": f"cp-{n:02d}",
        "slug": slug,
        "title": title,
        "difficulty": difficulty,
        "category": topic,
        "topic": topic,
        "tags": tags,
        "description": description,
        "input_format": input_format,
        "output_format": output_format,
        "constraints": constraints,
        "starter_code": _starters(shape, todo),
        "test_cases": cases,
        "examples": [{"input": s[0], "output": s[1], "explanation": s[2] if len(s) > 2 else ""} for s in samples],
        "companies": [],
        "appearances": 0,
        "hints": [],
    }


EXPANDED_CODING_PROBLEMS = [
    # ================= EASY =================
    _problem(
        1, "sum-two-numbers", "Sum of Two Numbers", "Easy", "Math", ["math", "input-output"],
        "Two whole numbers are given. Print their sum.",
        "One line (or two lines) with two integers a and b separated by whitespace.",
        "A single integer: a + b.",
        ["-10^12 <= a, b <= 10^12", "The sum can be larger than a 32-bit integer."],
        "ints_line", "print the sum of a and b",
        [("3 4", "7", "3 + 4 = 7."), ("10\n20", "30", "The numbers may be on separate lines.")],
        [("-5 5", "0"), ("100000 250000", "350000"), ("2000000000 2000000000", "4000000000")],
    ),
    _problem(
        2, "count-vowels", "Count the Vowels", "Easy", "Strings", ["strings", "counting"],
        "A line of text is given. Count how many of its letters are vowels (a, e, i, o, u), ignoring upper or lower case.",
        "One line of text with letters, digits, spaces and punctuation.",
        "A single integer: the number of vowels in the line.",
        ["1 <= length of the line <= 200"],
        "line", "print the number of vowels in s",
        [("Hello World", "3", "e, o, o."), ("rhythm", "0", "No vowels at all.")],
        [("AEIOU aeiou", "10"), ("Programming is fun", "5"), ("Education", "5")],
    ),
    _problem(
        3, "array-range", "Spread of an Array", "Easy", "Arrays", ["arrays", "min-max"],
        "A list of integers is given. Print the difference between the largest and the smallest value.",
        "The first line has n, the number of integers. The second line has the n integers separated by spaces.",
        "A single integer: maximum minus minimum.",
        ["1 <= n <= 100", "-10^6 <= each integer <= 10^6"],
        "arr", "print max(nums) - min(nums)",
        [("5\n3 9 1 7 4", "8", "9 - 1 = 8."), ("1\n42", "0", "One value: the spread is 0.")],
        [("4\n-5 -1 -9 -3", "8"), ("6\n10 10 10 10 10 10", "0"), ("3\n1000000 -1000000 5", "2000000")],
    ),
    _problem(
        4, "palindrome-phrase", "Palindrome Phrase", "Easy", "Two Pointers", ["two-pointers", "strings"],
        "A phrase reads the same forwards and backwards if, after dropping every character that is not a letter or a digit and ignoring upper or lower case, the remaining characters form a palindrome. Decide whether the given phrase does.",
        "One line of text.",
        "Print YES if the phrase is a palindrome in this sense, otherwise NO.",
        ["1 <= length of the line <= 200"],
        "line", "print YES or NO",
        [("A man, a plan, a canal: Panama", "YES", "Only letters remain: amanaplanacanalpanama."), ("hello world", "NO")],
        [("No lemon, no melon", "YES"), ("ab", "NO"), ("0P", "NO")],
    ),

    # ================= MEDIUM =================
    _problem(
        5, "pair-sum-exists", "Pair With a Given Sum", "Medium", "Hashing", ["hashing", "arrays"],
        "Given a list of integers and a target value, decide whether two different positions in the list hold numbers that add up to the target. A single position cannot be used twice.",
        "The first line has n and the target, separated by a space. The second line has the n integers.",
        "Print YES if such a pair exists, otherwise NO.",
        ["1 <= n <= 100", "-10^6 <= each integer, target <= 10^6"],
        "n_t_arr", "print YES or NO",
        [("5 9\n2 7 11 15 1", "YES", "2 + 7 = 9."), ("3 10\n1 2 3", "NO", "No two numbers add up to 10.")],
        [("2 6\n3 3", "YES"), ("1 4\n2", "NO"), ("4 0\n-3 4 3 90", "YES")],
    ),
    _problem(
        6, "balanced-brackets", "Balanced Brackets", "Medium", "Stack", ["stack", "strings"],
        "A string made only of the characters ( ) [ ] { } is given. It is balanced when every opening bracket is closed by the same kind of bracket, in the correct order.",
        "One line containing only the characters ( ) [ ] { }.",
        "Print YES if the string is balanced, otherwise NO.",
        ["1 <= length of the line <= 100"],
        "line", "print YES or NO",
        [("([]{})", "YES", "Every bracket closes the most recent open one."), ("(]", "NO", "] cannot close (.")],
        [("([)]", "NO"), ("(((", "NO"), ("{[()()]}", "YES")],
    ),
    _problem(
        7, "first-unique-char", "First Unique Letter", "Medium", "Hashing", ["hashing", "strings"],
        "A word of lowercase letters is given. Find the position (counting from 0) of the first letter that appears exactly once in the word.",
        "One line with a word of lowercase letters a to z.",
        "Print the 0-based position of the first letter that occurs once, or -1 if every letter repeats.",
        ["1 <= length of the word <= 100"],
        "line", "print the index, or -1",
        [("leetcode", "0", "l appears only once."), ("aabb", "-1", "Every letter repeats.")],
        [("loveleetcode", "2"), ("z", "0"), ("abcabcd", "6")],
    ),
    _problem(
        8, "merge-sorted-arrays", "Merge Two Sorted Lists", "Medium", "Sorting", ["sorting", "two-pointers"],
        "Two lists of integers are given, each already sorted from smallest to largest. Print one sorted list that contains all the numbers of both.",
        "Line 1: n. Line 2: n sorted integers. Line 3: m. Line 4: m sorted integers.",
        "One line with the n + m integers in sorted order, separated by single spaces.",
        ["1 <= n, m <= 100", "-10^6 <= each integer <= 10^6"],
        "two_arr", "print the merged list on one line",
        [("3\n1 4 9\n3\n2 3 10", "1 2 3 4 9 10"), ("1\n5\n2\n1 5", "1 5 5", "Equal values both stay.")],
        [("2\n-3 -1\n2\n-2 0", "-3 -2 -1 0"), ("1\n7\n1\n7", "7 7"), ("4\n1 2 3 4\n1\n0", "0 1 2 3 4")],
    ),
    _problem(
        9, "staircase-ways", "Staircase Ways", "Medium", "Recursion / DP", ["dp", "recursion", "counting"],
        "A staircase has n steps. Each move climbs 1, 2 or 3 steps. Count the different sequences of moves that reach exactly the top.",
        "One line with the integer n.",
        "A single integer: the number of different ways to climb n steps.",
        ["1 <= n <= 30", "The answer fits in a 32-bit integer."],
        "one_int", "print the number of ways",
        [("4", "7", "1+1+1+1, 1+1+2, 1+2+1, 2+1+1, 2+2, 1+3, 3+1."), ("1", "1")],
        [("3", "4"), ("10", "274"), ("30", "53798080")],
    ),

    # ================= HARD =================
    _problem(
        10, "longest-increasing-subsequence", "Longest Rising Run", "Hard", "Recursion / DP", ["dp", "arrays"],
        "From a list of integers you may delete any numbers (possibly none). Find the largest number of values that can remain so they are strictly increasing from left to right, without reordering them.",
        "The first line has n. The second line has the n integers.",
        "A single integer: the length of the longest strictly increasing subsequence.",
        ["1 <= n <= 100", "-10^6 <= each integer <= 10^6"],
        "arr", "print the length",
        [("8\n10 9 2 5 3 7 101 18", "4", "For example 2, 3, 7, 18."), ("4\n5 4 3 2", "1", "Any single value.")],
        [("5\n1 2 3 4 5", "5"), ("6\n0 8 4 12 2 10", "3"), ("7\n3 3 3 3 3 3 3", "1")],
    ),
    _problem(
        11, "fewest-coins", "Fewest Coins", "Hard", "Recursion / DP", ["dp", "math"],
        "You have unlimited coins of several values. Find the smallest number of coins whose values add up to exactly the given amount. Taking the biggest coin first is not always best.",
        "The first line has n (number of coin values) and the amount. The second line has the n coin values.",
        "A single integer: the fewest coins needed, or -1 if the amount cannot be formed.",
        ["1 <= n <= 10", "1 <= each coin value <= 1000", "1 <= amount <= 1000"],
        "n_t_arr", "print the fewest coins, or -1",
        [("3 11\n1 2 5", "3", "5 + 5 + 1."), ("1 7\n2", "-1", "Seven cannot be made from 2s.")],
        [("3 6\n1 3 4", "2"), ("2 1\n2 3", "-1"), ("4 27\n2 5 10 25", "2")],
    ),
    _problem(
        12, "subset-sum-count", "Count the Subsets", "Hard", "Recursion / DP", ["recursion", "backtracking", "dp"],
        "Given n positive integers, count the ways to choose some of them (by position, so equal numbers at different positions count separately) so that the chosen numbers add up to exactly the target.",
        "The first line has n and the target. The second line has the n positive integers.",
        "A single integer: the number of subsets whose sum equals the target.",
        ["1 <= n <= 20", "1 <= each integer, target <= 1000"],
        "n_t_arr", "print the number of subsets",
        [("4 5\n1 2 3 4", "2", "{1, 4} and {2, 3}."), ("3 10\n4 5 6", "1", "Only {4, 6}.")],
        [("4 2\n1 1 1 1", "6"), ("5 7\n1 2 3 4 5", "3"), ("6 10\n2 3 5 7 8 10", "4")],
    ),
]


def _normalize_problem_obj(p: dict) -> dict:
    """Split test_cases into the sample (shown) and hidden lists stored next to them."""
    doc = dict(p)
    cases = doc.get("test_cases", [])
    doc["sample_test_cases"] = [tc for tc in cases if not tc.get("is_hidden")]
    doc["hidden_test_cases"] = [tc for tc in cases if tc.get("is_hidden")]
    return doc
