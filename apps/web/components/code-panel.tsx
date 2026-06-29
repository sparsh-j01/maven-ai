"use client";

import Editor from "@monaco-editor/react";
import {
  type CodingProblem,
  type Language,
  LANGUAGES,
  STARTER_BY_LANGUAGE,
} from "@maven-ai/shared";
import { type Room, RoomEvent } from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";

// §7.4 coding phase: the CodePanel (Monaco) the candidate solves in. It broadcasts
// the editor buffer to the agent over the data channel and, on Run, asks the agent
// to execute it in the sandbox (the agent owns run_code, §4.2) — then shows the
// pass/fail result strip the agent publishes back. Untrusted-input note: the agent
// re-validates and grades server-side; nothing here is trusted as a control signal.

type RunResult = {
  ok: boolean;
  passed?: boolean;
  stdout?: string;
  stderr?: string;
  status?: string;
  error?: string;
};

function publish(room: Room, obj: unknown) {
  const data = new TextEncoder().encode(JSON.stringify(obj));
  void room.localParticipant.publishData(data, { reliable: true, topic: "maven" });
}

export function CodePanel({
  room,
  problem,
}: {
  room: Room;
  problem: CodingProblem;
}) {
  const [language, setLanguage] = useState<Language>("python");
  // One buffer per language so switching doesn't wipe the other's work.
  const [codeByLang, setCodeByLang] =
    useState<Record<Language, string>>(STARTER_BY_LANGUAGE);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const code = codeByLang[language];

  // Broadcast the buffer (debounced) so run_code always grades the freshest code,
  // including when the agent decides to run it itself.
  useEffect(() => {
    const t = setTimeout(
      () => publish(room, { type: "code", language, code }),
      400,
    );
    return () => clearTimeout(t);
  }, [room, language, code]);

  // The agent runs the code in the sandbox and publishes the verdict back here.
  useEffect(() => {
    const onData = (
      payload: Uint8Array,
      _participant?: unknown,
      _kind?: unknown,
      topic?: string,
    ) => {
      if (topic && topic !== "maven") return;
      try {
        const msg = JSON.parse(new TextDecoder().decode(payload));
        if (msg?.type === "run_result") {
          if (timer.current) clearTimeout(timer.current);
          setResult(msg as RunResult);
          setRunning(false);
        }
      } catch {
        // not our message
      }
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room]);

  const run = useCallback(() => {
    setResult(null);
    setRunning(true);
    // Push the latest buffer first, then ask the agent to run THIS code.
    publish(room, { type: "code", language, code });
    publish(room, { type: "run" });
    if (timer.current) clearTimeout(timer.current);
    // Fallback: clear the spinner if the agent never answers (sandbox down).
    timer.current = setTimeout(() => {
      setRunning(false);
      setResult({ ok: false, error: "no response from the sandbox" });
    }, 25_000);
  }, [room, language, code]);

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-white/10 bg-ink">
      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-paper">{problem.title}</span>
          <span className="font-mono text-[10px] uppercase tracking-wide text-paper/40">
            {problem.difficulty}
          </span>
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-paper/60">
          {problem.prompt}
        </p>
      </div>

      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2">
        {LANGUAGES.map((lang) => (
          <button
            key={lang}
            type="button"
            onClick={() => setLanguage(lang)}
            className={`rounded px-2.5 py-1 font-mono text-xs transition-colors ${
              language === lang
                ? "bg-white/15 text-paper"
                : "text-paper/50 hover:text-paper/80"
            }`}
          >
            {lang}
          </button>
        ))}
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="ml-auto rounded bg-teal px-4 py-1 text-xs font-medium text-white transition-opacity disabled:opacity-50"
        >
          {running ? "Running…" : "Run"}
        </button>
      </div>

      <div className="min-h-[240px] flex-1">
        <Editor
          height="100%"
          theme="vs-dark"
          language={language}
          value={code}
          onChange={(v) =>
            setCodeByLang((prev) => ({ ...prev, [language]: v ?? "" }))
          }
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            scrollBeyondLastLine: false,
            lineNumbers: "on",
            tabSize: 2,
          }}
        />
      </div>

      {result ? (
        <div className="border-t border-white/10 px-4 py-3 text-xs">
          {!result.ok ? (
            <p className="text-danger">Couldn&apos;t run: {result.error}</p>
          ) : (
            <p className={result.passed ? "text-teal" : "text-amber"}>
              {result.passed
                ? "Passed the test cases."
                : `Didn't pass${result.status ? ` — ${result.status}` : ""}.`}
            </p>
          )}
          {result.stdout ? (
            <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-paper/60">
              {result.stdout}
            </pre>
          ) : null}
          {result.stderr ? (
            <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-danger/80">
              {result.stderr}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
