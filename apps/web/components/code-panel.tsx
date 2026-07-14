"use client";

import Editor, { loader } from "@monaco-editor/react";
import {
  type CodingProblem,
  type Language,
  LANGUAGES,
  STARTER_BY_LANGUAGE,
} from "@maven-ai/shared";
import { type Room, RoomEvent } from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";

// The candidate's Monaco editor. The buffer is broadcast to the agent over the
// data channel; the agent owns run_code and grades server-side — nothing here is
// trusted as a control signal.

// Serve Monaco from our own origin. Left alone, @monaco-editor/loader injects a
// <script src="https://cdn.jsdelivr.net/..."> into the page, and script-src doesn't
// list jsdelivr — so the browser blocks it and the editor silently never mounts.
// scripts/copy-monaco.mjs stages the assets into public/ at build.
loader.config({ paths: { vs: "/monaco/vs" } });

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
  // The buffer starts pre-filled with the starter template, and the broadcast below
  // doesn't care whether a human ever saw an editor. So if Monaco fails to mount, we
  // would ship that untouched stub to the agent, Judge0 would run it perfectly, and
  // the candidate would be graded down for a round they could not type into. Publish
  // nothing until the editor is actually there to type in.
  const [editorReady, setEditorReady] = useState(false);

  const [editorTheme, setEditorTheme] = useState<"vs" | "vs-dark">("vs-dark");
  useEffect(() => {
    const root = document.documentElement;
    const sync = () =>
      setEditorTheme(
        root.getAttribute("data-theme") === "dark" ? "vs-dark" : "vs",
      );
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  const code = codeByLang[language];

  // Broadcast the buffer (debounced) so run_code grades the freshest code.
  useEffect(() => {
    if (!editorReady) return;
    const t = setTimeout(
      () => publish(room, { type: "code", language, code }),
      400,
    );
    return () => clearTimeout(t);
  }, [room, language, code, editorReady]);

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
    publish(room, { type: "code", language, code });
    publish(room, { type: "run" });
    if (timer.current) clearTimeout(timer.current);
    // Fallback: clear the spinner if the agent never answers.
    timer.current = setTimeout(() => {
      setRunning(false);
      setResult({ ok: false, error: "no response from the sandbox" });
    }, 25_000);
  }, [room, language, code]);

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-fg/10 bg-panel/60 backdrop-blur-2xl">
      <div className="border-b border-fg/10 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-fg">{problem.title}</span>
          <span className="font-mono text-xs uppercase tracking-wide text-muted">
            {problem.difficulty}
          </span>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-fg/70">
          {problem.prompt}
        </p>
      </div>

      <div className="flex items-center gap-2 border-b border-fg/10 px-4 py-2">
        {LANGUAGES.map((lang) => (
          <button
            key={lang}
            type="button"
            onClick={() => setLanguage(lang)}
            className={`rounded-full px-2.5 py-1 font-mono text-xs transition-colors ${
              language === lang
                ? "bg-fg/15 text-fg"
                : "text-muted hover:text-fg"
            }`}
          >
            {lang}
          </button>
        ))}
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="ml-auto rounded-full bg-teal px-4 py-1 text-xs font-medium text-on-accent transition-opacity disabled:opacity-50"
        >
          {running ? "Running…" : "Run"}
        </button>
      </div>

      <div className="min-h-[240px] flex-1">
        <Editor
          height="100%"
          theme={editorTheme}
          language={language}
          value={code}
          onMount={() => setEditorReady(true)}
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
        <div className="border-t border-fg/10 px-4 py-3 text-xs">
          {!result.ok ? (
            <p className="text-danger">Couldn&apos;t run: {result.error}</p>
          ) : (
            <p className={result.passed ? "text-teal" : "text-amber"}>
              {result.passed
                ? "Passed the test cases."
                : `Didn't pass${result.status ? ` (${result.status})` : ""}.`}
            </p>
          )}
          {result.stdout ? (
            <pre className="mt-2 max-h-24 overflow-auto whitespace-pre-wrap font-mono text-xs text-fg/60">
              {result.stdout}
            </pre>
          ) : null}
          {result.stderr ? (
            <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap font-mono text-xs text-danger/80">
              {result.stderr}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
