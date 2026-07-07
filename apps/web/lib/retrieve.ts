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

// RAG retrieval: rank the curated question bank by pgvector similarity to the résumé/JD.
// It re-ranks the deterministic pool (never drops a question); returns null on any
// failure, so personalizePlan falls back to the plain order.

// Bounds a hung DB connection so retrieval fails over to the deterministic order.
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
