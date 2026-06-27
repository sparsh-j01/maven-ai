"""Maven AI voice agent — milestone 3: the turn-based voice loop.

A LiveKit Agents worker that joins each interview room and runs the real
VAD -> STT -> LLM -> TTS pipeline as a mock interviewer (Silero VAD, Deepgram
STT, Gemini Flash, Deepgram Aura TTS). It is turn-based with **no barge-in**
(`allow_interruptions=False`): the interviewer asks its question fully, then it
is clearly the candidate's turn. Providers sit behind LiveKit plugins, so
swapping Deepgram/Gemini is a config change, not a rewrite (architecture §2.4).
"""

import logging
from pathlib import Path

from dotenv import load_dotenv
from livekit.agents import Agent, AgentSession, JobContext, WorkerOptions, cli
from livekit.plugins import deepgram, google, silero

# Agent reads provider keys + LIVEKIT_* from the repo-root .env (the same values
# the web app uses): LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET, plus
# DEEPGRAM_API_KEY and GOOGLE_API_KEY for the pipeline.
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

logger = logging.getLogger("interview-agent")

# ponytail: one generic interviewer prompt. The per-interview plan + phase state
# machine (role/seniority/company pulled from room metadata) lands in milestone
# 4; milestone 3 just proves the voice loop end to end.
INTERVIEWER_INSTRUCTIONS = """\
You are a professional technical interviewer running a live mock interview for a \
software engineering role. This is a spoken conversation, so keep every turn \
short and natural — no markdown, no bullet lists, no code blocks, no emoji.

Run it like a real interview: open with a one-line greeting and a single warm-up \
question, then ask ONE question at a time and wait for the candidate's full \
answer before responding. Cover a warm-up, then a couple of technical questions, \
then thank them and wrap up.

Judge every answer for yourself before you reply, but never say outright whether \
it was right or wrong and never read scores out loud. If an answer is correct and \
complete, acknowledge it briefly and move on. If it is wrong, vague, or \
incomplete, do NOT accept it or call it good — ask one pointed follow-up that \
targets the specific gap or mistake (an edge case it misses, a wrong claim worth \
re-examining, or "what's the time complexity and why"), giving the candidate a \
chance to correct it. Press once or twice on a weak answer before moving on. Stay \
warm and professional, but stay honest: never affirm a claim that is incorrect, \
and do not give away the answer."""


async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect()
    logger.info("interviewer joined room %s", ctx.room.name)

    # allow_interruptions=False = no barge-in: the candidate cannot cut off the
    # interviewer mid-question (§2.2). End of the candidate's turn is detected by
    # Silero VAD endpointing (and client-side push-to-talk releasing the mic).
    session = AgentSession(
        vad=silero.VAD.load(),
        stt=deepgram.STT(model="nova-3"),
        llm=google.LLM(model="gemini-2.5-flash"),
        tts=deepgram.TTS(model="aura-asteria-en"),
        allow_interruptions=False,
    )

    await session.start(agent=Agent(instructions=INTERVIEWER_INSTRUCTIONS), room=ctx.room)

    # The interviewer speaks first.
    await session.generate_reply(
        instructions="Greet the candidate in one sentence and ask your first warm-up question.",
    )


if __name__ == "__main__":
    # ponytail: no agent_name -> automatic dispatch to every new interview room.
    # Explicit dispatch with interview_id + plan as room metadata (§2.1 step 3)
    # lands in milestone 4 when the agent needs per-interview context.
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
