# Maven voice agent — a long-lived LiveKit Agents worker (architecture §10).
# Pinned to 3.12: the Google client libs now warn that 3.9 is unsupported.
FROM python:3.12-slim

# ca-certificates for outbound TLS to LiveKit/Deepgram/Google/Judge0.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first so this layer caches across source-only changes.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# App source (see .dockerignore — the local .venv and caches are excluded).
COPY . .

# Long-lived worker: it dials out to LiveKit and picks up each interview room.
# (Turn-taking is push-to-talk, so no Silero VAD weights to pre-download.)
CMD ["python", "main.py", "start"]
