# agent

The interviewer — a long-lived Python [LiveKit Agents](https://docs.livekit.io/agents/)
worker that joins each interview room and runs the **turn-based voice loop**:
Silero VAD → Deepgram STT → Gemini Flash → Deepgram Aura TTS. It is **no
barge-in** (`allow_interruptions=False`): the interviewer asks a question fully,
then it's clearly the candidate's turn (architecture §2.2). Each provider sits
behind a LiveKit plugin, so swapping Deepgram/Gemini is a config change (§2.4).

## Run locally

Needs these in the repo-root `.env` (the worker loads it on start):
`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `DEEPGRAM_API_KEY`,
`GOOGLE_API_KEY`.

```bash
cd apps/agent
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python main.py dev          # hot-reload worker; auto-joins new interview rooms
```

Then start an interview from the web app, hold the push-to-talk button (or
`Space`) and talk — the interviewer listens, then answers in voice.
