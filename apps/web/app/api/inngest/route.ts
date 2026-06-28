import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { scoreInterview } from "@/lib/score-interview";

// Inngest reaches the durable functions through this endpoint (§10). The local
// dev server discovers it at /api/inngest; in prod Inngest Cloud calls it.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [scoreInterview],
});
