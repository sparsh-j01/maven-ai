// Gemini text embeddings (gemini-embedding-001, requested at 768 dims to match
// the vector(768) columns on the questions/resumes tables). The embedding model is a
// separate dependency from the chat LLM by design (architecture §2.4): swapping
// the brain doesn't re-embed the banks. Server-only — reads GOOGLE_API_KEY and
// must never be bundled to the client.
//
// ponytail: a fetch wrapper, not an SDK. Swapping providers is editing this file.

const MODEL = "gemini-embedding-001";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DIMS = 768; // must match EMBED_DIMS / vector(768) columns in db/schema.ts
// Bound the request like the other Gemini calls (chooseWithGemini/structureResume):
// embedText sits on the interview-create path (retrieveCandidates), so a hung
// connection must fall back, not stall the request. Generous enough for the
// seed's one-shot batch of the (small) question bank.
const TIMEOUT_MS = 8000;

function apiKey(): string {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("GOOGLE_API_KEY is not set");
  return key;
}

// Embed a single string (used for the retrieval query at plan time). Routed
// through the batch endpoint: this key's :embedContent method 404s while
// :batchEmbedContents works, so there's one code path that we know works.
export async function embedText(text: string): Promise<number[]> {
  return (await embedTexts([text]))[0]!;
}

// Embed many strings in one request (used to seed the question bank).
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
