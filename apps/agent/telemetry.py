"""Langfuse LLM tracing for the voice agent (milestone 8, observability).

LiveKit Agents 1.0 already emits OpenTelemetry spans for each session — the LLM,
STT and TTS turns. We just point that tracer at Langfuse's OTLP endpoint, so
every interview turn shows up as a trace with no manual span wiring.

Fail-safe by design: if the Langfuse keys or the OTel deps are missing, tracing
is silently disabled and the interview runs exactly as before. Observability must
never take down the live loop.
"""

import base64
import logging
import os

logger = logging.getLogger("interview-agent")


def setup_langfuse() -> None:
    public = os.environ.get("LANGFUSE_PUBLIC_KEY")
    secret = os.environ.get("LANGFUSE_SECRET_KEY")
    if not (public and secret):
        logger.info("Langfuse keys unset — LLM tracing disabled")
        return

    try:
        from livekit.agents.telemetry import set_tracer_provider
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
            OTLPSpanExporter,
        )
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
    except ImportError:
        logger.warning("OTel/telemetry deps missing — Langfuse tracing disabled")
        return

    host = os.environ.get("LANGFUSE_HOST", "https://cloud.langfuse.com").rstrip("/")
    auth = base64.b64encode(f"{public}:{secret}".encode()).decode()
    # Constructor args, not OTEL_EXPORTER_OTLP_* env vars: the spec wants env
    # header values URL-encoded (the space in "Basic <token>" only passes via a
    # compat shim that warns), and env mutation leaks to any other OTel user.
    exporter = OTLPSpanExporter(
        endpoint=f"{host}/api/public/otel/v1/traces",
        headers={"Authorization": f"Basic {auth}"},
    )

    provider = TracerProvider()
    provider.add_span_processor(BatchSpanProcessor(exporter))
    set_tracer_provider(provider)
    logger.info("Langfuse tracing enabled")
