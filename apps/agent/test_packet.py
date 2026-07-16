"""The run_result strip is the only control message that carries unbounded candidate
output, and an oversized one is dropped by LiveKit without raising — so nothing but
this test stands between a big program output and a silently blank result panel."""

from packet import MAX_PACKET_BYTES, TRUNCATED, encoded_len, fit_run_result


def _run_result(**fields) -> dict:
    return {
        "type": "run_result",
        "ok": True,
        "passed": False,
        "stdout": "",
        "stderr": "",
        "status": "Accepted",
        **fields,
    }


def test_small_message_passes_through_untouched():
    msg = _run_result(stdout="4\n", passed=True)
    assert fit_run_result(msg) == msg


def test_non_ascii_output_is_bounded():
    # The case a per-field character cap misses: 4k chars is under MAX_RESULT_CHARS,
    # but \\uXXXX escaping makes it ~6x the packet ceiling.
    msg = _run_result(stdout="日" * 4_000)
    assert encoded_len(msg) > MAX_PACKET_BYTES
    assert encoded_len(fit_run_result(msg)) <= MAX_PACKET_BYTES


def test_both_fields_large_together():
    msg = _run_result(stdout="x" * 40_000, stderr="y" * 40_000)
    assert encoded_len(fit_run_result(msg)) <= MAX_PACKET_BYTES


def test_verdict_fields_survive_trimming():
    fitted = fit_run_result(_run_result(stdout="🙂" * 8_000, passed=True, status="WA"))
    assert fitted["ok"] is True
    assert fitted["passed"] is True
    assert fitted["status"] == "WA"
    assert fitted["type"] == "run_result"


def test_trimmed_output_is_marked():
    fitted = fit_run_result(_run_result(stdout="x" * 40_000))
    assert fitted["stdout"].endswith(TRUNCATED)
    assert fitted["stdout"].startswith("xxx")


def test_budget_is_respected_even_when_output_is_incompressible():
    # Every char escapes to 6 bytes, so the search has to bottom out near zero.
    msg = _run_result(stdout="中" * 100_000, stderr="中" * 100_000)
    assert encoded_len(fit_run_result(msg)) <= MAX_PACKET_BYTES
