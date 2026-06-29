"""Coding-round grading: the SECRET half of the coding problems + the Judge0
sandbox client (architecture §4.2, §8 F3).

The public half of each problem (statement, starter code) lives in
packages/shared/src/coding.ts and reaches the browser. The stdin + expected
stdout used to GRADE live here, with the agent, and never travel to the client —
otherwise a candidate could read the expected output from room metadata and
hard-code it (F1, §8.1). The two halves are linked by problem id.

The agent runs the candidate's code by POSTing it to a Judge0 instance
(JUDGE0_URL): an isolated sandbox with no host FS, no network, and CPU/memory/
wall-clock limits. We compute pass/fail ourselves from the captured stdout so the
verdict doesn't depend on Judge0's exact output-comparison mode.
"""

import os

# Judge0 CE language ids (default install). Override the ids if your instance
# maps languages differently — `GET {JUDGE0_URL}/languages` lists them.
LANGUAGE_IDS = {
    "python": 71,  # Python 3
    "javascript": 63,  # JavaScript (Node.js)
}

# Secret graders, keyed by the problem id in packages/shared/src/coding.ts. One
# representative stdin/expected per problem; the program reads stdin and prints.
TESTS = {
    # easy
    "c-fizzbuzz": {"stdin": "5\n", "expected": "1\n2\nFizz\n4\nBuzz\n"},
    "c-vowel-count": {"stdin": "Hello World\n", "expected": "3\n"},
    # medium
    "c-max-subarray": {
        "stdin": "9\n-2 1 -3 4 -1 2 1 -5 4\n",
        "expected": "6\n",
    },
    "c-two-sum": {"stdin": "4\n2 7 11 15\n9\n", "expected": "YES\n"},
    # hard
    "c-longest-unique": {"stdin": "abcabcbb\n", "expected": "3\n"},
    "c-lcs": {"stdin": "abcde\nace\n", "expected": "3\n"},
}


def _norm(s: str) -> str:
    """Trailing-whitespace-insensitive normalization so a missing final newline or
    a trailing space doesn't fail an otherwise-correct answer."""
    return "\n".join(line.rstrip() for line in (s or "").split("\n")).rstrip("\n")


def grade(expected: str, actual: str) -> bool:
    return _norm(expected) == _norm(actual)


async def run_on_judge0(
    language: str, source: str, stdin: str, expected: str
) -> dict:
    """Execute `source` in the Judge0 sandbox against `stdin`. Returns the raw
    Judge0 submission result (stdout/stderr/status/...). Raises on a missing
    JUDGE0_URL, an unsupported language, or a transport error."""
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
        "expected_output": expected,
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
    # ponytail: one runnable check for the only non-trivial pure logic here — the
    # trailing-whitespace-insensitive grade compare. The Judge0 call is glue.
    assert grade("6\n", "6\n")
    assert grade("6\n", "6")  # missing final newline still passes
    assert grade("1\n2\nFizz\n4\nBuzz\n", "1\n2\nFizz\n4\nBuzz")
    assert grade("3\n", "3 \n")  # trailing space on the line
    assert not grade("6\n", "7\n")
    assert not grade("3\n", "33\n")
    assert LANGUAGE_IDS["python"] == 71 and LANGUAGE_IDS["javascript"] == 63
    # every shared coding problem must have a secret grader
    for pid in (
        "c-fizzbuzz",
        "c-vowel-count",
        "c-max-subarray",
        "c-two-sum",
        "c-longest-unique",
        "c-lcs",
    ):
        assert pid in TESTS, pid
    print("ok — coding grade + tests")
