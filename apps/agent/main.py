"""Maven AI voice agent — milestone 4: the plan-driven interviewer.

A LiveKit Agents worker that joins each interview room and runs the turn-based
voice loop (Silero VAD -> Deepgram STT -> Gemini Flash -> Deepgram Aura TTS, no
barge-in, §2.2). On top of the M3 voice loop it now drives a real interview
STATE MACHINE: it reads the per-interview plan from room metadata (delivered by
the BFF, §2.1 step 3) and walks intro -> warmup -> technical -> behavioral ->
wrap_up by calling tools (next_question / score_answer / end_interview, §2.3).
The cursor (current_phase + plan_cursor) is persisted to the interviews row on
every transition, so a worker restart rehydrates exactly where it left off. Every
spoken turn is written to interview_turns as it lands — the transcript the async
scorer and the report read back (§2.2, §4.3).

Providers sit behind LiveKit plugins, so swapping Deepgram/Gemini is a config
change, not a rewrite (§2.4).
"""

import asyncio
import json
import logging
import os
import time
import uuid
from pathlib import Path
from typing import Literal, Optional

import asyncpg
from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    WorkerOptions,
    cli,
    function_tool,
)
from livekit import rtc
from livekit.plugins import deepgram, google, silero

from coding import LANGUAGE_IDS, TESTS, cases_for, grade, run_on_judge0
from models import AGENT_LLM_MODEL, STT_MODEL, TTS_MODEL
from plan_walker import PlanWalker
from prompt_context import context_block, keyterms
from telemetry import setup_langfuse

# Coding-round guards (F1/F3, §8.1): cap submission size and the number of runs
# per interview so one session can't push huge payloads or hammer the sandbox.
MAX_CODE_BYTES = 20_000
MAX_RUNS = 25

# Hard wall-clock cap on the live voice loop (spend cap, §8.1): a single session
# can't burn STT/LLM/TTS + SFU minutes past this, no matter what. The LiveKit
# token TTL only governs JOIN; this bounds how long the candidate can stay once
# in. The interview also ends naturally when the plan completes — this is the
# ceiling, not the norm.
MAX_SESSION_MIN = 10
MAX_SESSION_SECONDS = MAX_SESSION_MIN * 60

# How long before the cap the interviewer is told to start wrapping up. Without this
# the cap fires mid-sentence: a candidate in the coding round gets guillotined
# mid-problem, with no warning, and is then graded on the half-answer they were cut
# off in. Two minutes is enough for the agent to land the current question and close.
WARN_BEFORE_SECONDS = 120

# Env: apps/agent/.env if it exists, else the repo-root .env (the same values the web
# app uses — the normal local-dev case, nothing to set up).
#
# Why the override exists: `pnpm bootstrap` symlinks the root .env into packages/db,
# so drizzle-kit reads it. The agent dials OUT to LiveKit and needs no inbound port,
# which means it can run against PRODUCTION from a laptop (the free hosting path) —
# but that requires the prod DATABASE_URL in its env. Put that in the root .env and a
# casual `pnpm db:push` from any dev shell rewrites the production schema.
#
# So: prod credentials go in apps/agent/.env, which drizzle-kit never reads.
_AGENT_ENV = Path(__file__).resolve().parent / ".env"
_ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(_AGENT_ENV if _AGENT_ENV.exists() else _ROOT_ENV)

logger = logging.getLogger("interview-agent")

# Fallback persona for local runs with no plan in room metadata (e.g. `python
# main.py dev` without going through the web app). The real interview uses the
# plan-driven instructions built per session below.
GENERIC_INSTRUCTIONS = """\
You are a professional technical interviewer running a live mock interview for a \
software engineering role. This is a spoken conversation, so keep every turn \
short and natural — no markdown, no lists, no code blocks, no emoji.

Open with a one-line greeting and a single warm-up question, then ask ONE \
question at a time and wait for the candidate's full answer. Cover a warm-up, a \
couple of technical questions, then thank them and wrap up. Judge every answer \
honestly: if it is wrong or vague, ask one pointed follow-up rather than \
accepting it; never read scores out loud and never give away the answer."""


def _make_session(keyterms: Optional[list[str]] = None) -> AgentSession:
    # allow_interruptions=False = no barge-in (§2.2): the candidate cannot cut off
    # the interviewer mid-question. turn_detection="manual" hands turn-taking to
    # the push-to-talk button: the candidate's turn ends only when they RELEASE
    # (the browser mutes the mic and we commit_user_turn), never on a VAD silence
    # timer — so pausing mid-answer to think no longer skips to the next question.
    stt_kwargs = {
        # en-IN, not the plugin's en-US default: nova-3's accent-tuned Indian
        # English locale. India-first product (§billing), and en-US mangles
        # Indian-accented names and technical terms. Swap to "multi" if you need
        # US/UK accents equally well, or make it per-interview.
        "model": STT_MODEL,
        "language": "en-IN",
    }
    # Keyterm prompting: boost the candidate's name + the tools on their resume so
    # the STT stops mangling them (prompt_context.keyterms). Only when we have a
    # resume/JD to mine — an empty list is a no-op we skip.
    if keyterms:
        stt_kwargs["keyterms"] = keyterms
    return AgentSession(
        # No VAD: turn-taking is 100% push-to-talk (turn_detection="manual" +
        # commit_user_turn on mic release). A VAD here re-introduces silence-based
        # endpointing that ends the turn ~2s into a thinking pause — the bug.
        stt=deepgram.STT(**stt_kwargs),
        llm=google.LLM(model=AGENT_LLM_MODEL),
        tts=deepgram.TTS(model=TTS_MODEL),
        allow_interruptions=False,
        turn_detection="manual",
    )


def _parse_metadata(raw: Optional[str]) -> Optional[dict]:
    if not raw:
        return None
    try:
        return json.loads(raw)
    except (ValueError, TypeError):
        logger.warning("room metadata is not valid JSON; ignoring")
        return None


def _role_line(meta: dict) -> str:
    role = meta.get("role") or "software engineering"
    seniority = meta.get("seniority") or ""
    company = meta.get("company")
    suffix = f" at {company}" if company else ""
    return f"{seniority} {role}{suffix}".strip()


# The target-company flavour colours the interviewer's tone (the difficulty itself
# is already baked into the plan). Empty for an unset/unknown type.
_COMPANY_TONE = {
    "product": (
        " This is a product-based-company interview: hold a high technical bar, "
        "probe depth and trade-offs, and expect crisp, rigorous answers."
    ),
    "service": (
        " This is a service-based-company interview: focus on fundamentals, "
        "breadth, and clear communication; keep a supportive, encouraging bar."
    ),
    "startup": (
        " This is a startup interview: be pragmatic and fast-paced, favouring "
        "practical problem-solving and scrappy, get-it-done thinking over theory."
    ),
}


def _company_tone(meta: dict) -> str:
    return _COMPANY_TONE.get(meta.get("companyType") or "", "")


def _instructions(meta: dict) -> str:
    return f"""\
You are a professional, warm but rigorous interviewer conducting a live, spoken \
mock interview for a {_role_line(meta)} position. This is a voice conversation: \
keep every turn short and natural — no markdown, no lists, no code blocks, no \
emoji — and never read scores or labels out loud.

You run a STRUCTURED interview using tools. Follow this protocol exactly:
- Ask exactly ONE question at a time, then stop and wait for the candidate's \
full answer.
- Call next_question to get each question. It returns the phase and the topic to \
ask; ask it naturally in your own words, faithful to what it asks.
- After the candidate answers, silently call score_answer with your honest \
assessment (competency, a rating of weak/ok/strong, a one-line private note). \
Never tell the candidate their rating or that you are scoring.
- Judge each answer yourself. If it is wrong, vague, or incomplete, do NOT \
accept it — ask ONE pointed follow-up at the specific gap before moving on; you \
may press once or twice. If it is solid, acknowledge briefly and continue. Never \
affirm an incorrect claim and never give away the answer.
- When you are ready for the next topic, call next_question again. When it says \
the plan is complete, thank the candidate, give a brief encouraging close, then \
call end_interview.""" + _company_tone(meta) + context_block(meta)


def _time_warning() -> str:
    return (
        "You have about two minutes of interview time left — a hard limit, not a "
        "suggestion. Tell the candidate plainly that time is nearly up. If they are "
        "mid-answer or mid-problem, let them finish the thought, then move to your "
        "closing remarks and call end_interview. Do not start a new question, and do "
        "not set a new coding problem."
    )


def _opening(resuming: bool) -> str:
    if resuming:
        return (
            "This interview is resuming after a brief interruption. In one "
            "sentence, welcome the candidate back, then call next_question to "
            "continue where you left off."
        )
    return (
        "Greet the candidate warmly in one sentence, then call next_question to "
        "get the first question and ask it."
    )


class InterviewAgent(Agent):
    """The interviewer: an LLM driven by the plan via tools (§2.3)."""

    def __init__(
        self,
        *,
        instructions: str,
        walker: PlanWalker,
        db: Optional[asyncpg.Connection],
        interview_id: uuid.UUID,
        room: rtc.Room,
    ) -> None:
        super().__init__(instructions=instructions)
        self._walker = walker
        self._db = db
        self._interview_id = interview_id
        self._room = room
        self._signals = []
        # Coding round (§4.2): the active problem id (set when next_question serves
        # the coding phase), the latest editor buffer the browser broadcasts over
        # the data channel, the last run's outcome, and a per-interview run counter.
        self._coding_id: Optional[str] = None
        self._buffer = {"language": "python", "code": ""}
        self._last_run: Optional[dict] = None
        self._runs = 0
        # One asyncpg connection, several writers (cursor persist + turn inserts
        # fired from the session event handler can overlap). asyncpg can't run
        # concurrent queries on a connection, so serialize every DB write.
        self._db_lock = asyncio.Lock()
        # Transcript offsets are measured from here; turns tile end-to-end so the
        # report can order and (later) seek them. §2.2.
        self._start_ms = time.monotonic() * 1000
        self._last_offset = 0
        # End-of-interview is idempotent: the LLM's end_interview tool and the
        # hard time cap can race. _ended makes the second one a no-op; _cap_task
        # is the timer, cancelled if the plan finishes first.
        self._ended = False
        self._cap_task: Optional[asyncio.Task] = None

    async def _publish(self, obj: dict) -> None:
        """Send a JSON control message to the room on the `maven` topic. Best-effort
        — the UI updating must never block or break the interview."""
        try:
            await self._room.local_participant.publish_data(
                json.dumps(obj), reliable=True, topic="maven"
            )
        except Exception:
            logger.exception("data publish failed: %s", obj.get("type"))

    async def _persist_cursor(self) -> None:
        # Tell the UI which phase we're in so it can show the code editor for the
        # coding round (and which problem is active, so it switches between the two)
        # and hide it otherwise (§7.4). Best-effort.
        msg = {"type": "phase", "phase": self._walker.current_phase}
        if self._walker.current_phase == "coding" and self._coding_id:
            msg["problemId"] = self._coding_id
        await self._publish(msg)
        if not self._db:
            return
        try:
            async with self._db_lock:
                await self._db.execute(
                    "UPDATE interviews SET current_phase = $1, plan_cursor = $2 WHERE id = $3",
                    self._walker.current_phase,
                    self._walker.cursor,
                    self._interview_id,
                )
        except Exception:  # best-effort — a DB blip must not kill the interview
            logger.exception("cursor persist failed")

    async def record_turn(self, speaker: str, text: str) -> None:
        """Persist one spoken turn to interview_turns (§2.2) — both speakers, in
        order. The async scorer (§4.3) and the report transcript read from here.
        Best-effort: a DB blip must never interrupt the live interview."""
        if not self._db:
            return
        try:
            async with self._db_lock:
                # Under the lock: start/end are derived from _last_offset, so two
                # turns racing here would otherwise read the same value and write
                # overlapping, mis-ordered ts_start_ms/ts_end_ms.
                now = int(time.monotonic() * 1000 - self._start_ms)
                start = self._last_offset
                end = now if now > start else start
                self._last_offset = end
                await self._db.execute(
                    "INSERT INTO interview_turns "
                    "(interview_id, speaker, text, ts_start_ms, ts_end_ms, phase) "
                    "VALUES ($1, $2, $3, $4, $5, $6)",
                    self._interview_id,
                    speaker,
                    text,
                    start,
                    end,
                    self._walker.current_phase,
                )
        except Exception:
            logger.exception("turn persist failed")

    @function_tool()
    async def next_question(self) -> str:
        """Advance to the next planned question. Returns the phase and the topic
        to ask next, or a wrap-up signal when the plan is complete. Call this when
        you are ready to move on from the current topic."""
        item = self._walker.next()
        # Track the active coding problem (cleared when we leave the coding phase)
        # BEFORE persisting, so the phase signal carries the right problem id.
        self._coding_id = item[1]["id"] if (item and item[0] == "coding") else None
        await self._persist_cursor()
        if item is None:
            return (
                "The planned questions are complete. Thank the candidate, give a "
                "brief encouraging close, then call end_interview."
            )
        phase, q = item
        if phase == "coding":
            # The candidate solves this in the on-screen editor, not out loud.
            return (
                "Coding round. Present this problem to the candidate and tell them "
                "to write their solution in the code editor on their screen and "
                "click Run when they're ready: "
                f"{q['prompt']} "
                "Do not dictate the code or give the algorithm away. When they say "
                "they're ready (or after they run it), call run_code to execute "
                "their solution, then discuss the result, their approach, and the "
                "time and space complexity. Call next_question when you're done."
            )
        hint = q.get("rubricHint")
        guidance = f" Privately assess for: {hint}" if hint else ""
        return (
            f"Phase: {phase}. Difficulty: {q.get('difficulty', 'n/a')}. "
            f"Ask this next, in your own words: {q['prompt']}.{guidance}"
        )

    @function_tool()
    async def score_answer(
        self,
        competency: str,
        rating: Literal["weak", "ok", "strong"],
        note: str = "",
    ) -> str:
        """Privately log your assessment of the candidate's most recent answer.
        For the feedback report only — never shown or spoken to the candidate, and
        it does not change the conversation."""
        # F2 (scoring injection, §8.1): this only LOGS a signal — it cannot set
        # final scores, and the candidate's words never reach an instruction
        # position. The async scorer (M5) re-derives the real rubric from the
        # transcript delimited as data.
        self._signals.append(
            {
                "phase": self._walker.current_phase,
                "competency": competency,
                "rating": rating,
                "note": note,
            }
        )
        logger.info(
            "signal phase=%s competency=%s rating=%s",
            self._walker.current_phase,
            competency,
            rating,
        )
        return "Noted."

    async def _persist_submission(
        self, language: str, code: str, stdout: str, passed: bool
    ) -> None:
        if not self._db:
            return
        try:
            async with self._db_lock:
                await self._db.execute(
                    "INSERT INTO code_submissions "
                    "(interview_id, language, code, exec_stdout, exec_passed) "
                    "VALUES ($1, $2, $3, $4, $5)",
                    self._interview_id,
                    language,
                    code,
                    stdout,
                    passed,
                )
        except Exception:
            logger.exception("code submission persist failed")

    async def _run_code(self, language: str, code: str) -> dict:
        """Execute the candidate's code in the Judge0 sandbox and grade it against
        the active problem's hidden test (§4.2). Validates server-side (F1) and
        caps runs per interview (F3). Persists the submission for the scorer.
        Returns a result dict the caller publishes/returns; never raises."""
        if not self._coding_id or self._coding_id not in TESTS:
            return {"ok": False, "error": "no active coding problem"}
        if language not in LANGUAGE_IDS:
            return {"ok": False, "error": f"unsupported language: {language}"}
        if not code.strip():
            return {"ok": False, "error": "no code to run"}
        if len(code.encode("utf-8")) > MAX_CODE_BYTES:
            return {"ok": False, "error": "code too large"}
        if self._runs >= MAX_RUNS:
            return {"ok": False, "error": "run limit reached for this interview"}
        self._runs += 1

        # Run every hidden case; the candidate passes only if ALL do. Short-circuit
        # on the first failure so an iterating (still-wrong) solution stays a single
        # Judge0 round trip — only a correct solution pays for the whole battery.
        # ponytail: sequential wait=true submissions. Switch to Judge0 batch if the
        # all-pass latency (one round trip per case) starts to bite.
        stdout = stderr = status = ""
        passed = True
        for stdin, expected in cases_for(self._coding_id):
            try:
                result = await run_on_judge0(language, code, stdin)
            except Exception:
                logger.exception("judge0 run failed")
                return {"ok": False, "error": "sandbox unavailable"}
            stdout = result.get("stdout") or ""
            stderr = (result.get("stderr") or "") + (result.get("compile_output") or "")
            status = (result.get("status") or {}).get("description", "")
            # Grade from the captured stdout ourselves so the verdict is independent
            # of Judge0's comparison mode; status is for the human-readable summary.
            if not grade(expected, stdout):
                passed = False
                break
        await self._persist_submission(language, code, stdout, passed)
        self._last_run = {"passed": passed, "status": status}
        logger.info("run_code passed=%s status=%s", passed, status)
        return {
            "ok": True,
            "passed": passed,
            "stdout": stdout,
            "stderr": stderr.strip(),
            "status": status,
        }

    async def handle_run(self) -> None:
        """Run the latest editor buffer because the candidate hit Run in the UI,
        and publish the result strip back to them (§7.4)."""
        res = await self._run_code(self._buffer["language"], self._buffer["code"])
        await self._publish({"type": "run_result", **res})

    @function_tool()
    async def run_code(self) -> str:
        """Run the candidate's current code from the on-screen editor in the secure
        sandbox during the coding round, and return the pass/fail result so you can
        react. Call this when the candidate says they're ready or asks you to run
        it. Never invent a result — only report what this returns."""
        res = await self._run_code(self._buffer["language"], self._buffer["code"])
        await self._publish({"type": "run_result", **res})
        if not res.get("ok"):
            return f"Could not run the code ({res.get('error')}). Ask them to try again."
        if res["passed"]:
            return (
                "The code ran and passed the test cases. Acknowledge briefly, then "
                "ask about the time and space complexity or an edge case."
            )
        return (
            f"The code ran but did not pass (status: {res['status'] or 'failed'}). "
            "Nudge the candidate to find the bug themselves — do not give the fix."
        )

    async def _finalize(self, reason: str) -> None:
        """Idempotent end-of-interview: mark the row `processing` (the async
        scorer's trigger, §4.3) and tell the room so the UI flips to the report
        (§7.4). Shared by the end_interview tool and the hard time cap; _ended
        makes a race between the two a no-op the second time."""
        if self._ended:
            return
        self._ended = True
        if self._db:
            try:
                async with self._db_lock:
                    await self._db.execute(
                        "UPDATE interviews SET status = 'processing', ended_at = now(), "
                        "current_phase = 'wrap_up', plan_cursor = $1 WHERE id = $2",
                        self._walker.cursor,
                        self._interview_id,
                    )
            except Exception:
                logger.exception("end_interview persist failed")
        # Tell the room the interview is over so the UI can flip to the "ended"
        # state and surface the report link (§7.4). Best-effort.
        await self._publish({"type": "ended"})
        logger.info(
            "interview %s ended (%s, %d signals logged)",
            self._interview_id,
            reason,
            len(self._signals),
        )

    @function_tool()
    async def end_interview(self) -> str:
        """End the interview. Call this only after you have delivered the closing
        remarks and the plan is complete."""
        # _cap_task is deliberately left running. _finalize() marks the row and tells
        # the room, but only _enforce_time_cap closes the session and deletes the
        # room — so if we cancelled the cap here and the client never disconnected
        # (crash, dropped connection), nothing would ever force closure and the
        # documented "no matter what" ceiling would be a lie. _finalize is idempotent,
        # so leaving the cap armed costs nothing on the happy path.
        await self._finalize("plan complete")
        # The report is generated asynchronously: status='processing' is the
        # trigger the scorer watches for, kicked when the report page opens (§4.3).
        return "Interview recorded. You can stop now."


async def _connect_db() -> Optional[asyncpg.Connection]:
    url = os.environ.get("DATABASE_URL")
    if not url:
        logger.warning("DATABASE_URL unset — cursor will not persist (resume disabled)")
        return None
    try:
        return await asyncpg.connect(url)
    except Exception:
        logger.exception("DB connect failed — continuing without persistence")
        return None


async def _read_cursor(db: Optional[asyncpg.Connection], interview_id: uuid.UUID) -> int:
    if not db:
        return 0
    try:
        row = await db.fetchrow(
            "SELECT plan_cursor FROM interviews WHERE id = $1", interview_id
        )
    except Exception:
        logger.exception("cursor read failed — starting from the top")
        return 0
    if not row or row["plan_cursor"] is None:
        return 0
    return int(row["plan_cursor"])


async def entrypoint(ctx: JobContext) -> None:
    setup_langfuse()  # export session traces to Langfuse (no-op if unconfigured)
    await ctx.connect()
    logger.info("interviewer joined room %s", ctx.room.name)

    meta = _parse_metadata(ctx.room.metadata)
    if not meta or not meta.get("plan"):
        # No per-interview plan (e.g. a bare local run): fall back to the M3
        # generic interviewer so the voice loop is still exercisable.
        logger.warning("no plan in room metadata — running the generic interviewer")
        session = _make_session()
        await session.start(agent=Agent(instructions=GENERIC_INSTRUCTIONS), room=ctx.room)
        await ctx.wait_for_participant()
        await session.generate_reply(
            instructions="Greet the candidate in one sentence and ask your first warm-up question.",
        )
        return

    interview_id = uuid.UUID(str(meta["interviewId"]))
    db = await _connect_db()
    if db:
        ctx.add_shutdown_callback(db.close)

    cursor = await _read_cursor(db, interview_id)
    walker = PlanWalker(meta["plan"], cursor)
    resuming = cursor > 0
    logger.info(
        "interview %s: %s at cursor %d",
        interview_id,
        "resuming" if resuming else "starting",
        cursor,
    )

    agent = InterviewAgent(
        instructions=_instructions(meta),
        walker=walker,
        db=db,
        interview_id=interview_id,
        room=ctx.room,
    )
    session = _make_session(keyterms=keyterms(meta))

    # asyncio only holds weak references to tasks, so a bare create_task() can be
    # garbage-collected mid-flight — silently dropping a persisted turn or a code Run.
    # Hold a strong ref until the task finishes.
    _bg_tasks: set[asyncio.Task] = set()

    def _spawn(coro) -> None:
        task = asyncio.create_task(coro)
        _bg_tasks.add(task)
        task.add_done_callback(_bg_tasks.discard)

    # Coding round: the browser broadcasts the editor buffer and Run requests over
    # the data channel (§4.2). The buffer is display/control data, never trusted as
    # a control signal beyond what run_code re-validates server-side (F1, §8.1).
    @ctx.room.on("data_received")
    def _on_data(packet: rtc.DataPacket) -> None:
        if packet.topic != "maven":
            return
        try:
            msg = json.loads(packet.data.decode())
        except (ValueError, UnicodeDecodeError):
            return
        if msg.get("type") == "code":
            agent._buffer = {
                "language": msg.get("language", "python"),
                "code": msg.get("code", ""),
            }
        elif msg.get("type") == "run":
            _spawn(agent.handle_run())

    # Push-to-talk turn control (§2.2): with turn_detection="manual" the session
    # waits for us to commit — so we drive it off the mic mute state the browser
    # already broadcasts. The candidate holds the talk button (mic unmuted) for
    # their whole answer, pauses included, and releases to send (mic muted). Mute
    # = end of turn; the dedupe flag stops a stray double-mute committing twice,
    # and starts False so the very first release (a fresh publish never fires
    # "unmuted") still commits.
    committed = {"v": False}

    @ctx.room.on("track_unmuted")
    def _on_unmuted(_p: rtc.RemoteParticipant, pub: rtc.RemoteTrackPublication) -> None:
        if pub.source != rtc.TrackSource.SOURCE_MICROPHONE:
            return
        logger.info(">>> UNMUTE fired — mic on, clearing turn buffer")
        committed["v"] = False
        try:
            session.clear_user_turn()  # begin this turn from a clean buffer
        except Exception:
            logger.exception("clear_user_turn failed")

    @ctx.room.on("track_muted")
    def _on_muted(_p: rtc.RemoteParticipant, pub: rtc.RemoteTrackPublication) -> None:
        if pub.source != rtc.TrackSource.SOURCE_MICROPHONE or committed["v"]:
            return
        logger.info(">>> MUTE fired — mic off, committing turn")
        committed["v"] = True
        try:
            session.commit_user_turn()  # button released -> end the turn now
        except Exception:
            logger.exception("commit_user_turn failed")
        # ponytail: an accidental tap with no speech commits an empty turn; the
        # LLM just re-prompts. Add a "had speech this turn" gate if it annoys.

    # Persist every completed turn (both speakers) as it lands (§2.2). The handler
    # is sync; hand the DB write to the loop so it never blocks the voice pipeline.
    @session.on("conversation_item_added")
    def _on_item(ev: object) -> None:
        item = getattr(ev, "item", None)
        role = getattr(item, "role", None)
        text = (getattr(item, "text_content", None) or "").strip()
        speaker = {"user": "candidate", "assistant": "interviewer"}.get(role)
        if speaker and text:
            _spawn(agent.record_turn(speaker, text))

    await session.start(agent=agent, room=ctx.room)
    # Don't greet an empty room: the BFF pre-creates the room (with metadata), so
    # the agent can be dispatched before the candidate has joined.
    await ctx.wait_for_participant()

    # Hard spend cap (§8.1): MAX_SESSION_MIN after the candidate joins, end the
    # session no matter what so the voice loop can't burn provider minutes
    # indefinitely. Cancelled in end_interview when the plan finishes first.
    async def _enforce_time_cap() -> None:
        try:
            # Warn first, then run out the rest of the clock. The cap used to fire cold:
            # a candidate mid-DSA-problem was cut off with no warning and graded on the
            # fragment. Now the interviewer gets two minutes to land the question and
            # close properly.
            await asyncio.sleep(MAX_SESSION_SECONDS - WARN_BEFORE_SECONDS)
            # The plan may already have finished — end_interview leaves this task armed
            # on purpose (see its comment), so _ended is the guard. Telling a finished
            # interview to "wrap up" would talk over a closed session.
            if not agent._ended:
                logger.info(
                    "interview %s — %ds left, telling the interviewer to wrap up",
                    interview_id,
                    WARN_BEFORE_SECONDS,
                )
                await session.generate_reply(instructions=_time_warning())
            await asyncio.sleep(WARN_BEFORE_SECONDS)
        except asyncio.CancelledError:
            return
        logger.info("interview %s hit the %d-min cap — ending", interview_id, MAX_SESSION_MIN)
        await agent._finalize("time cap")
        await asyncio.sleep(0.5)  # let the reliable "ended" frame reach the browser
        try:
            await session.aclose()  # stop STT/LLM/TTS billing
        except Exception:
            logger.exception("session close on cap failed")
        try:
            await ctx.delete_room()  # disconnect + close the room (stops SFU minutes)
        except Exception:
            logger.exception("room delete on cap failed")

    agent._cap_task = asyncio.create_task(_enforce_time_cap())

    await session.generate_reply(instructions=_opening(resuming))


if __name__ == "__main__":
    # ponytail: no agent_name -> automatic dispatch to every new interview room.
    # The BFF pre-creates the room with the plan as metadata, so explicit dispatch
    # isn't needed; the agent reads its context from ctx.room.metadata.
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
