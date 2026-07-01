// Seed the curated question bank into the `questions` table with Gemini
// embeddings, so plan personalization can retrieve questions by résumé
// similarity (pgvector, milestone 7). Idempotent: upserts by slug, so re-running
// re-embeds in place. Needs DATABASE_URL + GOOGLE_API_KEY (loaded from .env).
//   pnpm --filter @maven-ai/db seed
import { bankForSeeding } from "@maven-ai/shared";
import { embedTexts } from "@maven-ai/shared/embed";
import { getDb, questions } from "../src";

async function main() {
  const bank = bankForSeeding();
  console.log(`Embedding ${bank.length} questions…`);
  // Embed competency + prompt so retrieval matches on topic, not just wording.
  const vectors = await embedTexts(bank.map((q) => `${q.competency}: ${q.prompt}`));

  const db = getDb();
  for (let i = 0; i < bank.length; i++) {
    const q = bank[i]!;
    const row = {
      slug: q.slug,
      role: q.role,
      competency: q.competency,
      difficulty: q.difficulty,
      prompt: q.prompt,
      rubricHint: q.rubricHint ?? null,
      embedding: vectors[i]!,
    };
    await db
      .insert(questions)
      .values(row)
      .onConflictDoUpdate({ target: questions.slug, set: row });
  }
  console.log(`Seeded ${bank.length} questions.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
