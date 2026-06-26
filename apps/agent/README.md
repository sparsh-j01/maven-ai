# agent

The interviewer — a long-lived Python [LiveKit Agents](https://docs.livekit.io/agents/)
worker that joins each interview room. Milestone 2 is a **text echo** that proves
transport end to end (browser → SFU → agent → back). The turn-based voice loop
lands in milestone 3.

## Run locally

Needs `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` in the repo-root
`.env` (the worker loads it on start).

```bash
cd apps/agent
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python main.py dev          # hot-reload worker; auto-joins new rooms
```

Then start an interview from the web app — type a message in the room and the
agent echoes it back over the data channel.
