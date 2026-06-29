"""Coding-round grading: the SECRET half of the coding problems + the Judge0
sandbox client (architecture §4.2, §8 F3).

The public half of each problem (statement, starter code) lives in
packages/shared/src/coding.ts and reaches the browser. The stdin + the REFERENCE
SOLVER that derives the expected stdout live here, with the agent, and never
travel to the client — otherwise a candidate could read the expected output from
room metadata and hard-code it (F1, §8.1). The two halves are linked by problem
id; a pytest (test_coding_contract.py) asserts every shared problem has a grader.

The agent runs the candidate's code by POSTing it to a Judge0 instance
(JUDGE0_URL): an isolated sandbox with no host FS, no network, and CPU/memory/
wall-clock limits. We compute the expected output ourselves (the reference solver
applied to the test's stdin) and compare it to the captured stdout, so the verdict
doesn't depend on Judge0's exact output-comparison mode.

Each solver takes the raw stdin string and returns the expected stdout (trailing
newline doesn't matter — grade() is whitespace-tolerant). Deriving expected from a
solver, rather than hard-coding an output string per problem, is what keeps a
large bank correct: __main__ runs every solver against a known value, so a wrong
grader fails loudly instead of silently passing a bad answer.
"""

import math
import os
from collections import Counter

# Judge0 CE language ids (default install). Override the ids if your instance
# maps languages differently — `GET {JUDGE0_URL}/languages` lists them.
LANGUAGE_IDS = {
    "python": 71,  # Python 3
    "javascript": 63,  # JavaScript (Node.js)
}


# ─────────────────────────── reference solvers ───────────────────────────
# Pure str -> str. Each reads the same input format the public prompt states and
# returns the expected stdout. Single representative case per problem (ponytail:
# upgrade to a battery via Judge0 batch submissions when one case isn't enough).


def _fizzbuzz(s: str) -> str:
    n = int(s.split()[0])
    out = []
    for i in range(1, n + 1):
        if i % 15 == 0:
            out.append("FizzBuzz")
        elif i % 3 == 0:
            out.append("Fizz")
        elif i % 5 == 0:
            out.append("Buzz")
        else:
            out.append(str(i))
    return "\n".join(out)


def _vowel_count(s: str) -> str:
    line = s.split("\n")[0]
    return str(sum(c in "aeiou" for c in line.lower()))


def _sum_n(s: str) -> str:
    n = int(s.split()[0])
    return str(n * (n + 1) // 2)


def _reverse_string(s: str) -> str:
    return s.split("\n")[0][::-1]


def _max_of_list(s: str) -> str:
    return str(max(map(int, s.split("\n")[1].split())))


def _count_evens(s: str) -> str:
    nums = list(map(int, s.split("\n")[1].split()))
    return str(sum(1 for x in nums if x % 2 == 0))


def _factorial(s: str) -> str:
    return str(math.factorial(int(s.split()[0])))


def _palindrome_check(s: str) -> str:
    line = s.split("\n")[0]
    return "YES" if line == line[::-1] else "NO"


def _count_words(s: str) -> str:
    return str(len(s.split("\n")[0].split()))


def _second_largest(s: str) -> str:
    nums = sorted(map(int, s.split("\n")[1].split()), reverse=True)
    return str(nums[1])


def _gcd(s: str) -> str:
    a, b = map(int, s.split()[:2])
    return str(math.gcd(a, b))


def _digit_sum(s: str) -> str:
    return str(sum(int(c) for c in s.split()[0]))


def _max_subarray(s: str) -> str:
    nums = list(map(int, s.split("\n")[1].split()))
    best = cur = nums[0]
    for x in nums[1:]:
        cur = max(x, cur + x)
        best = max(best, cur)
    return str(best)


def _two_sum(s: str) -> str:
    lines = s.split("\n")
    nums = list(map(int, lines[1].split()))
    target = int(lines[2])
    seen = set()
    for x in nums:
        if target - x in seen:
            return "YES"
        seen.add(x)
    return "NO"


def _binary_search(s: str) -> str:
    lines = s.split("\n")
    arr = list(map(int, lines[1].split()))
    x = int(lines[2])
    lo, hi = 0, len(arr) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if arr[mid] == x:
            return str(mid)
        if arr[mid] < x:
            lo = mid + 1
        else:
            hi = mid - 1
    return "-1"


def _anagram(s: str) -> str:
    lines = s.split("\n")
    return "YES" if sorted(lines[0]) == sorted(lines[1]) else "NO"


def _fibonacci(s: str) -> str:
    n = int(s.split()[0])
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return str(a)


def _count_primes(s: str) -> str:
    n = int(s.split()[0])
    if n < 2:
        return "0"
    sieve = [True] * n
    sieve[0] = sieve[1] = False
    for i in range(2, int(n**0.5) + 1):
        if sieve[i]:
            for j in range(i * i, n, i):
                sieve[j] = False
    return str(sum(sieve))


def _first_unique_char(s: str) -> str:
    line = s.split("\n")[0]
    cnt = Counter(line)
    for i, c in enumerate(line):
        if cnt[c] == 1:
            return str(i)
    return "-1"


def _valid_parentheses(s: str) -> str:
    line = s.split("\n")[0]
    pairs = {")": "(", "]": "[", "}": "{"}
    st = []
    for c in line:
        if c in "([{":
            st.append(c)
        elif c in pairs:
            if not st or st.pop() != pairs[c]:
                return "NO"
    return "YES" if not st else "NO"


def _missing_number(s: str) -> str:
    lines = s.split("\n")
    n = int(lines[0])
    nums = list(map(int, lines[1].split()))
    return str(n * (n + 1) // 2 - sum(nums))


def _majority_element(s: str) -> str:
    nums = list(map(int, s.split("\n")[1].split()))
    count = 0
    cand = None
    for x in nums:
        if count == 0:
            cand = x
        count += 1 if x == cand else -1
    return str(cand)


def _move_zeroes(s: str) -> str:
    nums = list(map(int, s.split("\n")[1].split()))
    nonzero = [x for x in nums if x != 0]
    zeros = [0] * (len(nums) - len(nonzero))
    return " ".join(map(str, nonzero + zeros))


def _power(s: str) -> str:
    b, e = map(int, s.split()[:2])
    return str(b**e)


def _longest_unique(s: str) -> str:
    line = s.split("\n")[0]
    seen: dict = {}
    start = best = 0
    for i, c in enumerate(line):
        if c in seen and seen[c] >= start:
            start = seen[c] + 1
        seen[c] = i
        best = max(best, i - start + 1)
    return str(best)


def _lcs(s: str) -> str:
    lines = s.split("\n")
    a, b = lines[0], lines[1]
    m, n = len(a), len(b)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            dp[i][j] = (
                dp[i - 1][j - 1] + 1
                if a[i - 1] == b[j - 1]
                else max(dp[i - 1][j], dp[i][j - 1])
            )
    return str(dp[m][n])


def _edit_distance(s: str) -> str:
    lines = s.split("\n")
    a, b = lines[0], lines[1]
    m, n = len(a), len(b)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(m + 1):
        dp[i][0] = i
    for j in range(n + 1):
        dp[0][j] = j
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if a[i - 1] == b[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = 1 + min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    return str(dp[m][n])


def _coin_change(s: str) -> str:
    lines = s.split("\n")
    coins = list(map(int, lines[1].split()))
    amount = int(lines[2])
    inf = amount + 1
    dp = [0] + [inf] * amount
    for a in range(1, amount + 1):
        for c in coins:
            if c <= a:
                dp[a] = min(dp[a], dp[a - c] + 1)
    return str(dp[amount] if dp[amount] != inf else -1)


def _lis(s: str) -> str:
    import bisect

    nums = list(map(int, s.split("\n")[1].split()))
    tails: list = []
    for x in nums:
        i = bisect.bisect_left(tails, x)
        if i == len(tails):
            tails.append(x)
        else:
            tails[i] = x
    return str(len(tails))


def _trapping_rain(s: str) -> str:
    h = list(map(int, s.split("\n")[1].split()))
    lo, hi = 0, len(h) - 1
    lmax = rmax = water = 0
    while lo < hi:
        if h[lo] < h[hi]:
            lmax = max(lmax, h[lo])
            water += lmax - h[lo]
            lo += 1
        else:
            rmax = max(rmax, h[hi])
            water += rmax - h[hi]
            hi -= 1
    return str(water)


def _min_path_sum(s: str) -> str:
    lines = s.split("\n")
    r, c = map(int, lines[0].split())
    grid = [list(map(int, lines[1 + i].split())) for i in range(r)]
    dp = [[0] * c for _ in range(r)]
    for i in range(r):
        for j in range(c):
            if i == 0 and j == 0:
                dp[i][j] = grid[i][j]
            elif i == 0:
                dp[i][j] = dp[i][j - 1] + grid[i][j]
            elif j == 0:
                dp[i][j] = dp[i - 1][j] + grid[i][j]
            else:
                dp[i][j] = min(dp[i - 1][j], dp[i][j - 1]) + grid[i][j]
    return str(dp[r - 1][c - 1])


def _house_robber(s: str) -> str:
    nums = list(map(int, s.split("\n")[1].split()))
    prev = curr = 0
    for x in nums:
        prev, curr = curr, max(curr, prev + x)
    return str(curr)


def _knapsack(s: str) -> str:
    lines = s.split("\n")
    n, w = map(int, lines[0].split())
    weights = list(map(int, lines[1].split()))
    values = list(map(int, lines[2].split()))
    dp = [0] * (w + 1)
    for i in range(n):
        for cap in range(w, weights[i] - 1, -1):
            dp[cap] = max(dp[cap], dp[cap - weights[i]] + values[i])
    return str(dp[w])


def _longest_palindrome_substr(s: str) -> str:
    line = s.split("\n")[0]
    if not line:
        return "0"

    def expand(left: int, right: int) -> int:
        while left >= 0 and right < len(line) and line[left] == line[right]:
            left -= 1
            right += 1
        return right - left - 1

    best = 1
    for i in range(len(line)):
        best = max(best, expand(i, i), expand(i, i + 1))
    return str(best)


def _num_islands(s: str) -> str:
    lines = s.split("\n")
    r, c = map(int, lines[0].split())
    grid = [list(lines[1 + i]) for i in range(r)]
    count = 0

    def sink(si: int, sj: int) -> None:
        stack = [(si, sj)]
        while stack:
            x, y = stack.pop()
            if 0 <= x < r and 0 <= y < c and grid[x][y] == "1":
                grid[x][y] = "0"
                stack.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])

    for i in range(r):
        for j in range(c):
            if grid[i][j] == "1":
                count += 1
                sink(i, j)
    return str(count)


def _jump_game(s: str) -> str:
    nums = list(map(int, s.split("\n")[1].split()))
    jumps = end = farthest = 0
    for i in range(len(nums) - 1):
        farthest = max(farthest, i + nums[i])
        if i == end:
            jumps += 1
            end = farthest
    return str(jumps)


# Secret tests, keyed by the problem id in packages/shared/src/coding.ts. The
# program reads `stdin` and prints; `solve` derives the expected stdout from it.
TESTS = {
    # easy
    "c-fizzbuzz": {"stdin": "5\n", "solve": _fizzbuzz},
    "c-vowel-count": {"stdin": "Hello World\n", "solve": _vowel_count},
    "c-sum-n": {"stdin": "10\n", "solve": _sum_n},
    "c-reverse-string": {"stdin": "hello\n", "solve": _reverse_string},
    "c-max-of-list": {"stdin": "5\n3 7 2 9 4\n", "solve": _max_of_list},
    "c-count-evens": {"stdin": "6\n1 2 3 4 5 6\n", "solve": _count_evens},
    "c-factorial": {"stdin": "5\n", "solve": _factorial},
    "c-palindrome-check": {"stdin": "racecar\n", "solve": _palindrome_check},
    "c-count-words": {"stdin": "the quick brown fox\n", "solve": _count_words},
    "c-second-largest": {"stdin": "5\n10 4 8 1 7\n", "solve": _second_largest},
    "c-gcd": {"stdin": "48 36\n", "solve": _gcd},
    "c-digit-sum": {"stdin": "12345\n", "solve": _digit_sum},
    # medium
    "c-max-subarray": {"stdin": "9\n-2 1 -3 4 -1 2 1 -5 4\n", "solve": _max_subarray},
    "c-two-sum": {"stdin": "4\n2 7 11 15\n9\n", "solve": _two_sum},
    "c-binary-search": {"stdin": "5\n1 3 5 7 9\n7\n", "solve": _binary_search},
    "c-anagram": {"stdin": "listen\nsilent\n", "solve": _anagram},
    "c-fibonacci": {"stdin": "10\n", "solve": _fibonacci},
    "c-count-primes": {"stdin": "10\n", "solve": _count_primes},
    "c-first-unique-char": {"stdin": "aabbc\n", "solve": _first_unique_char},
    "c-valid-parentheses": {"stdin": "([]{})\n", "solve": _valid_parentheses},
    "c-missing-number": {"stdin": "4\n3 0 1 4\n", "solve": _missing_number},
    "c-majority-element": {"stdin": "7\n3 3 4 2 3 3 3\n", "solve": _majority_element},
    "c-move-zeroes": {"stdin": "6\n0 1 0 3 12 0\n", "solve": _move_zeroes},
    "c-power": {"stdin": "2 10\n", "solve": _power},
    # hard
    "c-longest-unique": {"stdin": "abcabcbb\n", "solve": _longest_unique},
    "c-lcs": {"stdin": "abcde\nace\n", "solve": _lcs},
    "c-edit-distance": {"stdin": "horse\nros\n", "solve": _edit_distance},
    "c-coin-change": {"stdin": "3\n1 2 5\n11\n", "solve": _coin_change},
    "c-lis": {"stdin": "8\n10 9 2 5 3 7 101 18\n", "solve": _lis},
    "c-trapping-rain": {
        "stdin": "12\n0 1 0 2 1 0 1 3 2 1 2 1\n",
        "solve": _trapping_rain,
    },
    "c-min-path-sum": {"stdin": "3 3\n1 3 1\n1 5 1\n4 2 1\n", "solve": _min_path_sum},
    "c-house-robber": {"stdin": "5\n2 7 9 3 1\n", "solve": _house_robber},
    "c-knapsack": {"stdin": "4 7\n1 3 4 5\n1 4 5 7\n", "solve": _knapsack},
    "c-longest-palindrome-substr": {
        "stdin": "babad\n",
        "solve": _longest_palindrome_substr,
    },
    "c-num-islands": {
        "stdin": "4 5\n11110\n11010\n11000\n00000\n",
        "solve": _num_islands,
    },
    "c-jump-game": {"stdin": "5\n2 3 1 1 4\n", "solve": _jump_game},
}


def expected_for(problem_id: str) -> str:
    """The expected stdout for a problem: its reference solver applied to its
    test stdin. The single source of truth the candidate's output is graded on."""
    test = TESTS[problem_id]
    return test["solve"](test["stdin"])


def _norm(s: str) -> str:
    """Trailing-whitespace-insensitive normalization so a missing final newline or
    a trailing space doesn't fail an otherwise-correct answer."""
    return "\n".join(line.rstrip() for line in (s or "").split("\n")).rstrip("\n")


def grade(expected: str, actual: str) -> bool:
    return _norm(expected) == _norm(actual)


async def run_on_judge0(language: str, source: str, stdin: str) -> dict:
    """Execute `source` in the Judge0 sandbox against `stdin`. Returns the raw
    Judge0 submission result (stdout/stderr/status/...). Raises on a missing
    JUDGE0_URL, an unsupported language, or a transport error. We grade the
    captured stdout ourselves (against expected_for), so Judge0 needn't compare."""
    import aiohttp  # lazy so the pure grading logic stays importable without it

    base = os.environ.get("JUDGE0_URL")
    if not base:
        raise RuntimeError("JUDGE0_URL not set — coding sandbox unavailable")
    lang_id = LANGUAGE_IDS.get(language)
    if lang_id is None:
        raise ValueError(f"unsupported language: {language}")

    headers = {"Content-Type": "application/json"}
    token = os.environ.get("JUDGE0_AUTH_TOKEN")
    if token:
        headers["X-Auth-Token"] = token  # self-hosted Judge0 auth (optional)

    payload = {
        "source_code": source,
        "language_id": lang_id,
        "stdin": stdin,
        "cpu_time_limit": 5,
        "memory_limit": 128000,
    }
    url = base.rstrip("/") + "/submissions?base64_encoded=false&wait=true"
    async with aiohttp.ClientSession() as session:
        async with session.post(
            url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=20)
        ) as resp:
            resp.raise_for_status()
            return await resp.json()


if __name__ == "__main__":
    # Verify every grader: the reference solver, run on the test stdin, must equal
    # the hand-computed value below. Catches a wrong solver OR a mis-stated prompt
    # before it can silently pass a bad candidate answer. Grow the bank → add a row.
    EXPECTED = {
        "c-fizzbuzz": "1\n2\nFizz\n4\nBuzz",
        "c-vowel-count": "3",
        "c-sum-n": "55",
        "c-reverse-string": "olleh",
        "c-max-of-list": "9",
        "c-count-evens": "3",
        "c-factorial": "120",
        "c-palindrome-check": "YES",
        "c-count-words": "4",
        "c-second-largest": "8",
        "c-gcd": "12",
        "c-digit-sum": "15",
        "c-max-subarray": "6",
        "c-two-sum": "YES",
        "c-binary-search": "3",
        "c-anagram": "YES",
        "c-fibonacci": "55",
        "c-count-primes": "4",
        "c-first-unique-char": "4",
        "c-valid-parentheses": "YES",
        "c-missing-number": "2",
        "c-majority-element": "3",
        "c-move-zeroes": "1 3 12 0 0 0",
        "c-power": "1024",
        "c-longest-unique": "3",
        "c-lcs": "3",
        "c-edit-distance": "3",
        "c-coin-change": "3",
        "c-lis": "4",
        "c-trapping-rain": "6",
        "c-min-path-sum": "7",
        "c-house-robber": "12",
        "c-knapsack": "9",
        "c-longest-palindrome-substr": "3",
        "c-num-islands": "1",
        "c-jump-game": "2",
    }
    assert set(EXPECTED) == set(TESTS), set(EXPECTED) ^ set(TESTS)
    for pid in TESTS:
        got = expected_for(pid)
        assert got == EXPECTED[pid], (pid, repr(got), repr(EXPECTED[pid]))
    # grade() stays trailing-whitespace tolerant
    assert grade("6\n", "6")
    assert grade("3\n", "3 \n")
    assert not grade("6\n", "7\n")
    assert LANGUAGE_IDS["python"] == 71 and LANGUAGE_IDS["javascript"] == 63
    print(f"ok — {len(TESTS)} graders verified")
