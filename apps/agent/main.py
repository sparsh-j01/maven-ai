"""Maven AI voice agent — milestone 2: text echo (prove transport).

A LiveKit Agents worker that joins each interview room and echoes any
data-channel message back to the sender. This is the transport skeleton the
real turn-based voice loop (VAD -> STT -> LLM -> TTS) builds on in milestone 3.
"""

import asyncio
import logging
from pathlib import Path

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import JobContext, WorkerOptions, cli

# Agent reads LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET from the repo
# root .env (same values the web app uses).
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

logger = logging.getLogger("echo-agent")


async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect()
    logger.info("agent joined room %s", ctx.room.name)

    @ctx.room.on("data_received")
    def on_data(packet: rtc.DataPacket) -> None:
        text = packet.data.decode("utf-8", errors="replace")
        logger.info("echo <- %s", text)
        # The event handler is sync; schedule the async publish.
        asyncio.create_task(
            ctx.room.local_participant.publish_data(f"echo: {text}", reliable=True)
        )


if __name__ == "__main__":
    # ponytail: no agent_name -> automatic dispatch to every new room. Explicit
    # dispatch with interview_id + plan as room metadata (§2.1 step 3) lands in
    # milestone 3 when the agent needs per-interview context.
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
