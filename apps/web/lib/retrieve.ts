import { getDb, questions } from "@maven-ai/db";
import {
  type CompanyType,
  type InterviewType,
  type PlanCandidates,
  type Seniority,
  planCandidates,
  rerankCandidates,
} from "@maven-ai/shared";
import { embedText } from "@maven-ai/shared/embed";
import { cosineDistance, isNotNull } from "drizzle-orm";

// RAG retrieval (§5): rank the curated question bank by semantic similarity to
// the candidate's résumé/JD using pgvector, so the options the LLM assembler
// sees first are grounded in THIS candidate's background. It re-ranks the
// deterministic candidate pool (rerankCandidates) rather than replacing it, so a
// missing key, empty table, or DB error can only reorder — never drop a
// question. Returns null on any failure → personalizePlan uses the plain order.
//
// ponytail: re-rank the whole (small) bank, no top-k LIMIT. When the bank grows
// past what fits in the assembler prompt, switch the query to
// `… ORDER BY distance LIMIT k` and feed only the top-k as candidates.

// pgvector re-ranks the (small) bank in milliseconds; this only bounds a hung DB
// connection so retrieval fails over to the deterministic order instead of
// stalling interview creation. embedText self-caps at 8s (see embed.ts).
const DB_TIMEOUT_MS = 4000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(label)), ms);
    p.then(resolve, reject).finally(() => clearTimeout(t));
  });
}

type Input = {
  role: string;
  seniority: Seniority;
  type: InterviewType;
  company?: string | null;
  companyType?: CompanyType | null;
  resumeText?: string | null;
  jdText?: string | null;
};

export async function retrieveCandidates(
  input: Input,
): Promise<PlanCandidates[] | null> {
  const resume = input.resumeText?.trim();
  const jd = input.jdText?.trim();
  if (!resume && !jd) return null; // nothing to personalize from

  try {
    const query = [`${input.seniority} ${input.role}`, resume, jd]
      .filter(Boolean)
      .join("\n\n");
    const vec = await embedText(query);

    const db = getDb();
    const distance = cosineDistance(questions.embedding, vec);
    const rows = await withTimeout(
      db
        .select({ slug: questions.slug, distance })
        .from(questions)
        .where(isNotNull(questions.embedding))
        .orderBy(distance),
      DB_TIMEOUT_MS,
      "retrieve db timeout",
    );
    if (rows.length === 0) return null; // bank not seeded yet

    return rerankCandidates(
      planCandidates(input),
      rows.map((r) => r.slug),
    );
  } catch (err) {
    console.error("[retrieveCandidates] falling back to deterministic order:", err);
    return null;
  }
}
