// Gemini text embeddings (768 dims to match the vector(768) columns). Server-only —
// reads GOOGLE_API_KEY and must never be bundled to the client.

const MODEL = "gemini-embedding-001";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DIMS = 768; // must match EMBED_DIMS / vector(768) columns in db/schema.ts
// Bound the request so a hung connection on the interview-create path falls back, not stalls.
const TIMEOUT_MS = 8000;

function apiKey(): string {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("GOOGLE_API_KEY is not set");
  return key;
}

// Routed through the batch endpoint: this key's :embedContent 404s, :batchEmbedContents works.
export async function embedText(text: string): Promise<number[]> {
  return (await embedTexts([text]))[0]!;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}/${MODEL}:batchEmbedContents?key=${apiKey()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: `models/${MODEL}`,
          content: { parts: [{ text }] },
          outputDimensionality: DIMS,
        })),
      }),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`Gemini batch embed ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { embeddings?: { values?: number[] }[] };
  const out = json.embeddings?.map((e) => e.values ?? []);
  if (!out || out.length !== texts.length || out.some((v) => v.length === 0))
    throw new Error("Gemini batch embed returned an unexpected shape");
  return out;
}
