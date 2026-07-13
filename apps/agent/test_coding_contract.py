"""The public coding bank (packages/shared/src/coding.ts) and the secret graders
(coding.py) are two halves linked by problem id. They live in different languages,
so nothing but this test stops them drifting — a shared problem with no grader
would fail an interview's coding round at runtime ("no active coding problem")."""

import re
from pathlib import Path

from coding import TESTS, cases_for

CODING_TS = (
    Path(__file__).resolve().parents[2] / "packages" / "shared" / "src" / "coding.ts"
)


def _shared_ids() -> set:
    text = CODING_TS.read_text()
    ids = set(re.findall(r'id:\s*"(c-[a-z0-9-]+)"', text))
    assert ids, "no problem ids parsed from coding.ts"
    return ids


def test_every_shared_problem_has_a_grader():
    missing = [pid for pid in _shared_ids() if pid not in TESTS]
    assert not missing, f"shared coding problems without a grader: {missing}"


def test_no_orphan_graders():
    ids = _shared_ids()
    orphans = [pid for pid in TESTS if pid not in ids]
    assert not orphans, f"graders with no shared problem: {orphans}"


def test_multiple_distinct_cases_defeat_hardcoding():
    """Every problem grades against >=2 hidden cases whose expected answers differ,
    so a submission that hard-codes the answer to one case fails the others (F1).
    A well-formed stdin yields a non-empty expected; a duplicate answer would let a
    constant output pass, so we forbid it. Grow the battery → keep answers distinct."""
    for pid in TESTS:
        cases = cases_for(pid)
        assert len(cases) >= 2, f"{pid}: needs >=2 hidden cases"
        expected = [e for _, e in cases]
        assert all(e != "" for e in expected), f"{pid}: empty expected (malformed stdin?)"
        assert len(set(expected)) >= 2, (
            f"{pid}: all cases share expected {expected[0]!r} — a constant-output "
            "solution would pass; add a case with a different answer"
        )
