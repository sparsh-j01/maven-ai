"use client";

import {
  RoomAudioRenderer,
  RoomContext,
  useLocalParticipant,
  useTrackVolume,
  useTranscriptions,
  useVoiceAssistant,
} from "@livekit/components-react";
import { getCodingProblem } from "@maven-ai/shared";
import { Room, RoomEvent } from "livekit-client";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CodePanel } from "@/components/code-panel";
import { Button } from "@/components/ui/button";
import { VoiceOrb } from "@/components/voice-orb";
import { errorMessage } from "@/lib/http";

type ConnState =
  | "checking-mic"
  | "mic-denied"
  | "connecting"
  | "live"
  | "reconnecting"
  | "disconnected"
  | "ended"
  | "error";

// How long to wait for the interviewer to join before calling it a failure.
// "live" only means the CANDIDATE reached the room — LiveKit is happy to hold a room
// with nobody in it. If no agent worker is running (crashed, not deployed, laptop
// asleep), nobody ever joins, nothing errors, and the candidate sits watching a silent
// orb until they give up. In practice the agent is dispatched within a second or two.
const AGENT_JOIN_TIMEOUT_MS = 15_000;

const STATE_LABEL: Record<ConnState, string> = {
  "checking-mic": "Checking mic…",
  "mic-denied": "Mic blocked",
  connecting: "Connecting…",
  live: "Live",
  reconnecting: "Reconnecting…",
  disconnected: "Disconnected",
  ended: "Ended",
  error: "Connection failed",
};

const fmtElapsed = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// True while focus is in a text field or the Monaco editor — Space must type
// a space there, not trigger push-to-talk.
const inEditable = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  !!t.closest("input, textarea, [contenteditable]");

export default function InterviewRoomPage() {
  const { id } = useParams<{ id: string }>();
  const room = useMemo(() => new Room(), []);
  const [state, setState] = useState<ConnState>("checking-mic");
  const [detail, setDetail] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<string | null>(null);
  // Look the coding problem up in the shared bank — public half only, no hidden tests reach the client.
  const [codingProblemId, setCodingProblemId] = useState<string | null>(null);
  const codingProblem = codingProblemId
    ? (getCodingProblem(codingProblemId) ?? null)
    : null;
  const [seconds, setSeconds] = useState(0);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // Browsers block autoplay of the interviewer's voice until the user gestures.
  const [audioBlocked, setAudioBlocked] = useState(false);

  const started = state === "live" || state === "reconnecting";
  useEffect(() => {
    if (!started) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [started]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !inEditable(e.target)) setConfirmLeave(true);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Armed once the candidate is in; disarmed the moment the agent shows up.
    let agentWatchdog: ReturnType<typeof setTimeout> | null = null;
    // The watchdog leaves the room on purpose, so its own disconnect must not be
    // mistaken for the candidate dropping out — it owns the terminal state.
    let watchdogFired = false;
    const disarmWatchdog = () => {
      if (agentWatchdog) clearTimeout(agentWatchdog);
      agentWatchdog = null;
    };
    const onParticipantConnected = () => disarmWatchdog();
    const onReconnecting = () => setState("reconnecting");
    const onReconnected = () => setState("live");
    // A normal end tears the room down ~0.5s after the "ended" frame arrives;
    // that teardown must not clobber the "ended" screen (and its report link).
    const onDisconnected = () =>
      setState((s) => (s === "ended" || watchdogFired ? s : "disconnected"));
    // Autoplay gate: keep the "enable sound" button in sync with playback state.
    const onAudioStatus = () => setAudioBlocked(!room.canPlaybackAudio);
    // The agent signals over the data channel: {type:"ended"} when it ends the
    // interview, {type:"phase"} to announce the phase and active coding problem.
    const onData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg?.type === "ended") setState("ended");
        else if (msg?.type === "phase") {
          setPhase(msg.phase ?? null);
          if (msg.phase === "coding" && msg.problemId)
            setCodingProblemId(msg.problemId);
        }
      } catch {
        // not our message
      }
    };
    room
      .on(RoomEvent.ParticipantConnected, onParticipantConnected)
      .on(RoomEvent.Reconnecting, onReconnecting)
      .on(RoomEvent.Reconnected, onReconnected)
      .on(RoomEvent.Disconnected, onDisconnected)
      .on(RoomEvent.DataReceived, onData)
      .on(RoomEvent.AudioPlaybackStatusChanged, onAudioStatus);

    (async () => {
      // Confirm mic permission before joining so the candidate never lands in a
      // room with an agent that can't hear them.
      setState("checking-mic");
      try {
        const probe = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        probe.getTracks().forEach((t) => t.stop());
      } catch {
        if (!cancelled) setState("mic-denied");
        return;
      }
      if (cancelled) return;

      try {
        setState("connecting");
        const res = await fetch(`/api/interviews/${id}/token`, {
          method: "POST",
        });
        if (!res.ok)
          throw new Error(
            await errorMessage(res, "Couldn't join the interview."),
          );
        const { token, serverUrl } = (await res.json()) as {
          token: string;
          serverUrl: string;
        };
        await room.connect(serverUrl, token);
        if (cancelled) return;
        await room.localParticipant.setMicrophoneEnabled(false);
        setState("live");
        // The agent may already be in the room (it's dispatched when the room is
        // created, so it often beats the candidate). Only wait if it isn't.
        if (room.remoteParticipants.size === 0) {
          agentWatchdog = setTimeout(() => {
            if (cancelled || room.remoteParticipants.size > 0) return;
            watchdogFired = true;
            void (async () => {
              // Leave before showing the failure. An agent that turns up late would
              // otherwise start talking over the error screen, and a room nobody is
              // in still burns LiveKit minutes.
              await room.disconnect().catch(() => {});
              // Hand the interview back: nobody spoke, so /end resets it to
              // `approved`, which is unbilled and re-joinable. Without this the row
              // sits `live` forever and the candidate is charged for silence.
              let released = false;
              try {
                const res = await fetch(`/api/interviews/${id}/end`, {
                  method: "POST",
                });
                released = res.ok;
              } catch {
                /* released stays false */
              }
              if (cancelled) return;
              // Only promise "unbilled" when /end confirmed it. Billing charges at
              // interview START, so saying this on a failed request tells the
              // candidate they weren't charged when in fact they were.
              setDetail(
                released
                  ? "your interviewer didn't join, so the interview service looks down. Nothing was recorded and this doesn't count against your monthly interviews — retry in a moment."
                  : "your interviewer didn't join, so the interview service looks down. Nothing was recorded, but we couldn't confirm this interview was released — if it still shows as used, retry in a moment.",
              );
              // Don't stomp a room that already finished on its own.
              setState((s) => (s === "ended" ? s : "error"));
            })();
          }, AGENT_JOIN_TIMEOUT_MS);
        }
        // Try to unblock the interviewer's voice now; if the browser refuses
        // (no fresh user gesture survived the navigation), the enable-sound
        // button surfaces so the candidate can start it with a tap.
        try {
          await room.startAudio();
        } catch {
          /* blocked — button will prompt */
        }
        setAudioBlocked(!room.canPlaybackAudio);
      } catch (e) {
        if (cancelled) return;
        setDetail(e instanceof Error ? e.message : "connection failed");
        setState("error");
      }
    })();

    return () => {
      cancelled = true;
      disarmWatchdog();
      room
        .off(RoomEvent.ParticipantConnected, onParticipantConnected)
        .off(RoomEvent.Reconnecting, onReconnecting)
        .off(RoomEvent.Reconnected, onReconnected)
        .off(RoomEvent.Disconnected, onDisconnected)
        .off(RoomEvent.DataReceived, onData)
        .off(RoomEvent.AudioPlaybackStatusChanged, onAudioStatus);
      void room.disconnect();
    };
  }, [id, room, attempt]);

  // Leaving = ending the interview, not just navigating away: finalize it so the
  // scorer runs on the transcript so far and a report gets generated. Land on the
  // report if there's something to score, otherwise the dashboard.
  async function endInterview() {
    setLeaving(true);
    try {
      const res = await fetch(`/api/interviews/${id}/end`, { method: "POST" });
      const { scored } = (await res.json()) as { scored?: boolean };
      window.location.href = scored ? `/interview/${id}/report` : "/dashboard";
    } catch {
      window.location.href = "/dashboard";
    }
  }

  // Must run from a user gesture (the button click) — Safari won't start remote
  // audio otherwise.
  async function enableAudio() {
    try {
      await room.startAudio();
      setAudioBlocked(false);
    } catch {
      /* still blocked */
    }
  }

  return (
    <RoomContext.Provider value={room}>
      <main className="flex h-dvh flex-col text-fg">
        <header className="flex items-center justify-between gap-4 border-b border-fg/10 px-6 py-4">
          <span className="flex min-w-0 items-center gap-2 font-display text-lg font-medium">
            <span className="h-2 w-2 shrink-0 rounded-full bg-teal" aria-hidden />
            <span className="font-bold">Maven</span>
            {phase && started ? (
              <span className="ml-2 truncate rounded-full border border-fg/15 px-2.5 py-0.5 font-mono text-xs uppercase tracking-widest text-fg/60">
                {phase.replace(/_/g, " ")}
              </span>
            ) : (
              <span className="ml-1 truncate font-mono text-xs uppercase tracking-widest text-fg/40">
                Mock interview
              </span>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-4">
            {state === "live" ? (
              <span className="flex items-center gap-2 font-mono text-xs text-teal">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-teal" aria-hidden />
                {fmtElapsed(seconds)}
              </span>
            ) : (
              <span
                className={`font-mono text-xs uppercase tracking-wide ${
                  state === "ended"
                    ? "text-teal"
                    : state === "error" ||
                        state === "disconnected" ||
                        state === "mic-denied"
                      ? "text-danger"
                      : "text-amber"
                }`}
              >
                {STATE_LABEL[state]}
                {state === "error" && detail ? `: ${detail}` : ""}
              </span>
            )}
            {started &&
              (confirmLeave ? (
                <span className="flex items-center gap-3 text-sm">
                  <span className="text-fg/60">
                    End the interview? We&apos;ll score what you&apos;ve done.
                  </span>
                  <button
                    type="button"
                    disabled={leaving}
                    className="font-medium text-danger transition-colors hover:text-danger/80 disabled:opacity-60"
                    onClick={endInterview}
                  >
                    {leaving ? "Ending…" : "End & score"}
                  </button>
                  <button
                    type="button"
                    disabled={leaving}
                    className="text-fg/60 transition-colors hover:text-fg disabled:opacity-60"
                    onClick={() => setConfirmLeave(false)}
                  >
                    Stay
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="text-sm text-fg/50 transition-colors hover:text-fg"
                  onClick={() => setConfirmLeave(true)}
                >
                  Leave
                </button>
              ))}
          </span>
        </header>

        {started && audioBlocked ? (
          <button
            type="button"
            onClick={enableAudio}
            className="mx-auto mt-3 flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-medium text-on-accent shadow-lg shadow-accent/30 transition-colors hover:bg-accent/90"
          >
            <span aria-hidden>🔊</span> Tap to enable the interviewer&apos;s voice
          </button>
        ) : null}

        {state === "ended" ? (
          <Ended id={id} />
        ) : state === "disconnected" ? (
          <DisconnectedChoice />
        ) : state === "mic-denied" ? (
          <MicDenied onRetry={() => setAttempt((a) => a + 1)} />
        ) : state === "error" ? (
          <ConnectFailed detail={detail} onRetry={() => setAttempt((a) => a + 1)} />
        ) : (
          (() => {
            const coding = phase === "coding" && !!codingProblem;
            return (
              <div className="flex min-h-0 flex-1 flex-col md:flex-row">
                <VoiceRoom
                  connecting={state !== "live" && state !== "reconnecting"}
                  reconnecting={state === "reconnecting"}
                  compact={coding}
                />
                {coding && codingProblem ? (
                  <div className="min-h-[320px] flex-1 md:w-1/2 md:min-h-0">
                    <CodePanel
                      key={codingProblem.id}
                      room={room}
                      problem={codingProblem}
                    />
                  </div>
                ) : null}
              </div>
            );
          })()
        )}

        <RoomAudioRenderer />
      </main>
    </RoomContext.Provider>
  );
}

function VoiceRoom({
  connecting,
  reconnecting = false,
  compact = false,
}: {
  connecting: boolean;
  reconnecting?: boolean;
  compact?: boolean;
}) {
  const { state: agentState, audioTrack } = useVoiceAssistant();
  const { localParticipant } = useLocalParticipant();
  const transcriptions = useTranscriptions();
  const agentVolume = useTrackVolume(audioTrack);
  const [talking, setTalking] = useState(false);
  const transcriptRef = useRef<HTMLUListElement>(null);

  // Push-to-talk is only live when the agent is listening — you can't interrupt
  // while the interviewer speaks, and a reconnecting room won't pretend to hear you.
  const locked = connecting || reconnecting || agentState !== "listening";

  function setMic(on: boolean) {
    setTalking(on);
    void localParticipant.setMicrophoneEnabled(on);
  }

  // Hold Space to talk (only on your turn); skipped while typing so the coding
  // round's spacebar belongs to the editor.
  useEffect(() => {
    function down(e: KeyboardEvent) {
      if (e.code === "Space" && !e.repeat && !locked && !inEditable(e.target)) {
        e.preventDefault();
        setMic(true);
      }
    }
    function up(e: KeyboardEvent) {
      if (e.code === "Space" && !inEditable(e.target)) {
        e.preventDefault();
        setMic(false);
      }
    }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked]);

  useEffect(() => {
    const el = transcriptRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcriptions.length]);

  const status = reconnecting
    ? "Reconnecting…"
    : agentState === "speaking"
      ? "Interviewer speaking"
      : agentState === "thinking"
        ? "Thinking…"
        : agentState === "listening"
          ? "Your turn"
          : connecting
            ? "Connecting…"
            : "Waiting for interviewer…";

  return (
    <div
      className={`mx-auto flex w-full min-h-0 flex-1 flex-col items-center px-6 py-8 sm:py-12 ${
        compact ? "max-w-md" : "max-w-2xl"
      }`}
    >
      {/* The voice is the focal point — give it air above and below so the
          card reads as a hierarchy, not four equal-weight bands. */}
      <div className="flex shrink-0 flex-col items-center">
        <SpeakingBlob
          state={agentState}
          volume={agentVolume}
          compact={compact}
        />
        <p
          key={status}
          className="hero-fade mt-7 text-sm text-fg/55"
          aria-live="polite"
        >
          {status}
        </p>
      </div>

      <ul
        ref={transcriptRef}
        className={`flex w-full flex-1 flex-col gap-3 overflow-y-auto ${
          compact ? "mt-8" : "mt-12"
        }`}
      >
        {transcriptions.map((t, i) => {
          const mine =
            t.participantInfo?.identity === localParticipant.identity;
          const current = i === transcriptions.length - 1;
          return (
            <li
              key={i}
              className={`hero-fade ${mine ? "text-right" : "text-left"}`}
            >
              <span
                className={`font-mono text-xs uppercase tracking-widest ${
                  mine ? "text-teal" : "text-fg/40"
                }`}
              >
                {mine ? "You" : "Interviewer"}
              </span>
              <p
                className={`mt-0.5 font-serif text-lg leading-relaxed ${
                  current ? "text-fg" : "text-fg/60"
                }`}
              >
                {t.text}
              </p>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        disabled={locked}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setMic(true);
        }}
        // pointerup is not guaranteed: a touch-scroll gesture, an incoming call, or
        // any system UI that steals the pointer fires pointercancel INSTEAD, and the
        // mic would stay hot — the candidate keeps broadcasting after they let go.
        // Every path that ends the press has to close the mic.
        onPointerUp={() => setMic(false)}
        onPointerCancel={() => setMic(false)}
        onLostPointerCapture={() => setMic(false)}
        className={`mt-8 h-14 rounded-full px-8 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal disabled:opacity-40 ${
          talking
            ? "bg-teal text-on-accent"
            : "bg-fg/10 text-fg hover:bg-fg/15"
        }`}
      >
        {locked
          ? "Listen…"
          : talking
            ? "Listening… release to send"
            : "Hold to talk (or Space)"}
      </button>
    </div>
  );
}

function SpeakingBlob({
  state,
  volume,
  compact = false,
}: {
  state: string;
  volume: number;
  compact?: boolean;
}) {
  const tone =
    state === "speaking"
      ? "--accent"
      : state === "listening"
        ? "--teal"
        : state === "thinking"
          ? "--amber"
          : "--muted";
  // Only the interviewer's voice drives the swell + morph; clamp so a loud
  // spike can't blow out the layout.
  const speaking = state === "speaking";
  const swell = speaking ? 1 + Math.min(Math.max(volume, 0), 1) * 0.3 : 1;

  return (
    <VoiceOrb
      tone={tone}
      active={speaking}
      swell={swell}
      size={compact ? 156 : 232}
    />
  );
}

function Ended({ id }: { id: string }) {
  return (
    <div className="m-auto flex max-w-sm flex-col items-center gap-5 px-6 text-center">
      <div className="h-3 w-3 rounded-full bg-teal" />
      <p className="text-fg/80">
        That&apos;s a wrap, nice work. We&apos;re scoring your interview now.
      </p>
      <Button
        variant="accent"
        onClick={() => {
          window.location.href = `/interview/${id}/report`;
        }}
      >
        View your report
      </Button>
    </div>
  );
}

function DisconnectedChoice() {
  return (
    <div className="m-auto flex max-w-sm flex-col items-center gap-5 px-6 text-center">
      <div className="h-3 w-3 rounded-full bg-danger" />
      <p className="text-fg/80">
        You were disconnected. Your transcript is kept.
      </p>
      <div className="flex gap-3">
        <Button variant="accent" onClick={() => window.location.reload()}>
          Continue where you left off
        </Button>
        <Button
          variant="outline"
          className="border-fg/20 text-fg hover:bg-fg/10"
          onClick={() => {
            window.location.href = "/interview/new";
          }}
        >
          Start fresh
        </Button>
      </div>
    </div>
  );
}

function ConnectFailed({
  detail,
  onRetry,
}: {
  detail: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="m-auto flex max-w-sm flex-col items-center gap-5 px-6 text-center">
      <div className="h-3 w-3 rounded-full bg-danger" />
      <div>
        <p className="text-fg">Couldn&apos;t connect to the interview.</p>
        <p className="mt-2 text-sm text-fg/60">
          {detail ?? "The room didn't answer."} Your interview isn&apos;t lost;
          retry to join again.
        </p>
      </div>
      <Button variant="accent" onClick={onRetry}>
        Retry connection
      </Button>
    </div>
  );
}

function MicDenied({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="m-auto flex max-w-sm flex-col items-center gap-5 px-6 text-center">
      <div className="h-3 w-3 rounded-full bg-danger" />
      <div>
        <p className="text-fg">Microphone access is blocked.</p>
        <p className="mt-2 text-sm text-fg/60">
          The interviewer needs your mic to hear your answers. Allow microphone
          access for this site (via the lock or camera icon in your
          browser&apos;s address bar), then retry.
        </p>
      </div>
      <Button variant="accent" onClick={onRetry}>
        Retry microphone
      </Button>
    </div>
  );
}
