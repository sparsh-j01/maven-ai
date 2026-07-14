"""The cap is the spend guard — if it dies, the room bills until someone notices.

CI installs pytest only, so these drive session_cap with fakes and asyncio.run
(no pytest-asyncio, no LiveKit).
"""

import asyncio
import time

from session_cap import enforce_time_cap

TOTAL, WARN = 0.12, 0.06


class FakeAgent:
    def __init__(self, ended: bool = False, finalize=None) -> None:
        self._ended = ended
        self.finalized: list[str] = []
        self._finalize_mode = finalize

    async def _finalize(self, reason: str) -> None:
        self.finalized.append(reason)
        if self._finalize_mode == "raise":
            raise RuntimeError("publish blew up")
        if self._finalize_mode == "hang":
            await asyncio.sleep(3600)  # a stalled DB write or room publish


class FakeSession:
    def __init__(self, reply=None, close=None) -> None:
        self.closed = False
        self.warned = 0
        self._reply = reply
        self._close = close

    async def generate_reply(self, instructions: str) -> None:
        self.warned += 1
        if self._reply == "raise":
            raise RuntimeError("provider blew up")
        if self._reply == "hang":
            await asyncio.sleep(3600)

    async def aclose(self) -> None:
        if self._close == "hang":
            await asyncio.sleep(3600)
        self.closed = True


class FakeCtx:
    def __init__(self) -> None:
        self.deleted = False

    async def delete_room(self) -> None:
        self.deleted = True


def run(agent, session, ctx):
    started = time.monotonic()
    asyncio.run(
        enforce_time_cap(
            agent,
            session,
            ctx,
            "iv1",
            "wrap up",
            TOTAL,
            WARN,
            grace_s=0.0,
            step_s=0.05,
        )
    )
    return time.monotonic() - started


def test_happy_path_warns_then_tears_down():
    agent, session, ctx = FakeAgent(), FakeSession(), FakeCtx()
    run(agent, session, ctx)
    assert session.warned == 1
    assert agent.finalized == ["time cap"]
    assert session.closed and ctx.deleted


def test_warning_raises_but_teardown_still_runs():
    # The bug: an unguarded generate_reply took the whole task down with it, so the
    # session was never closed and the room billed on.
    agent, session, ctx = FakeAgent(), FakeSession("raise"), FakeCtx()
    run(agent, session, ctx)
    assert agent.finalized == ["time cap"]
    assert session.closed and ctx.deleted


def test_warning_hangs_but_cap_still_fires_on_time():
    agent, session, ctx = FakeAgent(), FakeSession("hang"), FakeCtx()
    elapsed = run(agent, session, ctx)
    assert agent.finalized == ["time cap"]
    assert session.closed and ctx.deleted
    # A hanging warning must not push the deadline out — that's the runaway case.
    assert elapsed < TOTAL + WARN


def test_already_ended_skips_the_warning():
    agent, session, ctx = FakeAgent(ended=True), FakeSession(), FakeCtx()
    run(agent, session, ctx)
    assert session.warned == 0  # don't talk over a closed session
    assert session.closed and ctx.deleted


def test_finalize_raises_but_the_meter_still_stops():
    # _finalize publishes to the room and writes the DB. If it blows up, the steps
    # BELOW it are the ones that stop the billing — they must still run.
    agent, session, ctx = FakeAgent(finalize="raise"), FakeSession(), FakeCtx()
    run(agent, session, ctx)
    assert session.closed and ctx.deleted


def test_finalize_hangs_but_the_meter_still_stops():
    agent, session, ctx = FakeAgent(finalize="hang"), FakeSession(), FakeCtx()
    run(agent, session, ctx)
    assert session.closed and ctx.deleted


def test_session_close_hangs_but_the_room_is_still_deleted():
    # aclose() talks to the STT/TTS providers; delete_room stops the SFU meter. A hang
    # in the first must not strand the second.
    agent, session, ctx = FakeAgent(), FakeSession(close="hang"), FakeCtx()
    run(agent, session, ctx)
    assert ctx.deleted


def test_cancel_tears_down_nothing():
    # end_interview cancels the cap when the plan finishes first.
    async def main():
        agent, session, ctx = FakeAgent(), FakeSession(), FakeCtx()
        task = asyncio.create_task(
            enforce_time_cap(
                agent, session, ctx, "iv1", "wrap up", TOTAL, WARN, grace_s=0.0
            )
        )
        await asyncio.sleep(0.01)
        task.cancel()
        await task
        return agent, session, ctx

    agent, session, ctx = asyncio.run(main())
    assert agent.finalized == [] and not session.closed and not ctx.deleted
