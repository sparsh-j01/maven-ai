"""Fit a control message into a LiveKit reliable data packet (§7.4).

LiveKit drops an oversized reliable packet silently — no error, no exception, the
publish just returns. The candidate sees nothing at all and waits out the client's
"no response" timeout, which reads like the sandbox hung.

Capping stdout/stderr by CHARACTER count can't prevent that. json.dumps escapes
non-ASCII to \\uXXXX by default, so one character costs 6 bytes: 4k chars of CJK or
emoji output serializes to ~24KB per field. The transport limits the encoded frame,
so the encoded frame is what we budget.

Lives outside main.py so it can be tested without the LiveKit stack — same reason as
session_cap.py.
"""

import json

# LiveKit's reliable data packet ceiling is 15 KiB; this leaves headroom for the
# envelope the SDK wraps around our payload. Trimming the strip costs nothing real:
# grading runs on the full stdout agent-side (main.py `_run_code`), so this only ever
# shortens what's echoed to the screen, never what the verdict is computed from.
MAX_PACKET_BYTES = 12_000

# Without a marker, truncated output looks like the program simply stopped there.
TRUNCATED = "\n[truncated]"

# Only these two carry candidate output; everything else in a run_result is a verdict
# field (ok/passed/status) that must survive intact for the UI to render correctly.
_TRIMMABLE = ("stdout", "stderr")


def encoded_len(msg: dict) -> int:
    """Bytes on the wire — what LiveKit measures, not len(str)."""
    return len(json.dumps(msg).encode())


def fit_run_result(msg: dict, budget: int = MAX_PACKET_BYTES) -> dict:
    """Return `msg` with stdout/stderr shrunk until the serialized frame fits `budget`.

    Binary-searches the character limit rather than computing it: escape expansion is
    per-character (1 byte for ASCII, 6 for an escaped BMP char), so bytes can't be
    converted back to a character count directly.
    """
    if encoded_len(msg) <= budget:
        return msg

    def sliced(limit: int) -> dict:
        out = dict(msg)
        for field in _TRIMMABLE:
            text = out.get(field) or ""
            if len(text) > limit:
                out[field] = text[:limit] + TRUNCATED
        return out

    lo, hi = 0, max(len(msg.get(f) or "") for f in _TRIMMABLE)
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if encoded_len(sliced(mid)) <= budget:
            lo = mid
        else:
            hi = mid - 1
    return sliced(lo)


if __name__ == "__main__":
    # A frame that only the byte budget catches: 4k CJK chars is well under any
    # per-field character cap and ~6x over the packet ceiling once escaped.
    big = {"type": "run_result", "ok": True, "passed": False, "stdout": "日" * 4_000}
    assert encoded_len(big) > MAX_PACKET_BYTES
    assert encoded_len(fit_run_result(big)) <= MAX_PACKET_BYTES
    print("packet ok")
