import type {
  FeedbackReport,
  InterviewPlan,
  RubricScores,
} from "@maven-ai/shared";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

// Gemini embedding dims (§2.4). Changing this is a re-embed migration.
const EMBED_DIMS = 768;
const ts = (name: string) => timestamp(name, { withTimezone: true });

// users: thin mirror of Clerk identity (source of truth = Clerk).
export const users = pgTable("users", {
  id: text("id").primaryKey(), // Clerk user id
  email: text("email").notNull(),
  plan: text("plan").notNull().default("free"), // free | pro
  createdAt: ts("created_at").defaultNow(),
});

// a single mock interview session.
export const interviews = pgTable(
  "interviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    company: text("company"),
    resumeText: text("resume_text"), // pasted resume — optional tailoring context (§5)
    jdText: text("jd_text"), // pasted job description — optional tailoring context
    seniority: text("seniority").notNull(), // intern | junior | mid | senior | sde1 | sde2 | sde3
    type: text("type").notNull(), // technical | behavioral | mixed | system_design
    status: text("status").notNull(), // provisioning | live | processing | ready | failed
    livekitRoom: text("livekit_room"),
    planJson: jsonb("plan_json").$type<InterviewPlan>(),
    currentPhase: text("current_phase"), // cursor: agent's current phase
    planCursor: integer("plan_cursor").notNull().default(0), // cursor: index into plan
    startedAt: ts("started_at"),
    endedAt: ts("ended_at"),
    createdAt: ts("created_at").defaultNow(),
  },
  (t) => [index("interviews_user_created_idx").on(t.userId, t.createdAt)],
);

// the transcript: one row per spoken turn, both speakers.
export const interviewTurns = pgTable(
  "interview_turns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    interviewId: uuid("interview_id")
      .notNull()
      .references(() => interviews.id, { onDelete: "cascade" }),
    speaker: text("speaker").notNull(), // candidate | interviewer
    text: text("text").notNull(),
    tsStartMs: integer("ts_start_ms").notNull(),
    tsEndMs: integer("ts_end_ms").notNull(),
    phase: text("phase"),
  },
  (t) => [index("turns_interview_ts_idx").on(t.interviewId, t.tsStartMs)],
);

// curated, embeddable question bank for retrieval/personalization (§5).
export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    role: text("role").notNull(),
    competency: text("competency").notNull(),
    difficulty: text("difficulty").notNull(), // easy | medium | hard
    prompt: text("prompt").notNull(),
    rubricHint: text("rubric_hint"),
    embedding: vector("embedding", { dimensions: EMBED_DIMS }),
  },
  (t) => [
    index("questions_embedding_idx").using(
      "hnsw",
      t.embedding.op("vector_cosine_ops"),
    ),
  ],
);

// parsed resume, used to personalize the plan (§5).
export const resumes = pgTable(
  "resumes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fileUrl: text("file_url").notNull(), // R2 object
    parsedJson: jsonb("parsed_json"), // structured skills/experience
    embedding: vector("embedding", { dimensions: EMBED_DIMS }),
    createdAt: ts("created_at").defaultNow(),
  },
  (t) => [
    index("resumes_embedding_idx").using(
      "hnsw",
      t.embedding.op("vector_cosine_ops"),
    ),
  ],
);

// live coding round submissions.
export const codeSubmissions = pgTable("code_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  interviewId: uuid("interview_id")
    .notNull()
    .references(() => interviews.id, { onDelete: "cascade" }),
  language: text("language").notNull(),
  code: text("code").notNull(),
  execStdout: text("exec_stdout"),
  execPassed: boolean("exec_passed"),
  createdAt: ts("created_at").defaultNow(),
});

// the structured feedback report (generated async after the interview, §4.3).
export const feedbackReports = pgTable("feedback_reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  interviewId: uuid("interview_id")
    .notNull()
    .references(() => interviews.id, { onDelete: "cascade" }),
  overallScore: numeric("overall_score"), // 0–100
  rubricScores: jsonb("rubric_scores").$type<RubricScores>(),
  summary: text("summary"),
  strengths: jsonb("strengths").$type<string[]>(),
  gaps: jsonb("gaps").$type<string[]>(),
  modelAnswers: jsonb("model_answers").$type<FeedbackReport["modelAnswers"]>(),
  createdAt: ts("created_at").defaultNow(),
});

// Stripe billing mirror.
export const subscriptions = pgTable("subscriptions", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubId: text("stripe_sub_id"),
  status: text("status"), // active | canceled | past_due
  currentPeriodEnd: ts("current_period_end"),
});
