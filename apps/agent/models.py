"""Central model config for the voice agent — the Python mirror of
packages/shared/src/models.ts. Env vars are the cross-language source of truth,
so swapping a model is a config change (§2.4), not a code edit: set the env var,
restart the worker. Defaults match what ships today.
"""

import os

# Interviewer brain (LiveKit google.LLM).
AGENT_LLM_MODEL = os.getenv("AGENT_LLM_MODEL", "gemini-2.5-flash").strip()
# Speech-to-text (Deepgram). See main.py for the en-IN locale rationale.
STT_MODEL = os.getenv("STT_MODEL", "nova-3").strip()
# Text-to-speech voice (Deepgram Aura).
TTS_MODEL = os.getenv("TTS_MODEL", "aura-asteria-en").strip()
