"use client";

import {
  RoomAudioRenderer,
  RoomContext,
  useLocalParticipant,
  useTranscriptions,
  useVoiceAssistant,
} from "@livekit/components-react";
import { getCodingProblem } from "@maven-ai/shared";
import { Room, RoomEvent } from "livekit-client";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CodePanel } from "@/components/code-panel";
import { Button } from "@/components/ui/button";

type ConnState =
  | "checking-mic"
  | "mic-denied"
  | "connecting"
  | "live"
  | "reconnecting"
  | "disconnected"
  | "ended"
  | "error";

// Milestone 3: the live voice room (dark theme). Connect to the room, publish
// the mic only on push-to-talk, and run the turn-based loop against the
// interviewer agent. No barge-in is enforced agent-side
// (allow_interruptions=False); the UI makes turn ownership obvious. §7.4.
export default function InterviewRoomPage() {
  const { id } = useParams<{ id: string }>();
  const room = useMemo(() => new Room(), []);
  const [state, setState] = useState<ConnState>("checking-mic");
  const [detail, setDetail] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<string | null>(null);
  // The agent names the active coding problem in its phase signal; look it up in
  // the shared bank (public half only — no hidden tests reach the client).
  const [codingProblemId, setCodingProblemId] = useState<string | null>(null);
  const codingProblem = codingProblemId
    ? (getCodingProblem(codingProblemId) ?? null)
    : null;

  useEffect(() => {
    let cancelled = false;
    const onReconnecting = () => setState("reconnecting");
    const onReconnected = () => setState("live");
    const onDisconnected = () => setState("disconnected");
    // The agent publishes {type:"ended"} over the data channel when it calls
    // end_interview (§7.4) — flip to the ended state so we can offer the report.
    const onData = (payload: Uint8Array) => {
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg?.type === "ended") setState("ended");
        else if (msg?.type === "phase") {
          // The agent announces each phase (and the active problem) so the editor
          // shows for the coding round and switches between the two problems.
          setPhase(msg.phase ?? null);
          if (msg.phase === "coding" && msg.problemId)
            setCodingProblemId(msg.problemId);
        }
      } catch {
        // not our message
      }
    };
    room
      .on(RoomEvent.Reconnecting, onReconnecting)
      .on(RoomEvent.Reconnected, onReconnected)
      .on(RoomEvent.Disconnected, onDisconnected)
      .on(RoomEvent.DataReceived, onData);

    (async () => {
      // Mic pre-check (gated, §7.3): confirm permission before joining so the
      // candidate never lands in the room with an agent that can't hear them.
      // ponytail: permission gate only; the live input-level meter is part of
      // the full setup wizard in milestone 4.
      setState("checking-mic");
      try {
        const probe = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        probe.getTracks().forEach((t) => t.stop()); // release; PTT re-acquires
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
        if (!res.ok) throw new Error(await res.text());
        const { token, serverUrl } = (await res.json()) as {
          token: string;
          serverUrl: string;
        };
        await room.connect(serverUrl, token);
        if (cancelled) return;
        // Mic stays off until the candidate holds to talk (push-to-talk).
        await room.localParticipant.setMicrophoneEnabled(false);
        setState("live");
      } catch (e) {
        if (cancelled) return;
        setDetail(e instanceof Error ? e.message : "connection failed");
        setState("error");
      }
    })();

    return () => {
      cancelled = true;
      room
        .off(RoomEvent.Reconnecting, onReconnecting)
        .off(RoomEvent.Reconnected, onReconnected)
        .off(RoomEvent.Disconnected, onDisconnected)
        .off(RoomEvent.DataReceived, onData);
      void room.disconnect();
    };
  }, [id, room, attempt]);

  return (
    <RoomContext.Provider value={room}>
      <main className="flex min-h-screen flex-col bg-ink text-paper">
        <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <span className="font-mono text-sm">interview · {id.slice(0, 8)}</span>
          <span
            className={`font-mono text-xs uppercase tracking-wide ${
              state === "live" || state === "ended"
                ? "text-teal"
                : state === "error" ||
                    state === "disconnected" ||
                    state === "mic-denied"
                  ? "text-danger"
                  : "text-amber"
            }`}
          >
            {state}
            {detail ? ` — ${detail}` : ""}
          </span>
        </header>

        {state === "ended" ? (
          <Ended id={id} />
        ) : state === "disconnected" ? (
          <DisconnectedChoice />
        ) : state === "mic-denied" ? (
          <MicDenied onRetry={() => setAttempt((a) => a + 1)} />
        ) : (
          (() => {
            const coding = phase === "coding" && !!codingProblem;
            return (
              <div className="flex min-h-0 flex-1 flex-col md:flex-row">
                <VoiceRoom
                  connecting={state !== "live" && state !== "reconnecting"}
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

        {/* Plays the interviewer's TTS audio coming from the room. */}
        <RoomAudioRenderer />
      </main>
    </RoomContext.Provider>
  );
}

function VoiceRoom({
  connecting,
  compact = false,
}: {
  connecting: boolean;
  compact?: boolean;
}) {
  const { state: agentState } = useVoiceAssistant();
  const { localParticipant } = useLocalParticipant();
  const transcriptions = useTranscriptions();
  const [talking, setTalking] = useState(false);

  // Push-to-talk is only live when the agent is listening for your answer —
  // you physically cannot interrupt while the interviewer is speaking.
  const locked = connecting || agentState !== "listening";

  function setMic(on: boolean) {
    setTalking(on);
    void localParticipant.setMicrophoneEnabled(on);
  }

  // Hold Space to talk (only on your turn).
  useEffect(() => {
    function down(e: KeyboardEvent) {
      if (e.code === "Space" && !e.repeat && !locked) {
        e.preventDefault();
        setMic(true);
      }
    }
    function up(e: KeyboardEvent) {
      if (e.code === "Space") {
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

  const status =
    agentState === "speaking"
      ? "Interviewer speaking — listen"
      : agentState === "thinking"
        ? "Thinking…"
        : agentState === "listening"
          ? "Your turn"
          : connecting
            ? "Connecting…"
            : "Waiting for interviewer…";

  // SpeakerOrb — the visual truth of who has the floor (§6.2, §7.4).
  // ponytail: turn-state ring now; TTS-amplitude reactivity (BarVisualizer +
  // @livekit/components-styles) is the polish upgrade in milestone 8.
  const orb =
    agentState === "speaking"
      ? "border-paper/70 animate-pulse shadow-[0_0_80px_-20px_rgba(250,250,247,0.7)]"
      : agentState === "thinking"
        ? "border-amber animate-pulse shadow-[0_0_80px_-20px_#E0A100]"
        : agentState === "listening"
          ? "border-teal shadow-[0_0_90px_-20px_#0FA37F]"
          : "border-white/20";

  return (
    <div
      className={`mx-auto flex w-full flex-1 flex-col items-center px-6 py-10 ${
        compact ? "max-w-md" : "max-w-2xl"
      }`}
    >
      <div
        className={`rounded-full border-2 transition-all duration-300 ${
          compact ? "h-24 w-24" : "h-40 w-40"
        } ${orb}`}
        aria-hidden
      />
      <p className="mt-6 text-sm text-paper/70" aria-live="polite">
        {status}
      </p>

      {/* LiveTranscript — both speakers, current line last (auto-scrolls). */}
      <ul className="mt-8 flex w-full flex-1 flex-col gap-3 overflow-y-auto">
        {transcriptions.map((t, i) => {
          const mine =
            t.participantInfo?.identity === localParticipant.identity;
          return (
            <li key={i} className={mine ? "text-right" : "text-left"}>
              <span className="text-xs uppercase tracking-wide text-paper/40">
                {mine ? "You" : "Interviewer"}
              </span>
              <p className="text-[18px] leading-relaxed">{t.text}</p>
            </li>
          );
        })}
      </ul>

      {/* Push-to-talk — disabled while the interviewer speaks (no interrupting). */}
      <button
        type="button"
        disabled={locked}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setMic(true);
        }}
        onPointerUp={() => setMic(false)}
        className={`mt-8 h-14 rounded-full px-8 font-medium transition-colors disabled:opacity-40 ${
          talking
            ? "bg-teal text-white"
            : "bg-white/10 text-paper hover:bg-white/15"
        }`}
      >
        {locked
          ? "Listen…"
          : talking
            ? "Listening — release to send"
            : "Hold to talk (or Space)"}
      </button>
    </div>
  );
}

function Ended({ id }: { id: string }) {
  // §7.4 ended: a calm confirmation that hands off to the report, which kicks
  // scoring and shows progress. The transcript is kept either way.
  return (
    <div className="m-auto flex max-w-sm flex-col items-center gap-5 px-6 text-center">
      <div className="h-3 w-3 rounded-full bg-teal" />
      <p className="text-paper/80">
        That&apos;s a wrap — nice work. We&apos;re scoring your interview now.
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
  // §7.4 disconnected: an explicit choice, never a silent drop. Continue rejoins
  // the same room; start fresh begins a new interview. ponytail: full transcript
  // rehydrate + agent-cursor resume arrives with persistence in milestone 4/5.
  return (
    <div className="m-auto flex max-w-sm flex-col items-center gap-5 px-6 text-center">
      <div className="h-3 w-3 rounded-full bg-danger" />
      <p className="text-paper/80">
        You were disconnected. Your transcript is kept.
      </p>
      <div className="flex gap-3">
        <Button variant="accent" onClick={() => window.location.reload()}>
          Continue where you left off
        </Button>
        <Button
          variant="outline"
          className="border-white/20 text-paper hover:bg-white/10"
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

function MicDenied({ onRetry }: { onRetry: () => void }) {
  // §7.3 permission denied: an explicit recovery card, never a dead end.
  return (
    <div className="m-auto flex max-w-sm flex-col items-center gap-5 px-6 text-center">
      <div className="h-3 w-3 rounded-full bg-danger" />
      <div>
        <p className="text-paper">Microphone access is blocked.</p>
        <p className="mt-2 text-sm text-paper/60">
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
