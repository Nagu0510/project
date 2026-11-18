"""One correct Python 3 solution per coding problem (stdin -> stdout).

Used only to prove the expected outputs are right: by tests/test_judge.py (locally) and by
scripts/check_reference_solutions.py (through the real online compiler). Never served to students.
"""

REFERENCE_SOLUTIONS = {
    "sum-two-numbers": """
import sys
a, b = map(int, sys.stdin.read().split())
print(a + b)
""",
    "count-vowels": """
s = input()
print(sum(1 for ch in s.lower() if ch in "aeiou"))
""",
    "array-range": """
import sys
d = sys.stdin.read().split()
n = int(d[0])
nums = list(map(int, d[1:1 + n]))
print(max(nums) - min(nums))
""",
    "palindrome-phrase": """
s = input()
t = [c.lower() for c in s if c.isalnum()]
print("YES" if t == t[::-1] else "NO")
""",
    "pair-sum-exists": """
import sys
d = sys.stdin.read().split()
n, target = int(d[0]), int(d[1])
nums = list(map(int, d[2:2 + n]))
seen = set()
found = False
for x in nums:
    if target - x in seen:
        found = True
        break
    seen.add(x)
print("YES" if found else "NO")
""",
    "balanced-brackets": """
s = input().strip()
pairs = {")": "(", "]": "[", "}": "{"}
stack = []
ok = True
for ch in s:
    if ch in "([{":
        stack.append(ch)
    elif not stack or stack.pop() != pairs[ch]:
        ok = False
        break
print("YES" if ok and not stack else "NO")
""",
    "first-unique-char": """
from collections import Counter
s = input().strip()
count = Counter(s)
print(next((i for i, ch in enumerate(s) if count[ch] == 1), -1))
""",
    "merge-sorted-arrays": """
import sys
d = sys.stdin.read().split()
n = int(d[0])
a = list(map(int, d[1:1 + n]))
m = int(d[1 + n])
b = list(map(int, d[2 + n:2 + n + m]))
i = j = 0
out = []
while i < n and j < m:
    if a[i] <= b[j]:
        out.append(a[i]); i += 1
    else:
        out.append(b[j]); j += 1
out += a[i:] + b[j:]
print(" ".join(map(str, out)))
""",
    "staircase-ways": """
n = int(input().split()[0])
ways = [1] + [0] * n
for i in range(1, n + 1):
    ways[i] = sum(ways[i - k] for k in (1, 2, 3) if i - k >= 0)
print(ways[n])
""",
    "longest-increasing-subsequence": """
import sys
d = sys.stdin.read().split()
n = int(d[0])
nums = list(map(int, d[1:1 + n]))
best = [1] * n
for i in range(n):
    for j in range(i):
        if nums[j] < nums[i]:
            best[i] = max(best[i], best[j] + 1)
print(max(best))
""",
    "fewest-coins": """
import sys
d = sys.stdin.read().split()
n, amount = int(d[0]), int(d[1])
coins = list(map(int, d[2:2 + n]))
INF = float("inf")
dp = [0] + [INF] * amount
for v in range(1, amount + 1):
    for c in coins:
        if c <= v and dp[v - c] + 1 < dp[v]:
            dp[v] = dp[v - c] + 1
print(dp[amount] if dp[amount] != INF else -1)
""",
    "subset-sum-count": """
import sys
d = sys.stdin.read().split()
n, target = int(d[0]), int(d[1])
nums = list(map(int, d[2:2 + n]))

def count(i, left):
    if left == 0:
        return 1
    if i == n or left < 0:
        return 0
    return count(i + 1, left - nums[i]) + count(i + 1, left)

print(count(0, target))
""",
}
