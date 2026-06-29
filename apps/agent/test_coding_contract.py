"""The public coding bank (packages/shared/src/coding.ts) and the secret graders
(coding.py) are two halves linked by problem id. They live in different languages,
so nothing but this test stops them drifting — a shared problem with no grader
would fail an interview's coding round at runtime ("no active coding problem")."""

import re
from pathlib import Path

from coding import TESTS

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
