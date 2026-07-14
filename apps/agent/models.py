"""Central model config for the voice agent — the Python mirror of
packages/shared/src/models.ts. Env vars are the cross-language source of truth,
so swapping a model is a config change (§2.4), not a code edit: set the env var,
restart the worker. Defaults match what ships today.
"""

import os


def _env(key: str, default: str) -> str:
    """os.getenv's default only fires when the key is ABSENT. A key present but
    empty (`STT_MODEL=` in a copied .env) returned "" and the agent booted with an
    empty model id. Treat blank as unset — same rule as the TS side's env()."""
    return (os.getenv(key) or "").strip() or default


# Interviewer brain (LiveKit google.LLM).
AGENT_LLM_MODEL = _env("AGENT_LLM_MODEL", "gemini-2.5-flash")
# Speech-to-text (Deepgram). See main.py for the en-IN locale rationale.
STT_MODEL = _env("STT_MODEL", "nova-3")
# Text-to-speech voice (Deepgram Aura).
TTS_MODEL = _env("TTS_MODEL", "aura-asteria-en")
