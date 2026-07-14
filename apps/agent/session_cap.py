"""The hard spend cap (§8.1): end the session MAX_SESSION_MIN after the candidate
joins, no matter what, so a stuck voice loop can't burn provider minutes forever.

It lives here rather than inside main.entrypoint for one reason: this is the most
expensive thing in the system to get wrong, and CI installs pytest only — importing
main.py would drag in LiveKit/asyncpg and the test could never run. Duck-typed args
(agent/session/ctx) so the test can drive it with fakes.
"""

import asyncio
import logging
import time
from typing import Any

logger = logging.getLogger("maven.agent")


async def enforce_time_cap(
    agent: Any,
    session: Any,
    ctx: Any,
    interview_id: str,
    warning: str,
    total_s: float,
    warn_s: float,
    grace_s: float = 0.5,
) -> None:
    """Warn at total_s - warn_s, then finalize + tear down at total_s.

    Cancelled by end_interview when the plan finishes first (see _finalize).
    """
    # Anchored on a deadline, not a chain of sleeps: whatever the warning below costs
    # (a slow reply, a timeout), the teardown still happens at total_s.
    deadline = time.monotonic() + total_s
    try:
        # Warn first, then run out the rest of the clock. The cap used to fire cold: a
        # candidate mid-DSA-problem was cut off with no warning and graded on the
        # fragment. Now the interviewer gets a couple of minutes to land the question.
        await asyncio.sleep(max(0.0, deadline - warn_s - time.monotonic()))
        # The plan may already have finished — end_interview leaves this task armed on
        # purpose, so _ended is the guard. Telling a finished interview to "wrap up"
        # would talk over a closed session.
        if not agent._ended:
            logger.info(
                "interview %s — %ss left, telling the interviewer to wrap up",
                interview_id,
                warn_s,
            )
            try:
                # Bounded and swallowed on purpose. This is the SPEND cap: if the
                # warning raises (provider blip, session tearing down) or hangs, an
                # unguarded await would kill this task and with it the finalize +
                # aclose + delete_room below — the room would bill on forever. A missing
                # courtesy warning is survivable; a runaway session is not.
                await asyncio.wait_for(
                    session.generate_reply(instructions=warning), timeout=warn_s
                )
            except asyncio.CancelledError:
                raise  # the plan finished — real cancellation, not a warning failure
            except Exception:
                logger.exception(
                    "interview %s — time warning failed; capping on schedule anyway",
                    interview_id,
                )
        await asyncio.sleep(max(0.0, deadline - time.monotonic()))
    except asyncio.CancelledError:
        return

    logger.info("interview %s hit the %ss cap — ending", interview_id, total_s)
    await agent._finalize("time cap")
    await asyncio.sleep(grace_s)  # let the reliable "ended" frame reach the browser
    try:
        await session.aclose()  # stop STT/LLM/TTS billing
    except Exception:
        logger.exception("session close on cap failed")
    try:
        await ctx.delete_room()  # disconnect + close the room (stops SFU minutes)
    except Exception:
        logger.exception("room delete on cap failed")
