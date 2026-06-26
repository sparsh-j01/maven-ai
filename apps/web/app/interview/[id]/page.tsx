"use client";

import {
  type RemoteParticipant,
  Room,
  RoomEvent,
} from "livekit-client";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type ConnState = "connecting" | "connected" | "disconnected" | "error";
type Msg = { from: "you" | "agent"; text: string };

// Milestone 2: text-only transport proof. Connect to the room, send a data
// message, render the agent's echo. The real voice room (dark, push-to-talk)
// builds on this in milestone 3.
export default function InterviewRoomPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<ConnState>("connecting");
  const [detail, setDetail] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const roomRef = useRef<Room | null>(null);

  useEffect(() => {
    let cancelled = false;
    const room = new Room();
    roomRef.current = room;

    room
      .on(
        RoomEvent.DataReceived,
        (payload: Uint8Array, participant?: RemoteParticipant) => {
          const text = new TextDecoder().decode(payload);
          setMessages((m) => [
            ...m,
            { from: "agent", text: `${participant?.identity ?? "agent"}: ${text}` },
          ]);
        },
      )
      .on(RoomEvent.Disconnected, () => setState("disconnected"));

    (async () => {
      try {
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
        setState("connected");
      } catch (e) {
        if (cancelled) return;
        setState("error");
        setDetail(e instanceof Error ? e.message : "connection failed");
      }
    })();

    return () => {
      cancelled = true;
      void room.disconnect();
    };
  }, [id]);

  async function send() {
    const room = roomRef.current;
    const text = draft.trim();
    if (!room || !text || state !== "connected") return;
    await room.localParticipant.publishData(new TextEncoder().encode(text), {
      reliable: true,
    });
    setMessages((m) => [...m, { from: "you", text }]);
    setDraft("");
  }

  const statusColor =
    state === "connected"
      ? "text-teal"
      : state === "connecting"
        ? "text-amber"
        : "text-danger";

  return (
    <main className="flex min-h-screen flex-col bg-ink text-paper">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <span className="font-mono text-sm">interview · {id.slice(0, 8)}</span>
        <span className={`font-mono text-xs uppercase tracking-wide ${statusColor}`}>
          {state}
          {detail ? ` — ${detail}` : ""}
        </span>
      </header>

      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-2 px-6 py-8">
        {messages.length === 0 ? (
          <p className="my-auto text-center text-sm text-paper/40">
            Connected to the room. Send a message — the agent echoes it back.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((m, i) => (
              <li
                key={i}
                className={m.from === "you" ? "text-right" : "text-left"}
              >
                <span
                  className={`inline-block rounded px-3 py-2 text-[18px] leading-relaxed ${
                    m.from === "you"
                      ? "bg-teal/20 text-paper"
                      : "bg-white/10 text-paper"
                  }`}
                >
                  {m.text}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-white/10 px-6 py-4">
        <div className="mx-auto flex w-full max-w-2xl gap-3">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void send();
            }}
            placeholder={
              state === "connected" ? "Type a message…" : "Connecting…"
            }
            disabled={state !== "connected"}
            className="flex-1 rounded border border-white/15 bg-white/5 px-3 py-2 text-paper placeholder:text-paper/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal disabled:opacity-50"
          />
          <Button
            variant="accent"
            onClick={() => void send()}
            disabled={state !== "connected"}
          >
            Send
          </Button>
        </div>
      </div>
    </main>
  );
}
